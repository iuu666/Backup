/**
 * 📈 汇率监控脚本（支持 Surge）
 *
 * 👤 作者：okk
 * 🕒 更新时间：北京时间 2025-08-07
 * 🧩 适配平台：仅测试于 Surge，其他平台（如 Loon、Quantumult X）暂未验证
 *
 * 📌 功能概述：
 * 1. 获取人民币（CNY）与多个主要币种（USD, EUR, GBP, HKD, JPY, KRW, TRY）的汇率数据
 * 2. 优先从谷歌财经抓取数据，若缺失或失败则回退至多个公共汇率 API 补充或替代
 * 3. 自动换算为：
 *    - 强势币（如美元、欧元）等价于多少人民币
 *    - 人民币等价于多少单位的弱势币（如日元、韩元等）
 * 4. 支持设置汇率波动阈值（百分比），当某币种汇率与上次缓存值相比波动超出阈值时触发通知
 * 5. 通知支持冷却时间控制，防止重复推送
 * 6. 支持显示数据来源（WEB / API）、上次更新时间
 * 7. 参数支持自定义，包含以下：
 *    - threshold: 触发通知的波动百分比阈值（默认 0.3）
 *    - notify: 是否启用通知（true/false）
 *    - base_strong: 强势币种用于换算的单位（默认 1）
 *    - base_weak: 弱势币种用于换算的人民币数量（默认 1）
 *    - notify_cooldown: 通知冷却时间（单位：分钟，默认 5）
 *    - debug: 是否输出调试信息到控制台
 *    - icon, color: 自定义通知图标与颜色
 *
 * 💡 参数示例：
 * threshold:0.5,notify:true,base_strong:1,base_weak:100,notify_cooldown:10
 *
 * 📊 汇率数据来源：
 * - 谷歌财经：https://www.google.com/finance
 * - Open ER API：https://open.er-api.com
 * - ExchangeRate API：https://api.exchangerate-api.com
 * - Frankfurter API：https://api.frankfurter.app
 *
 * 🧠 缓存机制：
 * - 使用 $persistentStore 存储上次汇率与通知时间，供后续对比与节流
 */

const googleCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"];
const baseCurrency = "CNY";
const apiUrls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

const params = getParams($argument);
const threshold = Math.max(parseFloat(params.threshold) || 0.3, 0.01);
const enableNotify = (params.notify || "true").toLowerCase() === "true";
const strongAmount = Math.max(parseFloat(params.base_strong) || 1, 0.01);
const weakAmount = Math.max(parseFloat(params.base_weak) || 1, 0.01);
const notifyCooldownMinutes = Math.max(parseInt(params.notify_cooldown) || 5, 1);

let globalGoogleResult = null;
let globalApiResult = null;

main();

async function main() {
  logInfo(`脚本执行时间：${nowCN()}`);
  logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
  logInfo(`汇率波动阈值：${threshold}%`);
  logInfo(`兑换基数（强势币）：${strongAmount}，兑换基数（弱势币）：${weakAmount}`);
  logInfo(`通知冷却时间：${notifyCooldownMinutes} 分钟`);

  globalGoogleResult = await fetchFromGoogleAsync();

  if (globalGoogleResult && Object.keys(globalGoogleResult.rates).length > 0) {
    const missing = googleCurrencies.filter(c => !(c in globalGoogleResult.rates));
    if (missing.length === 0) {
      logInfo("✅ 谷歌财经抓取成功，无需补充");
      processData(globalGoogleResult.rates, globalGoogleResult.lastUpdate, globalGoogleResult.nextUpdate);
    } else {
      logInfo(`⚠️ 谷歌财经缺失币种：${missing.join(", ")}，尝试 API 补充`);
      globalApiResult = await fetchFromApiForCurrencies(missing);
      const combinedRates = { ...globalGoogleResult.rates, ...globalApiResult.rates };
      processData(combinedRates, null, null);
    }
  } else {
    logInfo("❌ 谷歌财经抓取失败，使用 API fallback");
    await fetchWithFallback(apiUrls);
  }
}

async function fetchFromGoogleAsync() {
  const results = {};
  let lastUpdateTimestamp = 0;

  const requests = googleCurrencies.map(curr => {
    if (curr === baseCurrency) {
      results[curr] = 1;
      return Promise.resolve();
    }

    const url = `https://www.google.com/finance/quote/${curr}-${baseCurrency}`;
    logInfo(`请求谷歌财经：${url}`);

    return fetchWithRetry(url).then(data => {
      const regex = /data-source="(\w+)"[^>]*data-target="(\w+)"[^>]*data-last-price="([\d.]+)"[^>]*data-last-normal-market-timestamp="(\d+)"/;
      const match = data.match(regex);
      if (match && match[1] === curr && match[2] === baseCurrency) {
        const rate = parseFloat(match[3]);
        const ts = parseInt(match[4]);
        if (!isNaN(rate)) results[curr] = rate;
        if (!isNaN(ts)) lastUpdateTimestamp = Math.max(lastUpdateTimestamp, ts);
        logInfo(`${curr} 成功：${rate}`);
      }
    }).catch(err => logInfo(`${curr} 失败：${err}`));
  });

  await Promise.allSettled(requests);
  if (Object.keys(results).length === 0) return null;

  const rates = {};
  for (const curr of googleCurrencies) {
    if (curr === baseCurrency) rates[curr] = 1;
    else if (results[curr]) rates[curr] = 1 / results[curr];
  }

  return {
    rates,
    lastUpdate: formatTimeToBeijing(lastUpdateTimestamp * 1000),
    nextUpdate: "未知"
  };
}

