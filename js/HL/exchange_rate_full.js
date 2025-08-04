/**
 * 汇率监控完整版脚本（优化版）
 * 支持波动提醒+复制提示+缓存+多参数+国际化
 */

function getParams(param) {
  try {
    return Object.fromEntries(
      (param || "")
        .split("&")
        .filter(Boolean)
        .map(item => item.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
  } catch {
    return {};
  }
}

function readCache(key, expireMs = 24 * 3600 * 1000) {
  let str = $persistentStore.read(key);
  if (!str) return null;
  try {
    let obj = JSON.parse(str);
    if (Date.now() - obj.timestamp > expireMs) return null;
    return obj.value;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  const obj = { value: value, timestamp: Date.now() };
  $persistentStore.write(JSON.stringify(obj), key);
}

function formatRate(value, cur) {
  return ["JPY", "KRW"].includes(cur) ? value.toFixed(0) : value.toFixed(2);
}

function getMessage(lang, key) {
  const messages = {
    zh: {
      fetchFail: "汇率获取失败",
      requestError: "请求错误：",
      parseError: "数据解析失败",
      noRates: "返回数据无汇率信息",
      fluctuationTitle: "汇率波动提醒",
      up: "上涨",
      down: "下跌",
      currentRateInfo: "当前汇率信息",
      dataSource: "数据来源：exchangerate.host",
      copyHint: "（点击复制）"
    },
    en: {
      fetchFail: "Failed to fetch rates",
      requestError: "Request error: ",
      parseError: "Data parse error",
      noRates: "No rates info in response",
      fluctuationTitle: "Exchange Rate Fluctuation",
      up: "Increase",
      down: "Decrease",
      currentRateInfo: "Current Exchange Rates",
      dataSource: "Data source: exchangerate.host",
      copyHint: "(Tap to copy)"
    }
  };
  return (messages[lang] || messages.zh)[key];
}

async function fetchRates(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(url, (error, response, data) => {
      if (error) return reject({ type: "network", error });
      if (!response || response.status !== 200)
        return reject({ type: "http", status: response ? response.status : "null" });
      try {
        const json = JSON.parse(data);
        return resolve(json);
      } catch {
        return reject({ type: "parse" });
      }
    });
  });
}

(async () => {
  const params = getParams($argument);
  const baseCurrency = (params.base || "CNY").toUpperCase();
  const threshold = parseFloat(params.threshold || 1.0);
  const currencies = (params.currencies || "USD,EUR,GBP,HKD,JPY,KRW,TRY")
    .split(",")
    .map(c => c.trim().toUpperCase());
  const icon = params.icon || "bitcoinsign.circle";
  const iconColor = params.color || "#EF8F1C";
  const lang = (params.lang || "zh").toLowerCase();
  const accessKey = params.access_key || "";
  const msg = key => getMessage(lang, key);

  let url = `https://api.exchangerate.host/latest?base=${baseCurrency}`;
  if (accessKey) url += `&access_key=${accessKey}`;

  try {
    const json = await fetchRates(url);
    if (!json.rates) throw { type: "noRates" };

    const rates = json.rates;
    const rateArr = [];
    const fluctuations = [];
    const timestamp = new Date().toLocaleTimeString(
      lang === "zh" ? "zh-CN" : "en-US",
      {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      }
    );

    currencies.forEach(cur => {
      if (!(cur in rates)) {
        rateArr.push(`${cur}: 数据缺失`);
        return;
      }

      const displayRate =
        ["USD", "EUR", "GBP"].includes(cur) ? 1 / rates[cur] : rates[cur];
      const roundedRate = formatRate(displayRate, cur);
      const cacheKey = `exrate_${cur}`;
      const prevRate = readCache(cacheKey);

      if (prevRate !== null) {
        const changePercent = ((displayRate - prevRate) / prevRate) * 100;
        if (Math.abs(changePercent) >= threshold) {
          const symbol = changePercent > 0 ? "📈" : "📉";
          const direction = changePercent > 0 ? msg("up") : msg("down");
          fluctuations.push(
            `${cur}汇率${direction}: ${symbol}${Math.abs(changePercent).toFixed(
              2
            )}%`
          );
        }
      }

      writeCache(cacheKey, displayRate);
      rateArr.push(
        `${cur} = ${roundedRate}${baseCurrency}`
      );
    });

    if (fluctuations.length > 0) {
      $notification.post(
        `${msg("fluctuationTitle")} ${timestamp}`,
        fluctuations.join("\n"),
        msg("copyHint")
      );
    }

    $done({
      title: `${msg("currentRateInfo")} ${timestamp}`,
      content: rateArr.join("\n") + `\n\n${msg("dataSource")}`,
      icon: icon,
      "icon-color": iconColor
    });
  } catch (error) {
    const errorContent =
      error.type === "network"
        ? msg("requestError") + error.error
        : error.type === "http"
        ? `HTTP状态码：${error.status}`
        : error.type === "parse"
        ? msg("parseError")
        : msg("noRates");

    $done({
      title: msg("fetchFail"),
      content: errorContent,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
  }
})();