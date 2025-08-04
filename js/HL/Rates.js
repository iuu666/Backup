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
  // 解析 argument 参数字符串，转为键值对象
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
  // 从持久缓存读取数据，超时返回null
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
  // 写入持久缓存，带时间戳
  let obj = { value: value, timestamp: Date.now() };
  $persistentStore.write(JSON.stringify(obj), key);
}

function formatRate(value, cur) {
  // 格式化汇率数字，JPY和KRW无小数位，其他保留2位
  return ["JPY", "KRW"].includes(cur) ? value.toFixed(0) : value.toFixed(2);
}

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

(async () => {
  // 解析参数
  const params = getParams($argument);

  // 基准币种，默认为人民币CNY
  const baseCurrency = (params.base || "CNY").toUpperCase();

  // 汇率波动提醒阈值，默认1%
  const threshold = params.threshold ? parseFloat(params.threshold) : 1.0;

  // 监控币种列表，默认美元、欧元、英镑、港币、日元、韩元、土耳其里拉
  const currencies = params.currencies
    ? params.currencies.split(",").map(c => c.trim().toUpperCase())
    : ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"];

  // 面板图标和颜色自定义，默认橙色比特币符号
  const icon = params.icon || "bitcoinsign.circle";
  const iconColor = params.color || "#EF8F1C";

  // 语言选择，默认中文
  const lang = (params.lang || "zh").toLowerCase();
  const msg = messages[lang] || messages.zh;

  // 请求API地址（ExchangeRate.host免费接口）
  const url = `https://api.exchangerate.host/latest?base=${baseCurrency}`;

  // 发起网络请求获取最新汇率
  $httpClient.get(url, (error, response, data) => {
    if (error) {
      // 网络请求错误，返回错误面板
      $done({
        title: msg.fetchFail,
        content: msg.requestError + error,
        icon: "xmark.octagon",
        "icon-color": "#FF3B30"
      });
      return;
    }

    if (!response || response.status !== 200) {
      // HTTP状态码非200，返回错误面板
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
      // JSON解析失败，返回错误面板
      $done({
        title: msg.fetchFail,
        content: msg.parseError,
        icon: "xmark.octagon",
        "icon-color": "#FF3B30"
      });
      return;
    }

    if (!json.rates) {
      // 返回数据中无汇率字段，返回错误面板
      $done({
        title: msg.fetchFail,
        content: msg.noRates,
        icon: "xmark.octagon",
        "icon-color": "#FF3B30"
      });
      return;
    }

    const rates = json.rates;
    let content = "";
    let fluctuations = [];

    // 遍历监控币种，准备面板内容和波动检测
    for (const cur of currencies) {
      if (!(cur in rates)) {
        content += `${cur}: 数据缺失\n`;
        continue;
      }

      // USD, EUR, GBP 显示 1单位该币种兑换基准币率（反转）
      // 其他币种显示基准币种兑换该币种汇率
      let displayRate;
      if (["USD", "EUR", "GBP"].includes(cur)) {
        displayRate = 1 / rates[cur];
      } else {
        displayRate = rates[cur];
      }

      const roundedRate = formatRate(displayRate, cur);

      // 缓存键名，用于存储该币种历史汇率
      const cacheKey = `exrate_${cur}`;
      const prevRate = readCache(cacheKey);

      // 如果有缓存，计算波动百分比，判断是否超过阈值
      if (prevRate !== null) {
        const changePercent = ((displayRate - prevRate) / prevRate) * 100;
        if (Math.abs(changePercent) >= threshold) {
          const symbol = changePercent > 0 ? "📈" : "📉";
          const direction = changePercent > 0 ? msg.up : msg.down;
          const fluctuationText = `${cur}汇率${direction}：${symbol}${Math.abs(changePercent).toFixed(2)}%`;
          fluctuations.push(fluctuationText);
        }
      }

      // 更新缓存汇率
      writeCache(cacheKey, displayRate);

      // 拼接面板显示文本
      if (["USD", "EUR", "GBP"].includes(cur)) {
        content += `1${cur} = ${roundedRate}${baseCurrency}\n`;
      } else {
        content += `1${baseCurrency} = ${roundedRate}${cur}\n`;
      }
    }

    // 获取当前时间，格式为HH:mm，使用北京时间时区
    const timestamp = new Date().toLocaleTimeString(
      lang === "zh" ? "zh-CN" : "en-US",
      {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      }
    );

    // 有波动时发送通知，带复制提示（适合Surge）
    if (fluctuations.length > 0) {
      $notification.post(
        `${msg.fluctuationTitle} ${timestamp}`,
        fluctuations.join("\n"),
        msg.copyHint
      );
    }

    content += `\n${msg.dataSource}`;

    // 输出面板内容
    $done({
      title: `${msg.currentRateInfo} ${timestamp}`,
      content,
      icon,
      "icon-color": iconColor
    });
  });
})();
