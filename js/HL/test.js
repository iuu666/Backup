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

let globalGoogleResult = null;
let globalApiResult = null;

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
    httpGetWithRetry(url, 2, (error, data) => {
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
    httpGetWithRetry(url, 2, (error, data) => {
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
          lastUpdateRaw = parsed.time_last_updated * 1000;
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
  httpGetWithRetry(url, 2, (error, data) => {
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
        lastUpdate = formatTimeToBeijing(parsed.time_last_updated * 1000);
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

// 其余 processData / formatTimeToBeijing / logInfo / canNotify 等函数无需变动

function httpGetWithRetry(url, retries, callback) {
  const maxRetries = retries || 2;
  let attempt = 0;
  function tryRequest() {
    $httpClient.get(url, (error, response, data) => {
      if (error || !data) {
        if (attempt < maxRetries) {
          logInfo(`请求失败（第${attempt + 1}次）：${url}，重试中...`);
          attempt++;
          tryRequest();
        } else {
          logInfo(`请求失败（已达最大重试次数）：${url}`);
          callback(error || new Error("无响应"), null);
        }
      } else {
        callback(null, data);
      }
    });
  }
  tryRequest();
}

function getParams(arg) {
  if (!arg) return {};
  const obj = {};
  arg.split(",").forEach(pair => {
    const [k, ...rest] = pair.split(":");
    const v = rest.join(":");
    if (k && v !== undefined) obj[k.trim()] = v.trim();
  });
  return obj;
}

// 保留 processData 等原函数
// 若你还需我整合完整的压缩版本（用于 Surge 规则中复制粘贴），可以告诉我
