const googleCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"];
const baseCurrency = "CNY";

const apiUrls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

const params = getParams($argument);
const thresholdRaw = parseFloat(params.threshold);
const threshold = (isNaN(thresholdRaw) || thresholdRaw <= 0) ? 0.3 : thresholdRaw;
const enableNotify = (params.notify || "true").toLowerCase() === "true";
const strongAmountRaw = parseFloat(params.base_strong);
const strongAmount = (isNaN(strongAmountRaw) || strongAmountRaw <= 0) ? 1 : strongAmountRaw;
const weakAmountRaw = parseFloat(params.base_weak);
const weakAmount = (isNaN(weakAmountRaw) || weakAmountRaw <= 0) ? 1 : weakAmountRaw;
const notifyCooldownMinutesRaw = parseInt(params.notify_cooldown);
const notifyCooldownMinutes = (isNaN(notifyCooldownMinutesRaw) || notifyCooldownMinutesRaw <= 0) ? 5 : notifyCooldownMinutesRaw;

logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
logInfo(`汇率波动阈值：${threshold}%`);
logInfo(`兑换基数（强势币）：${strongAmount}，兑换基数（弱势币）：${weakAmount}`);
logInfo(`通知冷却时间：${notifyCooldownMinutes} 分钟`);

let globalGoogleResult = null;  // 记录谷歌结果
let globalApiResult = null;     // 记录API补充结果

// 主入口，先尝试谷歌财经抓取所有币种
fetchFromGoogle((googleResult) => {
  if (googleResult && Object.keys(googleResult.rates).length > 0) {
    globalGoogleResult = googleResult;
    // 检查哪些币种缺失
    const missingCurrencies = googleCurrencies.filter(c => !(c in googleResult.rates));
    if (missingCurrencies.length === 0) {
      // 全部抓取成功，直接处理
      logInfo("谷歌财经所有币种均抓取成功，无需API补充");
      processData(googleResult.rates, googleResult.lastUpdate, googleResult.nextUpdate, null);
    } else {
      logInfo(`谷歌财经部分币种缺失，开始用API补充缺失币种：${missingCurrencies.join(", ")}`);
      // 用API补充缺失币种
      fetchFromApiForCurrencies(missingCurrencies, (apiResult) => {
        globalApiResult = apiResult;
        // 合并谷歌和API结果（以API补充缺失币种）
        const combinedRates = { ...googleResult.rates, ...apiResult.rates };
        processData(combinedRates, null, null, null); // 数据更新时间统一在 processData 里单独处理
      });
    }
  } else {
    // 谷歌财经抓取完全失败，整体用API接口fallback
    logInfo("谷歌财经抓取失败，开始使用API接口fallback");
    fetchWithFallback(apiUrls, 0);
  }
});

// 从谷歌财经抓取函数，保持不变
function fetchFromGoogle(callback) {
  const results = {};
  let completed = 0;
  let hasError = false;
  let lastUpdateTimestamp = 0;

  function tryFinish() {
    completed++;
    if (completed === googleCurrencies.length) {
      if (hasError && Object.keys(results).length === 0) {
        callback(null);
        return;
      }
      // 转换成基准CNY的rates
      const rates = {};
      for (const curr of googleCurrencies) {
        if (curr === baseCurrency) {
          rates[curr] = 1;
        } else if (results[curr]) {
          rates[curr] = 1 / results[curr];
        }
      }
      const lastUpdate = formatTimeToBeijing(lastUpdateTimestamp * 1000);
      const nextUpdate = "未知";
      logInfo(`谷歌财经所有币种汇率抓取完成，时间：${lastUpdate}`);
      callback({ rates, lastUpdate, nextUpdate });
    }
  }

  for (const curr of googleCurrencies) {
    if (curr === baseCurrency) {
      results[curr] = 1;
      tryFinish();
      continue;
    }
    const url = `https://www.google.com/finance/quote/${curr}-${baseCurrency}`;
    logInfo(`请求谷歌财经汇率页面：${url}`);
    $httpClient.get(url, (error, response, data) => {
      if (error || !data) {
        logInfo(`谷歌财经请求失败：${curr} - ${error || "无响应"}`);
        hasError = true;
        tryFinish();
        return;
      }
      try {
        const regex = /<div[^>]*data-source="(\w+)"[^>]*data-target="(\w+)"[^>]*data-last-price="([\d\.]+)"[^>]*data-last-normal-market-timestamp="(\d+)"[^>]*>/g;
        let match, foundRate = null, foundTimestamp = null;
        while ((match = regex.exec(data)) !== null) {
          const [_, source, target, priceStr, tsStr] = match;
          if (source === curr && target === baseCurrency) {
            foundRate = parseFloat(priceStr);
            foundTimestamp = parseInt(tsStr);
            break;
          }
        }
        if (foundRate === null) {
          logInfo(`未找到${curr}≈${baseCurrency}汇率`);
          hasError = true;
        } else {
          results[curr] = foundRate;
          if (foundTimestamp > lastUpdateTimestamp) lastUpdateTimestamp = foundTimestamp;
          logInfo(`谷歌财经抓取${curr}≈${baseCurrency}汇率成功：${foundRate}`);
        }
      } catch (e) {
        logInfo(`解析${curr}汇率异常：${e.message || e}`);
        hasError = true;
      }
      tryFinish();
    });
  }
}

