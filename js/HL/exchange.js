/**
 * 汇率监控脚本
 *
 * 功能总结：
 * - 每次运行时检测汇率波动，超过阈值即提醒（阈值可通过参数设置，默认0.3%）
 * - 支持参数 notify 控制是否推送手机通知（true开启，false关闭，默认开启）
 * - 面板展示当前各币种汇率及波动情况（带涨跌箭头和百分比）
 * - 通过持久化存储保存上次汇率，用于计算涨跌幅
 * - 支持自定义图标和图标颜色
 */

const url = "https://open.er-api.com/v6/latest/CNY"; // 汇率API地址，基准货币为人民币CNY
const params = getParams($argument); // 从脚本参数中解析参数对象
const threshold = parseFloat(params.threshold || "0.3"); // 波动阈值，默认0.3%
const enableNotify = (params.notify || "true").toLowerCase() === "true"; // 是否开启通知，默认开启

// 日志打印脚本执行时间（北京时间）
console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
// 日志打印当前通知开关状态
console.log(`[Exchange] 通知开关状态：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

$httpClient.get(url, function (error, response, data) {
  if (error) { // 请求出错时的处理
    console.log(`[Exchange] 请求失败：${error}`);
    $done({
      title: "汇率获取失败", // 通知标题
      content: "请求错误：" + error, // 通知内容
      icon: "xmark.octagon", // 通知图标
      "icon-color": "#FF3B30" // 图标颜色（红色）
    });
    return; // 退出脚本
  }

  let rates;
  try {
    const parsed = JSON.parse(data); // 解析返回的JSON数据
    rates = parsed.rates; // 提取汇率字段
    if (!rates) throw new Error("No rates field"); // 若无汇率字段，抛出异常
  } catch (e) {
    console.log(`[Exchange] 数据解析异常`);
    $done({
      title: "汇率获取失败",
      content: "数据解析异常",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  // 格式化数字，保留小数点位数，默认2位
  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

  // 定义要展示的币种及其汇率计算方法，单位统一换算为人民币（CNY）
  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  let content = ""; // 用于面板显示的汇率文本
  let fluctuations = []; // 用于记录超过阈值的汇率波动，做提醒和通知

  // 遍历每个币种
  for (const item of displayRates) {
    const current = item.value(); // 计算当前汇率
    const rounded = formatRate(current, item.decimals); // 格式化汇率值
    const prev = parseFloat($persistentStore.read("exrate_" + item.key)); // 读取上次存储的汇率

    if (!isNaN(prev)) { // 如果上次汇率存在，则计算涨跌幅
      const change = ((current - prev) / prev) * 100; // 计算涨跌百分比
      if (Math.abs(change) >= threshold) { // 若波动超过阈值
        const symbol = change > 0 ? "📈" : "📉"; // 涨用📈，跌用📉
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`; // 格式化涨跌字符串
        const detail = `当前汇率：${item.label} ${rounded}${item.suffix}`; // 详情内容

        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`); // 记录波动文字

        // 若通知开关开启，则发送本地推送通知
        if (enableNotify) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`, // 通知标题
            "", // 无副标题
            detail // 通知正文详情
          );
        }
      }
    }

    $persistentStore.write(String(current), "exrate_" + item.key); // 持久化存储当前汇率，供下次比较
    content += `${item.label} ${rounded}${item.suffix}\n`; // 拼接面板显示文本
  }

  // 如果检测到波动超过阈值，则将波动提醒追加到面板内容
  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}`;
    console.log(`[Exchange] 🚨 检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    console.log("[Exchange] ✅ 无汇率波动超出阈值");
  }

  // 获取当前时间（北京时间）格式化，用于面板标题显示
  const timestamp = new Date().toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });

  // 组装面板数据
  const panel = {
    title: `当前汇率信息 ${timestamp}`, // 面板标题带时间戳
    content: content.trim(), // 面板内容
    icon: params.icon || "bitcoinsign.circle", // 面板图标，默认bitcoin标志
    "icon-color": params.color || "#EF8F1C" // 图标颜色，默认橙色
  };

  // 日志打印最终刷新面板内容
  console.log("[Exchange] 刷新面板，内容如下：\n" + content);
  $done(panel); // 结束脚本并返回面板数据
});

// 解析脚本传入的参数字符串，返回参数对象
function getParams(param) {
  try {
    return Object.fromEntries(
      ($argument || "")
        .split("&") // 按&拆分参数
        .filter(Boolean) // 过滤空字符串
        .map(item => item.split("=")) // 按=拆分键值对
        .map(([k, v]) => [k, decodeURIComponent(v)]) // 解码参数值
    );
  } catch (e) {
    return {}; // 解析异常返回空对象
  }
}