async function fetchFromApiForCurrencies(currencyList) {
  for (const url of apiUrls) {
    try {
      logInfo(`尝试 API 补充：${url}`);
      const data = await fetchWithRetry(url);
      const parsed = JSON.parse(data);
      const { rates, lastUpdate, nextUpdate } = parseApiRates(url, parsed);
      const filtered = {};
      for (const cur of currencyList) {
        if (rates[cur] != null) filtered[cur] = rates[cur];
      }
      if (Object.keys(filtered).length > 0) {
        logInfo("✅ 补充成功");
        return {
          rates: filtered,
          lastUpdate: formatTimeToBeijing(lastUpdate),
          nextUpdate: formatTimeToBeijing(nextUpdate)
        };
      }
    } catch (e) {
      logInfo(`接口失败：${e}`);
    }
  }
  return { rates: {}, lastUpdate: "未知", nextUpdate: "未知" };
}

async function fetchWithFallback(urls) {
  for (const url of urls) {
    try {
      const data = await fetchWithRetry(url);
      const parsed = JSON.parse(data);
      const { rates, lastUpdate, nextUpdate } = parseApiRates(url, parsed);
      logInfo("✅ fallback 成功");
      processData(rates, formatTimeToBeijing(lastUpdate), formatTimeToBeijing(nextUpdate));
      return;
    } catch (e) {
      logInfo(`fallback 接口失败：${e}`);
    }
  }
  $done({
    title: "汇率获取失败",
    content: "所有接口请求失败",
    icon: "xmark.octagon",
    "icon-color": "#FF3B30"
  });
}

function processData(rates, lastUpdate, nextUpdate) {
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

  let content = "";
  let fluctuations = [];

  for (const item of displayRates) {
    const source = globalGoogleResult?.rates?.[item.key]
      ? "WEB"
      : (globalApiResult?.rates?.[item.key] ? "API" : null);
    if (!source) {
      content += `${item.label} 数据缺失\n`;
      continue;
    }

    const rateVal = source === "WEB" ? globalGoogleResult.rates[item.key] : globalApiResult.rates[item.key];
    const value = item.isBaseForeign ? strongAmount / rateVal : weakAmount * rateVal;
    const text = item.isBaseForeign
      ? `${strongAmount}${item.label}${flagMap[item.key]} ≈ 人民币 ${formatRate(value, item.decimals)}${flagMap.CNY}`
      : `${weakAmount}人民币${flagMap.CNY} ≈ ${item.label} ${formatRate(value, item.decimals)}${flagMap[item.key]}`;
    content += `${text} （${source}）\n`;

    const cacheKey = getCacheKey("exrate", item.key);
    const prev = parseFloat($persistentStore.read(cacheKey));
    if (!isNaN(prev)) {
      const diff = ((value - prev) / prev) * 100;
      if (Math.abs(diff) >= threshold) {
        const symbol = diff > 0 ? "📈" : "📉";
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${symbol}${Math.abs(diff).toFixed(2)}%`);
        if (enableNotify && canNotify(item.key)) {
          $notification.post(`${symbol} ${item.key} 汇率变动`,
            "",
            `当前汇率：${text}`);
          setNotifyTime(item.key);
        }
      }
    }

    $persistentStore.write(String(value), cacheKey);
  }

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
  }

  if (globalGoogleResult?.lastUpdate) {
    content += `\nlastUpdate（WEB）：${globalGoogleResult.lastUpdate}\n`;
  }
  if (globalApiResult?.lastUpdate) {
    content += `lastUpdate（API）：${globalApiResult.lastUpdate}\n`;
  }

  $done({
    title: `汇率信息 ${nowCN()}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

function parseApiRates(url, parsed) {
  if (url.includes("open.er-api.com")) {
    return {
      rates: parsed.rates,
      lastUpdate: parsed.time_last_update_utc,
      nextUpdate: parsed.time_next_update_utc
    };
  }
  if (url.includes("api.exchangerate-api.com")) {
    return {
      rates: parsed.rates,
      lastUpdate: parsed.time_last_updated * 1000,
      nextUpdate: null
    };
  }
  if (url.includes("frankfurter")) {
    return {
      rates: parsed.rates,
      lastUpdate: parsed.date,
      nextUpdate: null
    };
  }
  throw new Error("未知 API 格式");
}

function fetchWithRetry(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const attempt = (count) => {
      $httpClient.get(url, (err, resp, data) => {
        if (!err && data) resolve(data);
        else if (count < retries) attempt(count + 1);
        else reject(err || "无响应");
      });
    };
    attempt(0);
  });
}

function getCacheKey(type, key) {
  return `${type}_${key}`;
}

function canNotify(key) {
  const last = $persistentStore.read(getCacheKey("notify_time", key));
  return !last || (new Date() - new Date(last)) / 60000 >= notifyCooldownMinutes;
}

function setNotifyTime(key) {
  $persistentStore.write(new Date().toISOString(), getCacheKey("notify_time", key));
}

function getParams(arg) {
  const obj = {};
  if (!arg) return obj;
  arg.split(",").forEach(pair => {
    const [k, v] = pair.split(":");
    if (k && v) obj[k.trim()] = v.trim();
  });
  return obj;
}

function formatTimeToBeijing(input) {
  let d;
  if (typeof input === "string" && /^\d+$/.test(input)) input = parseInt(input);
  d = typeof input === "number" ? new Date(input < 1e12 ? input * 1000 : input) : new Date(input);
  return isNaN(d.getTime()) ? "未知" : d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function nowCN() {
  return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function formatRate(val, decimals = 2) {
  return Number(val).toFixed(decimals);
}

function logInfo(msg) {
  if (params.debug === "true") console.info("[汇率监控] " + msg);
}