// 用API补充部分币种汇率
function fetchFromApiForCurrencies(currencyList, callback) {
  let apiIndex = 0;

  function tryApiFetch() {
    if (apiIndex >= apiUrls.length) {
      logInfo("❌ 所有接口请求均失败，补充币种失败");
      callback({ rates: {}, lastUpdate: "未知", nextUpdate: "未知" });
      return;
    }
    const url = apiUrls[apiIndex];
    logInfo(`补充接口请求：${url}`);
    $httpClient.get(url, (error, response, data) => {
      if (error || !data) {
        logInfo(`请求失败：${error || "无响应"}，尝试下一个接口`);
        apiIndex++;
        tryApiFetch();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        let ratesRaw, lastUpdateRaw, nextUpdateRaw;
        if (url.includes("open.er-api.com")) {
          ratesRaw = parsed.rates;
          lastUpdateRaw = parsed.time_last_update_utc;
          nextUpdateRaw = parsed.time_next_update_utc;
        } else if (url.includes("api.exchangerate-api.com")) {
          ratesRaw = parsed.rates;
          lastUpdateRaw = parsed.time_last_updated * 1000 || parsed.time_last_updated;
          nextUpdateRaw = "未知";
        } else if (url.includes("api.frankfurter.app")) {
          ratesRaw = parsed.rates;
          lastUpdateRaw = parsed.date;
          nextUpdateRaw = "未知";
        } else {
          throw new Error("未知接口格式");
        }
        const filteredRates = {};
        for (const cur of currencyList) {
          if (cur === baseCurrency) {
            filteredRates[cur] = 1;
          } else if (ratesRaw && ratesRaw[cur] !== undefined) {
            filteredRates[cur] = ratesRaw[cur];
          }
        }
        if (Object.keys(filteredRates).length > 0) {
          logInfo(`补充接口数据获取成功，接口：${url.match(/https?:\/\/([^/]+)/)[1]}`);
          callback({
            rates: filteredRates,
            lastUpdate: formatTimeToBeijing(lastUpdateRaw),
            nextUpdate: formatTimeToBeijing(nextUpdateRaw)
          });
        } else {
          logInfo(`补充接口无目标币种数据，尝试下一个接口`);
          apiIndex++;
          tryApiFetch();
        }
      } catch (e) {
        logInfo(`补充接口数据解析异常：${e.message || e}，尝试下一个接口`);
        apiIndex++;
        tryApiFetch();
      }
    });
  }

  tryApiFetch();
}

// 失败时用API接口fallback抓取（整体抓取），保持不变
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
        lastUpdate = formatTimeToBeijing(parsed.time_last_updated * 1000 || parsed.time_last_updated);
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

