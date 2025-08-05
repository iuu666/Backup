/**
 * 汇率监控脚本 - 多API+波动提醒+自定义兑换基数
 * 
 * 功能说明：
 * 1. 支持3个备选接口请求，失败自动切换；
 * 2. 支持自定义汇率波动阈值（threshold），默认0.3%；
 * 3. 支持开启/关闭通知推送（notify），默认开启；
 * 4. 支持自定义兑换基数（base_amount），默认1；
 * 5. 支持人民币基准，显示常用货币汇率（美元、欧元、英镑、港币、日元、韩元、土耳其里拉）；
 * 6. 汇率波动检测基于缓存上次数据，超过阈值时发送通知提醒；
 * 7. 时间统一格式化为北京时间（Asia/Shanghai）中文时间字符串；
 * 8. 面板显示汇率详情、波动提醒、数据来源、更新时间、下次更新时间；
 * 9. 详尽日志，异常和错误处理健壮。
 */

const urls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

// 解析脚本运行参数并设置默认值
const params = getParams($argument);
const threshold = parseFloat(params.threshold) || 0.3; // 波动阈值（百分比）
const enableNotify = (params.notify || "true").toLowerCase() === "true"; // 是否推送通知
const baseAmount = parseFloat(params.base_amount) || 1; // 兑换基数，默认1

logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
logInfo(`汇率波动阈值：${threshold}%`);
logInfo(`自定义兑换基数：${baseAmount}`);

/**
 * 将多种时间格式统一格式化为北京时间中文时间字符串
 * @param {string|number} timeInput 时间输入，支持时间戳、日期字符串等
 * @returns {string} 格式化后的北京时间字符串，失败返回"未知"或"时间格式异常"
 */
