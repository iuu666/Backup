const webUrl = "https://www.google.com/finance/quote/USD-CNY";

const apiUrls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

const displayRates = [
  { key: "USD", label: "美元", isBaseForeign: true, decimals: 2, flag: "🇺🇸" },
  { key: "EUR", label: "欧元", isBaseForeign: true, decimals: 2, flag: "🇪🇺" },
  { key: "GBP", label: "英镑", isBaseForeign: true, decimals: 2, flag: "🇬🇧" },
  { key: "HKD", label: "港币", isBaseForeign: false, decimals: 2, flag: "🇭🇰" },
  { key: "JPY", label: "日元", isBaseForeign: false, decimals: 0, flag: "🇯🇵" },
  { key: "KRW", label: "韩元", isBaseForeign: false, decimals: 0, flag: "🇰🇷" },
  { key: "TRY", label: "里拉", isBaseForeign: false, decimals: 2, flag: "🇹🇷" }
];

const flagCNY = "🇨🇳";

// 解析参数，支持阈值、通知开关、兑换基数等
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

(async () => {
  try {
    // 1. 先网页抓取（只针对USD-CNY，其他用API）
    let webRates = {};
    let webUpdateTime = null;

    const webResp = await httpGet(webUrl);
    if (webResp.error) throw webResp.error;

    // 解析网页获取 USD-CNY 汇率和更新时间
    const html = webResp.data;

    const priceMatch = html.match(/<div class="YMlKec fxKbKc">([\d.]+)<\/div>/);
    if (priceMatch && priceMatch[1]) {
      webRates["USD"] = parseFloat(priceMatch[1]);
      logInfo(`网页抓取美元汇率：${webRates["USD"]}`);
    }

    // 获取时间，网页中 <div class="ygUjEc" jsname="Vebqub">时间文本</div>
    const timeMatch = html.match(/<div class="ygUjEc" jsname="Vebqub">([^<]+?)·/);
    if (timeMatch && timeMatch[1]) {
      webUpdateTime = parseAndFormatTime(timeMatch[1].trim());
      logInfo(`网页数据更新时间：${webUpdateTime}`);
    }

    // 2. 再用API获取所有币种汇率（基准是CNY）
    const apiData = await fetchApiData(apiUrls);
    if (!apiData) throw new Error("所有API请求失败");

    // 3. 处理汇率数据，优先网页数据USD，其他用API
    // API汇率是 CNY基准，处理成 1币种兑换人民币汇率或人民币兑换币种汇率
    const ratesCombined = {};
    const timeWeb = webUpdateTime;
    const timeApi = apiData.lastUpdate;

    let content = "";
    let fluctuations = [];

    for (const item of displayRates) {
      let rateValue = null;
      let source = "API";

      if (item.key === "USD" && webRates["USD"] !== undefined) {
        // USD用网页汇率
        rateValue = webRates["USD"];
        source = "网页";
      } else {
        if (!(item.key in apiData.rates)) {
          logInfo(`警告：API中无${item.key}汇率数据`);
          content += `${item.label} 数据缺失\n`;
          continue;
        }
        if (item.isBaseForeign) {
          // 1币种兑换人民币 = 1 / (CNY基准汇率)
          rateValue = strongAmount / apiData.rates[item.key];
        } else {
          // 人民币兑换该币种 = 人民币基数 * 汇率
          rateValue = weakAmount * apiData.rates[item.key];
        }
      }

      ratesCombined[item.key] = { rateValue, source, decimals: item.decimals };

      let text;
      if (item.isBaseForeign) {
        text = `${strongAmount}${item.label}${item.flag} 兑换 人民币 ${formatRate(rateValue, item.decimals)}${flagCNY} (${source})`;
      } else {
        text = `${weakAmount}人民币${flagCNY} 兑换 ${item.label} ${formatRate(rateValue, item.decimals)}${item.flag} (${source})`;
      }

      logInfo(`汇率信息：${text}`);

      // 汇率波动提醒
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

      content += text + "\n";
    }

    // 汇率波动提醒输出
    if (fluctuations.length > 0) {
      content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
      logInfo(`检测到汇率波动：\n${fluctuations.join("\n")}`);
    } else {
      logInfo("无汇率波动超出阈值");
    }

    // 显示网页和API更新时间（方案1）
    content += `\n数据更新时间(北京时间)：`;
    if (timeWeb) content += `\n网页数据：${timeWeb}`;
    if (timeApi) content += `\nAPI数据：${timeApi}`;

    // 面板时间显示当前北京时间
    const beijingNow = new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    $done({
      title: `汇率信息 ${beijingNow}`,
      content: content.trim(),
      icon: params.icon || "bitcoinsign.circle",
      "icon-color": params.color || "#EF8F1C"
    });

  } catch (e) {
    logInfo("脚本异常：" + (e.message || e));
    $done({
      title: "汇率获取失败",
      content: e.message || "未知错误",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
  }
})();

// === 工具函数 ===

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

function logInfo(msg) {
  const timeStr = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  console.log(`[Exchange ${timeStr}] ${msg}`);
}

function formatRate(val, dec) {
  return Number(val).toFixed(dec);
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

function parseAndFormatTime(timeStr) {
  // 输入格式例： "8月6日, UTC 18:12:24"
  // 转成标准Date，返回北京时间格式字符串
  try {
    const regex = /(\d+)月(\d+)日, UTC (\d+):(\d+):(\d+)/;
    const m = timeStr.match(regex);
    if (!m) return "时间格式异常";

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = parseInt(m[1], 10) - 1;
    const day = parseInt(m[2], 10);
    const hour = parseInt(m[3], 10);
    const minute = parseInt(m[4], 10);
    const second = parseInt(m[5], 10);

    // 构造UTC时间Date
    const dateUtc = new Date(Date.UTC(year, month, day, hour, minute, second));
    // 转北京时间字符串
    return dateUtc.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  } catch {
    return "时间格式异常";
  }
}

function httpGet(url) {
  return new Promise((resolve) => {
    $httpClient.get(url, (error, response, data) => {
      if (error) resolve({ error });
      else resolve({ data, response });
    });
  });
}

function fetchApiData(urls, index = 0) {
  return new Promise((resolve) => {
    if (index >= urls.length) {
      resolve(null);
      return;
    }
    const url = urls[index];
    logInfo(`请求接口：${url}`);
    $httpClient.get(url, (error, response, data) => {
      if (error || !data) {
        logInfo(`请求失败：${error || "无响应"}，尝试下一个接口`);
        resolve(fetchApiData(urls, index + 1));
        return;
      }
      try {
        const parsed = JSON.parse(data);
        let rates = null, lastUpdate = null, nextUpdate = null;

        if (url.includes("open.er-api.com")) {
          rates = parsed.rates;
          lastUpdate = formatTimeToBeijing(parsed.time_last_update_utc);
          nextUpdate = formatTimeToBeijing(parsed.time_next_update_utc);
        } else if (url.includes("api.exchangerate-api.com")) {
          rates = parsed.rates;
          lastUpdate = formatTimeToBeijing(parsed.time_last_updated * 1000 || parsed.time_last_updated);
          nextUpdate = null;
        } else if (url.includes("api.frankfurter.app")) {
          rates = parsed.rates;
          lastUpdate = formatTimeToBeijing(parsed.date);
          nextUpdate = null;
        } else {
          throw new Error("未知接口格式");
        }
        logInfo(`数据获取成功，接口：${url.match(/https?:\/\/([^/]+)/)[1]}`);
        resolve({ rates, lastUpdate, nextUpdate });
      } catch (e) {
        logInfo(`数据解析异常：${e.message || e}，尝试下一个接口`);
        resolve(fetchApiData(urls, index + 1));
      }
    });
  });
}

function formatTimeToBeijing(timeInput) {
  if (!timeInput || timeInput === "未知") return null;
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
  if (!(date instanceof Date) || isNaN(date)) return null;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
