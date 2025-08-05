/**
 * 汇率监控脚本 - 多API+波动提醒+自定义兑换基数
 * 
 * 功能说明：
 * 1. 支持三个备选汇率API接口，自动轮询请求，单个接口失败自动切换到下一个，提升数据获取成功率；
 * 2. 支持自定义汇率波动阈值（threshold，默认0.3%），超过阈值时触发通知提醒，避免频繁通知；
 * 3. 支持开启或关闭通知推送（notify，默认开启），满足不同用户需求；
 * 4. 支持自定义兑换基数（base_amount，默认1），实现多金额换算展示；
 * 5. 默认以人民币（CNY）为基准货币，显示美元（USD）、欧元（EUR）、英镑（GBP）、港币（HKD）、日元（JPY）、韩元（KRW）、土耳其里拉（TRY）等常用货币的汇率换算；
 * 6. 汇率波动监控基于持久化缓存的上次汇率数据，精准检测汇率变化；
 * 7. 时间统一格式化为北京时间（Asia/Shanghai）中文时间字符串，适合中国用户阅读习惯；
 * 8. 脚本输出面板内容详细，包括各货币汇率详情、汇率波动提醒、数据来源、数据最后更新时间、预计下次更新时间；
 * 9. 详尽日志记录，便于调试与问题排查，包含请求接口、数据解析、缓存读写及通知发送情况；
 * 10. 具备良好异常和错误处理机制，保证脚本稳定运行，接口请求失败自动切换、数据解析异常重试；
 * 11. 面板刷新时自动显示当前北京时间，提升用户体验；
 * 12. 支持脚本参数传入，可灵活定制通知开关、波动阈值、兑换基数、面板图标及颜色。
 */

const urls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

const params = getParams($argument);
const threshold = parseFloat(params.threshold) || 0.3;
const enableNotify = (params.notify || "true").toLowerCase() === "true";
const baseAmount = parseFloat(params.base_amount) || 1;

logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
logInfo(`汇率波动阈值：${threshold}%`);
logInfo(`自定义兑换基数：${baseAmount}`);

function formatTimeToBeijing(timeInput) {
  if (!timeInput || timeInput === "未知") return "未知";

  let date;
  if (typeof timeInput === "number") {
    if (timeInput > 1e12) {
      // 毫秒时间戳（13位左右）
      date = new Date(timeInput);
    } else {
      // 秒时间戳（10位左右）
      date = new Date(timeInput * 1000);
    }
  } else if (/^\d{10,13}$/.test(timeInput)) {
    if (timeInput.length === 13) {
      date = new Date(Number(timeInput));
    } else if (timeInput.length === 10) {
      date = new Date(Number(timeInput) * 1000);
    } else {
      date = new Date(timeInput);
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(timeInput)) {
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

function logInfo(message) {
  console.log(`[Exchange] ${message}`);
}

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
        // 该接口time_last_updated为秒级时间戳
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

function formatRate(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const sourceDomain = sourceUrl.match(/https?:\/\/([^/]+)/)?.[1] || sourceUrl;
  let content = "";

  const displayRates = [
    { key: "USD", label: "美元", isBaseForeign: true, decimals: 2 },
    { key: "EUR", label: "欧元", isBaseForeign: true, decimals: 2 },
    { key: "GBP", label: "英镑", isBaseForeign: true, decimals: 2 },
    { key: "HKD", label: "港币", isBaseForeign: false, decimals: 2 },
    { key: "JPY", label: "日元", isBaseForeign: false, decimals: 0 },
    { key: "KRW", label: "韩元", isBaseForeign: false, decimals: 0 },
    { key: "TRY", label: "土耳其里拉", isBaseForeign: false, decimals: 2 }
  ];

  const flagMap = {
    CNY: "🇨🇳", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧",
    HKD: "🇭🇰", JPY: "🇯🇵", KRW: "🇰🇷", TRY: "🇹🇷"
  };

  let fluctuations = [];

  for (const item of displayRates) {
    if (!(item.key in rates)) {
      logInfo(`警告：${item.key} 数据缺失`);
      content += `${item.label} 数据缺失\n`;
      continue;
    }

    let amount, rateValue, text;

    if (item.isBaseForeign) {
      // 以人民币为基准，换算外币： amount人民币 / 汇率 = 外币数量
      amount = baseAmount;
      rateValue = baseAmount / rates[item.key];
      text = `${amount}${item.label}${flagMap[item.key]} ➡️ 人民币 ${formatRate(rateValue, item.decimals)}${flagMap.CNY}`;
    } else {
      // 以人民币为基准，换算外币： amount人民币 * 汇率 = 外币数量
      amount = baseAmount;
      rateValue = baseAmount * rates[item.key];
      text = `${amount}人民币${flagMap.CNY} ➡️ ${item.label} ${formatRate(rateValue, item.decimals)}${flagMap[item.key]}`;
    }

    logInfo(`汇率信息：${text}`);

    let prev = NaN;
    try {
      prev = parseFloat($persistentStore.read("exrate_" + item.key));
    } catch {
      prev = NaN;
    }

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

  content += `\n数据来源：${sourceDomain}\n数据更新时间：${lastUpdate}\n下次更新时间：${nextUpdate}`;

  logInfo(`刷新面板内容：\n${content}`);

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

fetchWithFallback(urls);
