/**
 * 汇率监控脚本（适用于 Surge 面板）
 * 
 * ✅ 功能说明：
 * 1. 实时获取人民币(CNY)汇率数据，支持多币种显示。
 * 2. 自动记录每个币种昨日汇率，并检测波动。
 * 3. 若汇率波动超过指定阈值（默认0.3%），则触发提醒（每日一次）。
 * 4. 每次运行都会刷新面板显示（即使无波动）。
 * 5. 支持参数自定义：threshold 波动提醒阈值，icon 图标，color 图标颜色。
 */

// 设置汇率 API 地址（基准币种为 CNY）
const url = "https://open.er-api.com/v6/latest/CNY";

// 获取脚本参数（如 threshold=0.5）
const params = getParams($argument);

// 设置波动提醒阈值（默认 0.3%）
const threshold = parseFloat(params.threshold || "0.3");

// 获取当前日期（yyyy-mm-dd 格式）
const today = new Date().toISOString().slice(0, 10);

// 提醒状态持久化键名
const remindKey = "exrate_daily_reminded";

// 获取上次提醒日期
const lastRemindDate = $persistentStore.read(remindKey);

// 判断今天是否已提醒
const remindedToday = lastRemindDate === today;

// ✅ 打印日志确认脚本是否运行
console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);

// 发送 HTTP 请求获取汇率数据
$httpClient.get(url, function (error, response, data) {
  if (error) {
    // 请求失败，打印错误并终止
    console.log(`[Exchange] 请求失败：${error}`);
    $done({
      title: "汇率获取失败",
      content: "请求错误：" + error,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  let rates;
  try {
    // 解析 JSON 数据并提取汇率字段
    const parsed = JSON.parse(data);
    rates = parsed.rates;
    if (!rates) throw new Error("No rates field");
  } catch (e) {
    // 数据解析失败
    console.log(`[Exchange] 数据解析异常`);
    $done({
      title: "汇率获取失败",
      content: "数据解析异常",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  // 格式化汇率小数位
  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

  // 定义要展示的币种及换算方式
  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  let content = "";            // 面板内容
  let fluctuations = [];       // 汇率波动提醒内容

  for (const item of displayRates) {
    const current = item.value();                         // 当前汇率
    const rounded = formatRate(current, item.decimals);   // 保留小数位
    const prev = parseFloat($persistentStore.read("exrate_" + item.key)); // 读取上次值

    // 如果有上次数据，则计算变动百分比
    if (!isNaN(prev)) {
      const change = ((current - prev) / prev) * 100;
      if (Math.abs(change) >= threshold && !remindedToday) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);
      }
    }

    // 写入当前汇率值以供下次比较
    $persistentStore.write(String(current), "exrate_" + item.key);
    
    // 构造面板内容
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  // ✅ 若今天未提醒过，更新提醒时间
  if (!remindedToday) {
    $persistentStore.write(today, remindKey);
  }

  // ✅ 每次刷新面板时间戳
  const timestamp = new Date().toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });

  // 添加波动提醒内容（若有）
  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}`;
  }

  // 构建面板显示数据
  const panel = {
    title: `当前汇率信息 ${timestamp}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  };

  // ✅ 日志输出当前汇率信息
  console.log("[Exchange] 刷新面板，内容如下：\n" + content);
  $done(panel); // 完成
});

// 获取模块参数（如 threshold=0.3&icon=...）
function getParams(param) {
  try {
    return Object.fromEntries(
      ($argument || "")
        .split("&")               // 按 & 分割参数
        .filter(Boolean)          // 过滤空值
        .map(item => item.split("="))               // 按 = 分割键值
        .map(([k, v]) => [k, decodeURIComponent(v)])// 解码值
    );
  } catch (e) {
    return {};
  }
}
