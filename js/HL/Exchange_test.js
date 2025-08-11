// 汇率源配置与基准币种设置 
const googleCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"];
const baseCurrency = "CNY";

// 汇率API接口列表，依次备用
const apiUrls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

// 推荐的参数解析，兼容 Surge 的模块参数传入格式
const params = (() => {
  if (typeof $argument !== "undefined") {
    return Object.fromEntries(
      $argument.split("&").map(p => {
        const [key, value = ""] = p.split("=");
        return [key.trim(), decodeURIComponent(value)];
      })
    );
  }
  return {};
})();

// 参数解析与默认值设置 
const thresholdRaw = parseFloat(params.threshold);
const threshold = (isNaN(thresholdRaw) || thresholdRaw <= 0) ? 0.1 : thresholdRaw;
const enableNotify = (params.notify || "true").toLowerCase() === "true";
const strongAmountRaw = parseFloat(params.base_strong);
const strongAmount = (isNaN(strongAmountRaw) || strongAmountRaw <= 0) ? 1 : strongAmountRaw;
const weakAmountRaw = parseFloat(params.base_weak);
const weakAmount = (isNaN(weakAmountRaw) || weakAmountRaw <= 0) ? 1 : weakAmountRaw;
const notifyCooldownMinutesRaw = parseInt(params.notify_cooldown);
const notifyCooldownMinutes = (isNaN(notifyCooldownMinutesRaw) || notifyCooldownMinutesRaw <= 0) ? 5 : notifyCooldownMinutesRaw;

// 调试日志，打印脚本执行时间（北京时间）
logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
// 打印通知开关状态
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
// 打印汇率波动阈值
logInfo(`汇率波动阈值：${threshold}%`);
// 打印兑换基数设置
logInfo(`兑换基数（强势币）：${strongAmount}，兑换基数（弱势币）：${weakAmount}`);
// 打印通知冷却时间
logInfo(`通知冷却时间：${notifyCooldownMinutes} 分钟`);

let globalGoogleResult = null;
let globalApiResult = null;

// 主入口，网页抓取所有币种汇率，用API补充缺失币种数据
fetchFromGoogle((googleResult) => {
  if (googleResult && Object.keys(googleResult.rates).length > 0) {
    globalGoogleResult = googleResult;
    const missingCurrencies = googleCurrencies.filter(c => !(c in googleResult.rates));
    if (missingCurrencies.length === 0) {
      logInfo("谷歌财经所有币种均抓取成功，无需API补充");
      processData(googleResult.rates, googleResult.lastUpdate, googleResult.nextUpdate, null);
    } else {
      logInfo(`谷歌财经部分币种缺失，开始用API补充缺失币种：${missingCurrencies.join(", ")}`);
      fetchFromApiForCurrencies(missingCurrencies, (apiResult) => {
        globalApiResult = apiResult;
        const combinedRates = { ...googleResult.rates, ...apiResult.rates };
        processData(combinedRates, null, null, null);
      });
    }
  } else {
    logInfo("谷歌财经抓取失败，开始使用API接口fallback");
    fetchWithFallback(apiUrls, 0);
  }
});

