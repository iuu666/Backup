/**
 * 汇率监控完整版脚本（支持波动提醒+复制提示+缓存+多参数+国际化）
 *
 * 功能说明：
 * 1. 支持自定义基准币种（base参数），默认CNY
 * 2. 支持自定义监控币种列表（currencies参数）
 * 3. 支持波动阈值提醒（threshold参数，单位%）
 * 4. 支持语言切换（lang参数，zh或en）
 * 5. 支持面板图标和颜色自定义（icon、color参数）
 * 6. 使用$persistentStore缓存历史汇率，防止频繁请求和误报波动
 * 7. 发送波动提醒通知，通知中带复制提示文案（适合Surge通知复制操作）
 * 8. 格式化数字显示（部分币种无小数位）
 * 9. 网络请求错误和解析异常处理
 * 10. 显示面板时间戳，固定亚洲上海时区（北京时间）
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
  let obj = { value: value, timestamp: Date.now() };
  $persistentStore.write(JSON.stringify(obj), key);
}

function formatRate(value, cur) {
  return ["JPY", "KRW"].includes(cur) ? value.toFixed(0) : value.toFixed(2);
}

// 国旗 Emoji 对照表（支持默认币种和监控币种）
const flagMap = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  HKD: "🇭🇰",
  JPY: "🇯🇵",
  KRW: "🇰🇷",
  TRY: "🇹🇷",
  CNY: "🇨🇳",
};

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
    dataSource: "数据来源：exchangerate-api.com",
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
    dataSource: "Data source: exchangerate-api.com",
    copyHint: "(Tap to copy)"
  }
};

(async () => {
  const params = getParams($argument);

  const baseCurrency = (params.base || "CNY").toUpperCase();
  const threshold = params.threshold ? parseFloat(params.threshold) : 1.0;
  const currencies = params.currencies
    ? params.currencies.split(",").map(c => c.trim().toUpperCase())
    : ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"];

  const icon = params.icon || "bitcoinsign.circle";
  const iconColor = params.color || "#EF8F1C";
  const lang = (params.lang || "zh").toLowerCase();
  const msg = messages[lang] || messages.zh;

  const url = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;

  $httpClient.get(url, (error, response, data) => {
    if (error) {
      $done({
        title: msg.fetchFail,
        content: msg.requestError + error,
        icon: "xmark.octagon",
        "icon-color": "#FF3B30"
      });
      return;
    }

    if (!response || response.status !== 200) {
      $done({
        title: msg.fetchFail,
        content: `HTTP状态码：${response ? response.status : "null"}`,
        icon: "xmark.octagon",
        "icon-color": "#FF3B30"
      });
      return;
    }

    let json;
    try {
      json = JSON.parse(data);
    } catch {
      $done({
        title: msg.fetchFail,
        content: msg.parseError,
        icon: "xmark.octagon",
        "icon-color": "#FF3B30"
      });
      return;
    }

    if (!json.rates) {
      $done({
        title: msg.fetchFail,
        content: msg.noRates,
        icon: "xmark.octagon",
        "icon-color": "#FF3B30"
      });
      return;
    }

    const rates = json.rates;
    let rateArr = [];
    let fluctuations = [];

    for (const cur of currencies) {
      if (!(cur in rates)) {
        rateArr.push(`${cur}:缺失`);
        continue;
      }

      // 计算显示汇率
      let displayRate;
      if (["USD", "EUR", "GBP"].includes(cur)) {
        displayRate = 1 / rates[cur];
      } else {
        displayRate = rates[cur];
      }

      const roundedRate = formatRate(displayRate, cur);

      // 波动计算与通知
      const cacheKey = `exrate_${cur}`;
      const prevRate = readCache(cacheKey);
      if (prevRate !== null) {
        const changePercent = ((displayRate - prevRate) / prevRate) * 100;
        if (Math.abs(changePercent) >= threshold) {
          const symbol = changePercent > 0 ? "📈" : "📉";
          const direction = changePercent > 0 ? msg.up : msg.down;
          const fluctuationText = `${flagMap[cur] || ""}${cur}汇率${direction}：${symbol}${Math.abs(changePercent).toFixed(2)}%`;
          fluctuations.push(fluctuationText);
        }
      }
      writeCache(cacheKey, displayRate);

      // 拼接紧凑的面板内容（带国旗）
      rateArr.push(`${flagMap[cur] || ""}${cur}:${roundedRate}`);
    }

    const timestamp = new Date().toLocaleTimeString(
      lang === "zh" ? "zh-CN" : "en-US",
      {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      }
    );

    if (fluctuations.length > 0) {
      $notification.post(
        `${msg.fluctuationTitle} ${timestamp}`,
        fluctuations.join("\n"),
        msg.copyHint
      );
    }

    const content = rateArr.join(", ") + `\n${msg.dataSource}`;

    $done({
      title: `${msg.currentRateInfo} ${timestamp}`,
      content,
      icon,
      "icon-color": iconColor
    });
  });
})();
