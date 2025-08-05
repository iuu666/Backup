/**
 * 汇率监控脚本（3+3币种结构，支持自定义）
 * 
 * 功能说明：
 * 1. 支持多个API请求（失败自动切换）；
 * 2. 支持自定义汇率波动阈值 threshold（默认0.3%）；
 * 3. 支持强/弱币种自定义和基数设置（base_strong/base_weak）；
 * 4. 支持推送通知（notify=true/false）和冷却时间（notify_cooldown）；
 * 5. 面板展示汇率、波动、更新时间（北京时间）。
 */

const urls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

const params = getParams($argument);
const thresholdRaw = parseFloat(params.threshold);
const threshold = (isNaN(thresholdRaw) || thresholdRaw <= 0) ? 0.3 : thresholdRaw;
const enableNotify = (params.notify || "true").toLowerCase() === "true";
const strongAmount = parseFloat(params.base_strong) || 1;
const weakAmount = parseFloat(params.base_weak) || 1;
const notifyCooldownMinutes = parseInt(params.notify_cooldown) || 5;

logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
logInfo(`汇率波动阈值：${threshold}%`);
logInfo(`兑换基数：强势币 ${strongAmount}，弱势币 ${weakAmount}`);
logInfo(`通知冷却时间：${notifyCooldownMinutes} 分钟`);

const defaultStrong = ["USD", "EUR", "GBP"];
const defaultWeak = ["HKD", "JPY", "KRW"];

const strongs = (params.strongs || "").split(",").filter(Boolean) || [];
const weaks = (params.weaks || "").split(",").filter(Boolean) || [];
const strongKeys = strongs.length > 0 ? strongs : defaultStrong;
const weakKeys = weaks.length > 0 ? weaks : defaultWeak;

const currencyLabels = {
  USD: "美元", EUR: "欧元", GBP: "英镑",
  HKD: "港币", JPY: "日元", KRW: "韩元"
};
const flagMap = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧",
  HKD: "🇭🇰", JPY: "🇯🇵", KRW: "🇰🇷", CNY: "🇨🇳"
};

function formatTimeToBeijing(input) {
  const d = new Date(input.includes("T") ? input : input + "T00:00:00Z");
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
}

function logInfo(msg) {
  const t = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  console.log(`[汇率 ${t}] ${msg}`);
}

function canNotify(key) {
  const last = parseInt($persistentStore.read("notify_time_" + key)) || 0;
  return Date.now() - last > notifyCooldownMinutes * 60 * 1000;
}

function setNotifyTime(key) {
  $persistentStore.write(String(Date.now()), "notify_time_" + key);
}

function formatRate(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

function fetchWithFallback(urls, idx = 0) {
  if (idx >= urls.length) {
    $done({
      title: "汇率获取失败",
      content: "所有接口请求均失败",
      icon: "xmark.octagon", "icon-color": "#FF3B30"
    });
    return;
  }

  const url = urls[idx];
  logInfo(`请求接口：${url}`);
  $httpClient.get(url, (err, resp, data) => {
    if (err || !data) {
      logInfo(`请求失败：${err || "无响应"}，尝试下一个`);
      return fetchWithFallback(urls, idx + 1);
    }

    try {
      const parsed = JSON.parse(data);
      let rates, lastUpdate, nextUpdate;
      if (url.includes("er-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.time_last_update_utc);
        nextUpdate = formatTimeToBeijing(parsed.time_next_update_utc);
      } else if (url.includes("exchangerate-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.time_last_updated * 1000);
        nextUpdate = "未知";
      } else if (url.includes("frankfurter")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.date);
        nextUpdate = "未知";
      } else throw new Error("未知数据格式");

      processData(rates, lastUpdate, nextUpdate, url);
    } catch (e) {
      logInfo(`解析失败：${e.message}，尝试下一个`);
      return fetchWithFallback(urls, idx + 1);
    }
  });
}

function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const list = [];
  const fluctuations = [];
  const domain = sourceUrl.match(/https?:\/\/([^/]+)/)?.[1] || sourceUrl;

  for (const key of [...strongKeys, ...weakKeys]) {
    const label = currencyLabels[key] || key;
    const isStrong = strongKeys.includes(key);
    const base = isStrong ? strongAmount : weakAmount;

    if (!(key in rates)) {
      list.push(`${label} 数据缺失`);
      continue;
    }

    const rate = isStrong ? base / rates[key] : base * rates[key];
    const formatted = formatRate(rate, key === "JPY" || key === "KRW" ? 0 : 2);
    const text = isStrong
      ? `${base}${label}${flagMap[key] || ""} 兑换 人民币${flagMap.CNY} ${formatted}`
      : `${base}人民币${flagMap.CNY} 兑换 ${label}${flagMap[key] || ""} ${formatted}`;

    logInfo(`汇率信息：${text}`);
    list.push(text);

    const cacheKey = "exrate_" + key;
    const prevStr = $persistentStore.read(cacheKey);
    const prev = prevStr ? parseFloat(prevStr) : NaN;

    if (!isNaN(prev)) {
      const change = ((rate - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        const up = change > 0;
        const symbol = up ? "📈" : "📉";
        const msg = `${key} 汇率${up ? "上涨" : "下跌"}：${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(msg);
        if (enableNotify && canNotify(key)) {
          $notification.post(`${symbol} ${key} ${up ? "上涨" : "下跌"}`, "", `当前汇率：${text}`);
          setNotifyTime(key);
          logInfo(`发送提醒：${msg}`);
        }
      }
    }

    $persistentStore.write(String(rate), cacheKey);
  }

  let output = list.join("\n");
  if (fluctuations.length) {
    output += `\n\n💱 汇率波动提醒（>${threshold}%）：\n` + fluctuations.join("\n");
  }

  output += `\n\n数据来源：${domain}\n数据更新时间：${lastUpdate}\n下次更新时间：${nextUpdate}`;

  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });

  $done({
    title: `汇率信息 ${beijingTime}`,
    content: output,
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

function getParams(str) {
  try {
    return Object.fromEntries(
      (str || "")
        .split("&")
        .filter(Boolean)
        .map(p => p.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
  } catch {
    return {};
  }
}

fetchWithFallback(urls);