function formatTimeToBeijing(timeInput) {
  if (timeInput === undefined || timeInput === null || timeInput === "" || timeInput === "未知") return "未知";
  let date;
  if (typeof timeInput === "number" || (/^\d{9,}$/.test(timeInput))) {
    date = new Date(Number(timeInput) * 1000);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(timeInput)) {
    // 仅日期格式，转为UTC时间起点
    date = new Date(timeInput + "T00:00:00Z");
  } else {
    date = new Date(timeInput);
  }
  if (isNaN(date)) return "时间格式异常";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

/**
 * 统一日志打印，前缀标识
 * @param {string} message 日志信息
 */
function logInfo(message) {
  console.log(`[Exchange] ${message}`);
}

/**
 * 依次请求多个接口，支持失败自动切换
 * @param {string[]} urls 接口列表
 * @param {number} index 当前请求索引
 */
function fetchWithFallback(urls, index = 0) {
  if (index >= urls.length) {
    logInfo("❌ 所有接口请求均失败，脚本结束");
    $done({
      title: "汇率获取失败",
      content: "所有接口请求均失败",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  const url = urls[index];
  logInfo(`请求接口：${url}`);

  $httpClient.get(url, (error, response, data) => {
    if (error || !data) {
      logInfo(`请求失败：${error || "无响应"}，尝试下一个接口`);
      fetchWithFallback(urls, index + 1);
      return;
    }
    try {
      const parsed = JSON.parse(data);
      let rates, lastUpdate, nextUpdate;

      if (url.includes("open.er-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.time_last_update_utc);
        nextUpdate = formatTimeToBeijing(parsed.time_next_update_utc);
      } else if (url.includes("api.exchangerate-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.time_last_updated);
        nextUpdate = "未知";
      } else if (url.includes("api.frankfurter.app")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.date);
        nextUpdate = "未知";
      } else {
        throw new Error("未知接口格式");
      }

      logInfo(`数据获取成功，接口：${url.match(/https?:\/\/([^/]+)/)[1]}`);
      logInfo(`数据最后更新时间（北京时间）：${lastUpdate}`);
      logInfo(`预计下一次更新时间（北京时间）：${nextUpdate}`);

      processData(rates, lastUpdate, nextUpdate, url);
    } catch (e) {
      logInfo(`数据解析异常：${e.message || e}，尝试下一个接口`);
      fetchWithFallback(urls, index + 1);
    }
  });
}

/**
 * 格式化汇率数字，默认保留2位小数
 * @param {number} value 汇率数字
 * @param {number} decimals 小数位数
 * @returns {string} 格式化字符串
 */
function formatRate(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

/**
 * 处理汇率数据，检测波动，发送通知，构建面板内容
 * @param {object} rates 汇率数据
 * @param {string} lastUpdate 最后更新时间（北京时间）
 * @param {string} nextUpdate 下次更新时间（北京时间）
 * @param {string} sourceUrl 数据来源URL
 */
function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const sourceDomain = sourceUrl.match(/https?:\/\/([^/]+)/)?.[1] || sourceUrl;
  let content = "";

  // 配置显示货币及对应属性
  const displayRates = [
    { key: "USD", label: "美元", isBaseForeign: true, suffix: "🇨🇳", decimals: 2 },
    { key: "EUR", label: "欧元", isBaseForeign: true, suffix: "🇨🇳", decimals: 2 },
    { key: "GBP", label: "英镑", isBaseForeign: true, suffix: "🇨🇳", decimals: 2 },
    { key: "HKD", label: "港币", isBaseForeign: false, suffix: "🇭🇰", decimals: 2 },
    { key: "JPY", label: "日元", isBaseForeign: false, suffix: "🇯🇵", decimals: 0 },
    { key: "KRW", label: "韩元", isBaseForeign: false, suffix: "🇰🇷", decimals: 0 },
    { key: "TRY", label: "土耳其里拉", isBaseForeign: false, suffix: "🇹🇷", decimals: 2 }
  ];

  let fluctuations = [];

  // 遍历货币，计算汇率，检测波动
  for (const item of displayRates) {
    if (!(item.key in rates)) {
      logInfo(`警告：${item.key} 数据缺失`);
      content += `${item.label} 数据缺失\n`;
      continue;
    }

    let amount, rateValue, text;

    // 外币兑人民币显示格式：{baseAmount} 外币兑换人民币 x.xx
    // 人民币兑外币显示格式：{baseAmount} 人民币兑换外币 x.xx
    if (item.isBaseForeign) {
      amount = baseAmount;
      rateValue = baseAmount / rates[item.key];
      text = `${amount}${item.label}兑换人民币 ${formatRate(rateValue, item.decimals)}${item.suffix}`;
    } else {
      amount = baseAmount;
      rateValue = baseAmount * rates[item.key];
      text = `${amount}人民币兑换${item.label} ${formatRate(rateValue, item.decimals)}${item.suffix}`;
    }

    // 读取缓存的上次汇率
    const prev = parseFloat($persistentStore.read("exrate_" + item.key));
    if (!isNaN(prev)) {
      const change = ((rateValue - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);

        if (enableNotify) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
            "",
            `当前汇率：${text}`
          );
          logInfo(`通知发送：${item.key} ${change > 0 ? "上涨" : "下跌"} ${changeStr}`);
        }
      }
    }

    // 缓存当前汇率
    try {
      $persistentStore.write(String(rateValue), "exrate_" + item.key);
      logInfo(`缓存写入：${item.key} = ${formatRate(rateValue, item.decimals)}`);
    } catch (e) {
      logInfo(`缓存写入异常：${e.message || e}`);
    }

    content += text + "\n";
  }

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
    logInfo(`检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    logInfo("无汇率波动超出阈值");
  }

  // 面板内容最后显示数据来源及时间
  content += `\n数据来源：${sourceDomain}\n数据更新时间：${lastUpdate}\n下次更新时间：${nextUpdate}`;

  logInfo(`刷新面板内容：\n${content}`);

  // 当前北京时间时分秒，用于面板标题
  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  // 返回面板数据
  $done({
    title: `当前汇率信息 ${beijingTime}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

/**
 * 解析传入参数，支持URI编码解码，失败返回空对象
 * @param {string} paramStr 传入参数字符串
 * @returns {object} 解析后的键值对对象
 */
function getParams(paramStr) {
  try {
    return Object.fromEntries(
      (paramStr || $argument || "")
        .split("&")
        .filter(Boolean)
        .map(item => item.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
  } catch {
    return {};
  }
}

// 启动请求流程
fetchWithFallback(urls);
