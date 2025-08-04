// 默认基准货币是人民币（CNY）
const defaultBase = "CNY";
// 默认监控币种列表
const defaultCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"];
// 波动提醒阈值（百分比），默认1%
const defaultThreshold = 1.0;
// 缓存过期时间，单位毫秒，默认24小时
const cacheExpireMs = 24 * 60 * 60 * 1000;

// 解析传入参数
const params = getParams($argument);

// 国际化支持，默认中文，参数lang=en可切换英文
const lang = (params.lang || "zh").toLowerCase();

const messages = {
  zh: {
    fetchFail: "汇率获取失败",
    requestError: "请求错误：",
    parseError: "数据解析异常",
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
}[lang];

// 基准货币参数（默认CNY）
const baseCurrency = params.base ? params.base.toUpperCase() : defaultBase;
// 波动阈值参数（默认1%）
const threshold = params.threshold ? parseFloat(params.threshold) : defaultThreshold;
// 监控币种列表参数（默认列表）
const currencies = params.currencies
  ? params.currencies.split(",").map(c => c.trim().toUpperCase())
  : defaultCurrencies;

// 图标参数，默认bitcoinsign.circle
const icon = params.icon || "bitcoinsign.circle";
// 图标颜色，默认橙色
const iconColor = params.color || "#EF8F1C";
// API Key（预留接口支持，目前无效）
const apiKey = params.apiKey || "";

// 组装请求地址，带API Key参数（如果有）
const url = apiKey
  ? `https://api.exchangerate.host/latest?base=${baseCurrency}&apikey=${apiKey}`
  : `https://api.exchangerate.host/latest?base=${baseCurrency}`;

console.log(`[INFO] Fetching rates from: ${url}`);

// 发送HTTP GET请求
$httpClient.get(url, (error, response, data) => {
  if (error) {
    // 网络请求失败时提示
    console.log(`[ERROR] Network error: ${error}`);
    $done({
      title: messages.fetchFail,
      content: messages.requestError + error,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }
  if (!response || response.status !== 200) {
    // HTTP状态码非200时提示
    console.log(`[ERROR] HTTP status: ${response ? response.status : "null"}`);
    $done({
      title: messages.fetchFail,
      content: `HTTP状态码：${response ? response.status : "null"}`,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  let parsed;
  try {
    // 解析JSON数据
    parsed = JSON.parse(data);
  } catch (e) {
    // JSON解析异常时提示
    console.log(`[ERROR] JSON parse error: ${e}`);
    $done({
      title: messages.fetchFail,
      content: messages.parseError,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  if (!parsed.rates) {
    // 返回数据没有rates字段时提示
    console.log("[ERROR] No rates field in response");
    $done({
      title: messages.fetchFail,
      content: messages.noRates,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  const rates = parsed.rates;

  // 格式化数字保留小数位
  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

  // 存放所有波动信息，待合并通知
  const fluctuations = [];

  // 面板展示内容字符串
  let content = "";

  // 当前时间戳（毫秒）
  const now = Date.now();

  // 读取缓存，带过期判断，过期返回null
  // 缓存格式：{"value":数字,"timestamp":时间戳}
  function readCache(key) {
    const str = $persistentStore.read(key);
    if (!str) return null;
    try {
      const obj = JSON.parse(str);
      if (now - obj.timestamp > cacheExpireMs) {
        console.log(`[INFO] Cache expired for ${key}`);
        return null;
      }
      return obj.value;
    } catch {
      return null;
    }
  }

  // 写缓存，存储当前时间戳
  function writeCache(key, value) {
    const obj = { value, timestamp: now };
    $persistentStore.write(JSON.stringify(obj), key);
  }

  // 监控的币种中，针对每个币种进行处理
  for (const cur of currencies) {
    const rateRaw = rates[cur];
    if (rateRaw === undefined) {
      // 如果API未返回该币种汇率，则提示数据缺失
      content += `${cur}: 数据缺失\n`;
      continue;
    }

    // 计算显示的汇率
    // 对于USD、EUR、GBP，显示1单位外币兑换多少基准币（如人民币）
    // 对于其他币种，显示1基准币兑换多少该币种
    let displayRate;
    let label;
    let decimals = 2;

    // 对于日元和韩元，常用整数显示
    const zeroDecimalCurrencies = ["JPY", "KRW"];

    if (cur === baseCurrency) {
      // 跳过基准货币本身
      continue;
    }

    if (["USD", "EUR", "GBP"].includes(cur)) {
      displayRate = 1 / rateRaw;
      label = `${cur}兑${baseCurrency}`;
    } else {
      displayRate = rateRaw;
      label = `${baseCurrency}兑${cur}`;
    }

    decimals = zeroDecimalCurrencies.includes(cur) ? 0 : 2;
    const rounded = formatRate(displayRate, decimals);

    // 读取上一次缓存汇率
    const cacheKey = `exrate_${cur}`;
    const prev = readCache(cacheKey);

    // 计算波动幅度
    if (prev !== null) {
      const change = ((displayRate - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        // 波动超过阈值，加入波动列表待通知
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;

        fluctuations.push({
          name: cur,
          change,
          text: `${cur}汇率${change > 0 ? messages.up : messages.down}：${changeStr}`,
          copyText: `${cur}兑${baseCurrency}：${rounded}`
        });
      }
    }

    // 更新缓存汇率
    writeCache(cacheKey, displayRate);

    // 拼接面板显示内容
    content += `${label}：${rounded}\n`;
  }

  // 格式化显示时间
  const timestamp = new Date().toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });

  // 如果有波动，发送合并通知
  if (fluctuations.length > 0) {
    const notifyTitle = `${messages.fluctuationTitle} (${timestamp})`;
    const notifyContent = fluctuations.map(f => f.text).join("\n");

    $notification.post(notifyTitle, notifyContent, `${messages.copyHint}`);

    // 支持Quantumult X自动写剪贴板，复制第一个波动币种信息
    if (typeof $clipboard !== "undefined") {
      $clipboard.write(fluctuations[0].copyText);
    }

    // 面板内容增加波动提示
    content += `\n${messages.fluctuationTitle}：\n${fluctuations.map(f => f.text).join("\n")}`;
  }

  // 输出面板内容
  $done({
    title: `${messages.currentRateInfo} ${timestamp}`,
    content: `${content}\n${messages.dataSource}`,
    icon: icon,
    "icon-color": iconColor
  });
});

// 解析参数函数，输入格式："key1=val1&key2=val2"
function getParams(param) {
  try {
    return Object.fromEntries(
      (param || "")
        .split("&")
        .filter(Boolean)
        .map(item => item.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
  } catch (e) {
    return {};
  }
}