// 从网页抓取函数
function fetchFromGoogle(callback) {
  const results = {};
  let completed = 0;
  let hasError = false;
  let lastUpdateTimestamp = 0;

  // 请求完成后调用此函数检测是否所有请求都完成
  function tryFinish() {
    completed++;
    if (completed === googleCurrencies.length) {
      if (hasError && Object.keys(results).length === 0) {
        callback(null);
        return;
      }
      // 转换成基准CNY的rates（网页数据是币种兑CNY汇率，这里转为CNY兑币种汇率）
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

  // 对每个币种请求对应的网页页面
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

// 用API补充部分币种汇率，参数是缺失币种列表和回调函数
function fetchFromApiForCurrencies(currencyList, callback) {
  let apiIndex = 0;

  // 尝试用当前API接口请求数据
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

// 失败时用API接口fallback抓取（整体抓取所有币种）
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

// 处理汇率数据并生成面板内容，逐条显示数据来源
function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const googleRates = globalGoogleResult?.rates || {};
  const apiRates = globalApiResult?.rates || {};

  const displayRates = [
    { key: "USD", label: "美元", isBaseForeign: true, decimals: 2 },
    { key: "EUR", label: "欧元", isBaseForeign: true, decimals: 2 },
    { key: "GBP", label: "英镑", isBaseForeign: true, decimals: 2 },
    { key: "HKD", label: "港币", isBaseForeign: false, decimals: 2 },
    { key: "JPY", label: "日元", isBaseForeign: false, decimals: 0 },
    { key: "KRW", label: "韩元", isBaseForeign: false, decimals: 0 },
    { key: "TRY", label: "里拉", isBaseForeign: false, decimals: 2 }
  ];
  
  //国旗emoji
  const flagMap = {
    CNY: "🇨🇳", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧",
    HKD: "🇭🇰", JPY: "🇯🇵", KRW: "🇰🇷", TRY: "🇹🇷"
  };

  const nameMap = {
    USD: "美元", EUR: "欧元", GBP: "英镑",
    HKD: "港币", JPY: "日元", KRW: "韩元", TRY: "里拉"
  };

  let content = "";
  let fluctuations = [];

  for (const item of displayRates) {
    let rateValue;
    let sourceLabel = "";

    if (googleRates[item.key] !== undefined) {
      sourceLabel = "WEB";
      rateValue = item.isBaseForeign
        ? strongAmount / googleRates[item.key]
        : weakAmount * googleRates[item.key];
    } else if (apiRates[item.key] !== undefined) {
      sourceLabel = "API";
      rateValue = item.isBaseForeign
        ? strongAmount / apiRates[item.key]
        : weakAmount * apiRates[item.key];
    } else {
      logInfo(`警告：${item.key} 数据缺失`);
      content += `${item.label} 数据缺失\n`;
      continue;
    }
    
    //显示国旗
    const text = item.isBaseForeign
      ? `${strongAmount}${item.label}${flagMap[item.key]} ≈ 人民币 ${formatRate(rateValue, item.decimals)}${flagMap.CNY}`
      : `${weakAmount}人民币${flagMap.CNY} ≈ ${item.label} ${formatRate(rateValue, item.decimals)}${flagMap[item.key]}`;
    /* 不显示国旗，需要同时注释掉上面的国旗emoji
    const text = item.isBaseForeign
      ? `${strongAmount}${item.label} ≈ 人民币 ${formatRate(rateValue, item.decimals)}`
      : `${weakAmount}人民币 ≈ ${item.label} ${formatRate(rateValue, item.decimals)}`;
    */
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

      // —— 这里是波动提醒格式替换开始 —— 
      if (Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "↑" : "↓";
        const sign = change > 0 ? "+" : "-";
        const absChange = Math.abs(change).toFixed(2);
        const changeStr = `${symbol} ${sign}${absChange}%`;

        // 构造波动提醒文本，例如：美元：↑ +0.45%
        fluctuations.push(`${nameMap[item.key]}：${changeStr}`);

        if (enableNotify && canNotify(item.key)) {
          logInfo(`准备发送通知：${item.key}`);
          $notification.post(
            `${symbol} ${nameMap[item.key]} ${sign}${absChange}%`,
            "",
            `当前汇率：${text}`
          );
          logInfo(`通知发送：${item.key} ${change > 0 ? "上涨" : "下跌"} ${changeStr}`);
          setNotifyTime(item.key);
        }
      }
      // —— 波动提醒格式替换结束 —— 
    }

    try {
      $persistentStore.write(String(rateValue), "exrate_" + item.key);
      logInfo(`缓存写入：${item.key} = ${formatRate(rateValue, item.decimals)}`);
    } catch (e) {
      logInfo(`缓存写入异常：${e.message || e}`);
    }
  }

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
    logInfo(`检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    logInfo("无汇率波动超出阈值");
  }

  let lastUpdateContent = "";
  if (globalGoogleResult && globalGoogleResult.lastUpdate && globalGoogleResult.lastUpdate !== "未知") {
    lastUpdateContent += `WEB更新时间：${globalGoogleResult.lastUpdate}\n`;
  }
  if (globalApiResult && globalApiResult.lastUpdate && globalApiResult.lastUpdate !== "未知") {
    lastUpdateContent += `API更新时间：${globalApiResult.lastUpdate}\n`;
  }
  if (globalGoogleResult && globalGoogleResult.nextUpdate && globalGoogleResult.nextUpdate !== "未知") {
    lastUpdateContent += `WEB下次更新：${globalGoogleResult.nextUpdate}\n`;
  }
  if (globalApiResult && globalApiResult.nextUpdate && globalApiResult.nextUpdate !== "未知") {
    lastUpdateContent += `API下次更新：${globalApiResult.nextUpdate}\n`;
  }
  content += `\n${lastUpdateContent.trim()}`;

  // 当前北京时间字符串，用于面板标题时间
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

  // 调用$done结束脚本，传递面板显示内容及图标等信息
  $done({
    title: `汇率信息 ${beijingTime}`,
    content: content.trim(),
    icon: params.icon || "arrow.left.arrow.right.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

// 格式化时间为北京时间字符串，支持多种时间格式输入
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
    } else if (/^\d{4}-\d{2}-\d{2}(T.*)?/.test(s)) {
      date = new Date(s);
    } else {
      date = new Date(s);
    }
  } else {
    date = new Date(timeInput);
  }
  if (!date || isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

// 判断是否可以发送通知（是否达到冷却时间）
function canNotify(key) {
  try {
    const lastTimeStr = $persistentStore.read("notify_time_" + key);
    logInfo(`通知冷却读取：${key} 上次通知时间 ${lastTimeStr}`);
    if (!lastTimeStr) return true;

    let lastTime;
    if (/^\d+$/.test(lastTimeStr)) {
      if (lastTimeStr.length === 13) {
        lastTime = new Date(Number(lastTimeStr));
      } else if (lastTimeStr.length === 10) {
        lastTime = new Date(Number(lastTimeStr) * 1000);
      } else {
        lastTime = new Date(lastTimeStr);
      }
    } else {
      lastTime = new Date(lastTimeStr);
    }

    const now = new Date();

    if (isNaN(lastTime.getTime())) {
      logInfo(`警告：上次通知时间转换无效，允许发送通知`);
      return true;
    }

    const diffMinutes = (now - lastTime) / 60000;
    logInfo(`通知冷却时间差（分钟）：${diffMinutes}`);

    return diffMinutes >= notifyCooldownMinutes;
  } catch (e) {
    logInfo(`canNotify异常：${e.message || e}`);
    return true;
  }
}

// 设置通知发送时间，写入当前时间
function setNotifyTime(key) {
  try {
    const nowIso = new Date().toISOString();
    $persistentStore.write(nowIso, "notify_time_" + key);
    logInfo(`通知时间写入成功：${key} ${nowIso}`);
  } catch (e) {
    logInfo(`通知时间写入失败：${key}，${e.message || e}`);
  }
}

// 日志打印辅助函数，兼容多环境
function logInfo(msg) {
  const prefix = "[汇率监控] ";
  if (typeof console !== "undefined" && console.log) {
    console.log(prefix + msg);
  } else if (typeof $console !== "undefined" && $console.info) {
    $console.info(prefix + msg);
  }
}

// 解析脚本参数，格式如 "key:value,key2:value2"
function getParams(arg) {
  if (!arg) return {};
  const obj = {};
  arg.split(",").forEach(pair => {
    const [k, v] = pair.split(":");
    if (k && v) obj[k.trim()] = v.trim();
  });
  return obj;
}

// 格式化汇率数值，保留指定小数位
function formatRate(num, decimals = 2) {
  if (typeof num !== "number" || isNaN(num)) return "未知";
  return num.toFixed(decimals);
}