// 修改processData，增加同时显示网页和API更新时间和下次更新时间
function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  // 区分数据来源
  // 传入的 sourceUrl 在补充合并时可能是 null
  // 这里使用全局变量 globalGoogleResult 和 globalApiResult 来区分更新时间

  const sourceLabel = (typeof sourceUrl === "string" && sourceUrl.toLowerCase().includes("google")) ? "网页" :
    (sourceUrl && sourceUrl.toLowerCase().includes("api")) ? "API" :
    (globalGoogleResult && globalApiResult) ? "网页+API" : "API";

  let content = "";
  const displayRates = [
    { key: "USD", label: "美元", isBaseForeign: true, decimals: 2 },
    { key: "EUR", label: "欧元", isBaseForeign: true, decimals: 2 },
    { key: "GBP", label: "英镑", isBaseForeign: true, decimals: 2 },
    { key: "HKD", label: "港币", isBaseForeign: false, decimals: 2 },
    { key: "JPY", label: "日元", isBaseForeign: false, decimals: 0 },
    { key: "KRW", label: "韩元", isBaseForeign: false, decimals: 0 },
    { key: "TRY", label: "里拉", isBaseForeign: false, decimals: 2 }
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

    const amount = item.isBaseForeign ? strongAmount : weakAmount;
    let rateValue, text;
    if (item.isBaseForeign) {
      // 美元、欧元、英镑: 币种兑换人民币
      rateValue = amount / rates[item.key];
      text = `${amount}${item.label}${flagMap[item.key]} ≈ 人民币 ${formatRate(rateValue, item.decimals)}${flagMap.CNY}`;
    } else {
      // 港币、日元、韩元、里拉: 人民币兑换币种
      rateValue = amount * rates[item.key];
      text = `${amount}人民币${flagMap.CNY} ≈ ${item.label} ${formatRate(rateValue, item.decimals)}${flagMap[item.key]}`;
    }

    content += `${text} （${sourceLabel}）\n`;

    logInfo(`汇率信息：${text} （${sourceLabel}）`);

    let prev = NaN;
    try {
      const cacheStr = $persistentStore.read("exrate_" + item.key);
      prev = cacheStr !== null ? parseFloat(cacheStr) : NaN;
    } catch {
      prev = NaN;
    }

    if (!isNaN(prev)) {
      const change = ((rateValue - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);
        if (enableNotify && canNotify(item.key)) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
            "",
            `当前汇率：${text}`
          );
          logInfo(`通知发送：${item.key} ${change > 0 ? "上涨" : "下跌"} ${changeStr}`);
          setNotifyTime(item.key);
        }
      }
    }

    try {
      $persistentStore.write(String(rateValue), "exrate_" + item.key);
      logInfo(`缓存写入：${item.key} = ${formatRate(rateValue, item.decimals)}`);
    } catch (e) {
      logInfo(`缓存写入异常：${e.message || e}`);
    }
  }

  // 添加波动提醒内容
  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
    logInfo(`检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    logInfo("无汇率波动超出阈值");
  }

  // ======= 新增：同时显示网页和API的更新时间，未知不显示 =======
  let lastUpdateContent = "";
  if (globalGoogleResult && globalGoogleResult.lastUpdate && globalGoogleResult.lastUpdate !== "未知") {
    lastUpdateContent += `数据更新时间（网页）：${globalGoogleResult.lastUpdate}\n`;
  }
  if (globalApiResult && globalApiResult.lastUpdate && globalApiResult.lastUpdate !== "未知") {
    lastUpdateContent += `数据更新时间（API）：${globalApiResult.lastUpdate}\n`;
  }
  if (globalGoogleResult && globalGoogleResult.nextUpdate && globalGoogleResult.nextUpdate !== "未知") {
    lastUpdateContent += `下次更新时间（网页）：${globalGoogleResult.nextUpdate}\n`;
  }
  if (globalApiResult && globalApiResult.nextUpdate && globalApiResult.nextUpdate !== "未知") {
    lastUpdateContent += `下次更新时间（API）：${globalApiResult.nextUpdate}\n`;
  }
  content += `\n${lastUpdateContent.trim()}`;
  // ======= 新增结束 =======

  // panel 标题时间显示北京时间
  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  $done({
    title: `汇率信息 ${beijingTime}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

function formatTimeToBeijing(timeInput) {
  if (!timeInput || timeInput === "未知") return "未知";
  let date = null;
  if (typeof timeInput === "number") {
    if (timeInput > 1e12) {
      date = new Date(timeInput);
    } else if (timeInput > 1e10) {
      date = new Date(timeInput);
    } else {
      date = new Date(timeInput * 1000);
    }
  } else if (typeof timeInput === "string") {
    const s = timeInput.trim();
    if (/^\d{10,13}$/.test(s)) {
      if (s.length === 13) {
        date = new Date(Number(s));
      } else if (s.length === 10) {
        date = new Date(Number(s) * 1000);
      }
    } else if (/^\d{4}-\d{2}-\d{2}(T.*)?(Z|[\+\-]\d{2}:?\d{2})?$/.test(s)) {
      date = new Date(s);
    } else {
      date = new Date(s);
    }
  }
  if (!(date instanceof Date) || isNaN(date)) return "时间格式异常";
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
  const timeStr = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  console.log(`[Exchange ${timeStr}] ${message}`);
}

function canNotify(key) {
  try {
    const lastNotify = parseInt($persistentStore.read("notify_time_" + key)) || 0;
    return Date.now() - lastNotify > notifyCooldownMinutes * 60 * 1000;
  } catch {
    return true;
  }
}

function setNotifyTime(key) {
  try {
    $persistentStore.write(String(Date.now()), "notify_time_" + key);
  } catch (e) {
    logInfo(`通知时间写入异常：${e.message || e}`);
  }
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

function formatRate(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}
