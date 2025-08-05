/**
 * 汇率监控脚本
 * 
 * 功能说明：
 * 1. 通过 https://open.er-api.com/v6/latest/CNY 获取人民币基准的最新汇率数据
 * 2. 支持自定义汇率波动阈值（默认0.3%），超过阈值时发送通知提醒
 * 3. 支持参数 notify 控制是否推送手机通知（true开启，false关闭，默认开启）
 * 4. Surge面板展示当前各币种汇率及波动情况（带涨跌箭头和百分比）
 * 5. 通过持久化存储保存上次汇率，用于计算涨跌幅
 * 6. 支持自定义图标和图标颜色
 * 7. 支持配置参数传入
 */

const url = "https://open.er-api.com/v6/latest/CNY"; // 汇率API地址，基准货币为人民币CNY
const params = getParams($argument); // 解析脚本运行时传入的参数
const threshold = parseFloat(params.threshold || "0.3"); // 汇率波动阈值，默认0.3%
const enableNotify = (params.notify || "true").toLowerCase() === "true"; // 是否开启通知，默认开启

// 日志打印脚本执行时间（北京时间）
console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
console.log(`[Exchange] 通知开关状态：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

/**
 * 将UTC时间字符串格式化为北京时间的中文时间字符串
 * @param {string} utcStr - UTC时间字符串，如 "Wed, 05 Aug 2025 06:00:00 +0000"
 * @returns {string} 格式化后的北京时间字符串，格式：yyyy-MM-dd HH:mm:ss
 */
function formatUTCToBeijing(utcStr) {
  if (!utcStr || utcStr === "未知") return "未知"; // 无效时间处理
  const date = new Date(utcStr);
  if (isNaN(date)) return "时间格式异常"; // 时间格式异常处理
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", // 指定北京时间时区
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false // 24小时制
  });
}

// 发送HTTP GET请求获取汇率数据
$httpClient.get(url, function (error, response, data) {
  if (error) {
    // 请求失败时记录日志并结束脚本，面板提示请求失败
    console.log(`[Exchange] 请求失败：${error}`);
    $done({
      title: "汇率获取失败",
      content: "请求错误：" + error,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  let rates, lastUpdate, nextUpdate;
  try {
    // 尝试解析返回的JSON数据
    const parsed = JSON.parse(data);
    rates = parsed.rates; // 汇率数据字段
    if (!rates) throw new Error("无汇率字段");

    // 格式化API返回的更新时间和下次更新时间为北京时间字符串
    lastUpdate = formatUTCToBeijing(parsed.time_last_update_utc);
    nextUpdate = formatUTCToBeijing(parsed.time_next_update_utc);

    // 记录时间日志
    console.log(`[Exchange] 数据最后更新时间（北京时间）：${lastUpdate}`);
    console.log(`[Exchange] 预计下一次更新时间（北京时间）：${nextUpdate}`);
  } catch (e) {
    // 数据解析异常时日志输出并结束脚本，面板提示数据异常
    console.log(`[Exchange] 数据解析异常`);
    $done({
      title: "汇率获取失败",
      content: "数据解析异常",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  /**
   * 格式化汇率数字，默认保留2位小数
   * @param {number} value - 数字
   * @param {number} decimals - 小数位数，默认2
   * @returns {string} 格式化后的字符串
   */
  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

  // 需要显示的币种及其兑换计算规则配置
  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  let content = ""; // 面板币种信息内容累积
  let fluctuations = []; // 记录超过阈值的波动信息

  // 遍历币种，计算当前汇率，检测波动，并生成面板内容
  for (const item of displayRates) {
    const current = item.value(); // 当前汇率计算
    const rounded = formatRate(current, item.decimals); // 格式化小数
    const prev = parseFloat($persistentStore.read("exrate_" + item.key)); // 读取上次缓存汇率

    if (!isNaN(prev)) {
      // 计算波动百分比
      const change = ((current - prev) / prev) * 100;
      // 判断是否超过阈值触发提醒
      if (Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        const detail = `当前汇率：${item.label} ${rounded}${item.suffix}`;

        // 组装波动提醒文本
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);

        // 如果通知开关开启，则发送系统通知
        if (enableNotify) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
            "",
            detail
          );
        }
      }
    }

    // 缓存当前汇率，供下次比较使用
    $persistentStore.write(String(current), "exrate_" + item.key);
    // 拼接币种汇率信息文本
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  // 如果有波动信息，则在面板内容中追加波动提醒段落
  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}`;
    console.log(`[Exchange] 🚨 检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    console.log("[Exchange] ✅ 无汇率波动超出阈值");
  }

  // 获取当前北京时间，用于标题显示时刻
  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  // 构建面板数据
  const panel = {
    // 标题简洁显示当前汇率信息及当前北京时间
    title: `当前汇率信息 ${beijingTime}`,
    // 内容显示数据更新时间、下次更新时间（下方空一行），以及币种兑换信息
    content: `数据更新时间：${lastUpdate}\n下次更新时间：${nextUpdate}\n\n${content.trim()}`,
    icon: params.icon || "bitcoinsign.circle", // 面板图标，可通过参数覆盖
    "icon-color": params.color || "#EF8F1C"    // 图标颜色，可通过参数覆盖
  };

  // 输出面板内容日志
  console.log("[Exchange] 刷新面板，内容如下：\n" + content);

  // 完成脚本，返回面板数据
  $done(panel);
});

/**
 * 解析脚本参数函数
 * @param {string} param - 参数字符串，例如 "threshold=0.5&notify=true"
 * @returns {object} 返回参数对象
 */
function getParams(param) {
  try {
    return Object.fromEntries(
      (param || $argument || "")
        .split("&")            // 按 & 拆分键值对
        .filter(Boolean)       // 过滤空字符串
        .map(item => item.split("=")) // 分割键和值
        .map(([k, v]) => [k, decodeURIComponent(v)]) // URI 解码
    );
  } catch {
    return {}; // 解析失败返回空对象
  }
}
