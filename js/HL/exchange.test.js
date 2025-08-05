/**
 * 汇率监控脚本（多接口，支持open.er-api.com、exchangerate-api.com、frankfurter.app）
 * 统一时间格式，显示北京时间中文格式，自动切换接口
 * 
 * 参数支持：
 * threshold - 波动阈值，默认0.3
 * notify - 是否开启通知，true或false，默认true
 * icon - 面板图标
 * color - 图标颜色
 */

const urls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

const params = getParams($argument);
const threshold = parseFloat(params.threshold || "0.3");
const enableNotify = (params.notify || "true").toLowerCase() === "true";

console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
console.log(`[Exchange] 通知开关状态：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

/**
 * 统一时间格式转换，支持多种格式，输出北京时间中文标准格式
 * @param {string|number} timeInput - 时间输入，支持UTC字符串、ISO字符串、Unix时间戳秒、日期字符串
 * @returns {string} 北京时间格式，格式如 2025-08-05 08:00:00；格式错误返回“时间格式异常”；空或无效返回“未知”
 */
function formatAnyToBeijing(timeInput) {
  if (timeInput === undefined || timeInput === null || timeInput === "" || timeInput === "未知") {
    return "未知";
  }

  let date;

  if ((typeof timeInput === "number") || (/^\d{9,}$/.test(timeInput))) {
    date = new Date(Number(timeInput) * 1000);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(timeInput)) {
    // frankfurter只提供日期，默认当日0点UTC时间，转北京时间
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
 * 递归请求接口，失败自动切换
 */
function fetchWithFallback(urls, index = 0) {
  if (index >= urls.length) {
    $done({
      title: "汇率获取失败",
      content: "所有接口请求均失败",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }
  const url = urls[index];
  $httpClient.get(url, (error, response, data) => {
    if (error || !data) {
      console.log(`[Exchange] 第${index + 1}个接口请求失败，切换下一个`);
      fetchWithFallback(urls, index + 1);
      return;
    }
    try {
      const parsed = JSON.parse(data);
      let rates, lastUpdate, nextUpdate;

      if (url.includes("open.er-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatAnyToBeijing(parsed.time_last_update_utc);
        nextUpdate = formatAnyToBeijing(parsed.time_next_update_utc);
      } else if (url.includes("api.exchangerate-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatAnyToBeijing(parsed.time_last_updated);
        nextUpdate = "未知";
      } else if (url.includes("api.frankfurter.app")) {
        rates = parsed.rates;
        lastUpdate = formatAnyToBeijing(parsed.date);
        nextUpdate = "未知";
      } else {
        throw new Error("未知接口格式");
      }

      processData(rates, lastUpdate, nextUpdate, url);
    } catch {
      console.log(`[Exchange] 数据解析异常或格式错误，尝试下一个接口`);
      fetchWithFallback(urls, index + 1);
    }
  });
}

/**
 * 格式化数字，默认保留2位小数
 */
function formatRate(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

/**
 * 汇率处理及波动检测，生成面板数据
 * @param {*} rates 汇率对象
 * @param {*} lastUpdate 更新时间字符串
 * @param {*} nextUpdate 下次更新时间字符串
 * @param {*} sourceUrl 当前接口URL
 */
function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const sourceDomain = sourceUrl.match(/https?:\/\/([^/]+)/)?.[1] || sourceUrl;

  let content = "";

  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换人民币", value: () => 1 / rates.USD, suffix: "🇨🇳", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换人民币", value: () => 1 / rates.EUR, suffix: "🇨🇳", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换人民币", value: () => 1 / rates.GBP, suffix: "🇨🇳", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换港币", value: () => rates.HKD, suffix: "🇭🇰", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换日元", value: () => rates.JPY, suffix: "🇯🇵", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换韩元", value: () => rates.KRW, suffix: "🇰🇷", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换土耳其里拉", value: () => rates.TRY, suffix: "🇹🇷", decimals: 2 }
  ];

  let fluctuations = [];

  for (const item of displayRates) {
    if (!(item.key in rates)) {
      content += `${item.label} 数据缺失\n`;
      continue;
    }
    const current = item.value();
    const rounded = formatRate(current, item.decimals);
    const prev = parseFloat($persistentStore.read("exrate_" + item.key));
    if (!isNaN(prev)) {
      const change = ((current - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);
        if (enableNotify) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
            "",
            `当前汇率：${item.label} ${rounded}${item.suffix}`
          );
        }
      }
    }
    $persistentStore.write(String(current), "exrate_" + item.key);
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
    console.log(`[Exchange] 🚨 检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    console.log("[Exchange] ✅ 无汇率波动超出阈值");
  }

  // 在内容最后加空行，再拼数据来源和时间
  content += `\n数据来源：${sourceDomain}\n数据更新时间：${lastUpdate}\n下次更新时间：${nextUpdate}`;

  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  $done({
    title: `当前汇率信息 ${beijingTime}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

/**
 * 解析脚本传入参数
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

// 启动请求
fetchWithFallback(urls);
