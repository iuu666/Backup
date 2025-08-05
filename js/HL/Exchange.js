const urls = [
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

const currencyLabels = {
  USD: "美元", EUR: "欧元", GBP: "英镑", HKD: "港币",
  JPY: "日元", KRW: "韩元", TRY: "土耳其里拉", AUD: "澳元",
  CAD: "加元", CHF: "瑞士法郎", SGD: "新加坡元", THB: "泰铢",
  NZD: "新西兰元", MYR: "马来西亚林吉特", CNY: "人民币",
  AED: "阿联酋迪拉姆", AFN: "阿富汗尼", ARS: "阿根廷比索",
  BDT: "孟加拉塔卡", BRL: "巴西雷亚尔", COP: "哥伦比亚比索",
  DKK: "丹麦克朗", EGP: "埃及镑", HUF: "匈牙利福林",
  IDR: "印尼卢比", ILS: "以色列新谢克尔", INR: "印度卢比",
  KWD: "科威特第纳尔", LKR: "斯里兰卡卢比", MXN: "墨西哥比索",
  NOK: "挪威克朗", PKR: "巴基斯坦卢比", PLN: "波兰兹罗提",
  RUB: "俄罗斯卢布", SAR: "沙特里亚尔", SEK: "瑞典克朗",
  TWD: "新台币", UAH: "乌克兰格里夫纳", VND: "越南盾",
  ZAR: "南非兰特"
};

const flagMap = {
  CNY: "🇨🇳", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", HKD: "🇭🇰",
  JPY: "🇯🇵", KRW: "🇰🇷", TRY: "🇹🇷", AUD: "🇦🇺", CAD: "🇨🇦",
  CHF: "🇨🇭", SGD: "🇸🇬", THB: "🇹🇭", NZD: "🇳🇿", MYR: "🇲🇾",
  AED: "🇦🇪", AFN: "🇦🇫", ARS: "🇦🇷", BDT: "🇧🇩", BRL: "🇧🇷",
  COP: "🇨🇴", DKK: "🇩🇰", EGP: "🇪🇬", HUF: "🇭🇺", IDR: "🇮🇩",
  ILS: "🇮🇱", INR: "🇮🇳", KWD: "🇰🇼", LKR: "🇱🇰", MXN: "🇲🇽",
  NOK: "🇳🇴", PKR: "🇵🇰", PLN: "🇵🇱", RUB: "🇷🇺", SAR: "🇸🇦",
  SEK: "🇸🇪", TWD: "🇹🇼", UAH: "🇺🇦", VND: "🇻🇳", ZAR: "🇿🇦"
};

const currencyDecimals = {
  JPY: 0, KRW: 0, VND: 0, IDR: 0, HUF: 0,
  TWD: 2, MYR: 2, SGD: 2, AUD: 2, CAD: 2,
  USD: 2, EUR: 2, GBP: 2, CHF: 2
};

// 默认币种列表
const defaultStrong = ["USD", "EUR", "GBP"];
const defaultWeak = ["HKD", "JPY", "KRW", "TRY"];

// 读取参数里的币种，没填用默认
const strongParam = (params.strongs || "").trim();
const weakParam = (params.weaks || "").trim();

const strongKeys = strongParam
  ? strongParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
  : defaultStrong;

const weakKeys = weakParam
  ? weakParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
  : defaultWeak;

const displayRates = [
  ...strongKeys.map(k => ({
    key: k,
    label: currencyLabels[k] || k,
    isBaseForeign: true,
    decimals: currencyDecimals[k] ?? 2
  })),
  ...weakKeys.map(k => ({
    key: k,
    label: currencyLabels[k] || k,
    isBaseForeign: false,
    decimals: currencyDecimals[k] ?? 2
  }))
];

function logInfo(message) {
  const timeStr = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  console.log(`[Exchange ${timeStr}] ${message}`);
}

function formatTimeToBeijing(timeInput) {
  if (!timeInput || timeInput === "未知") return "未知";
  let date = null;
  if (typeof timeInput === "number") {
    date = timeInput > 1e12 ? new Date(timeInput) : new Date(timeInput * 1000);
  } else if (typeof timeInput === "string") {
    const s = timeInput.trim();
    if (/^\d{10,13}$/.test(s)) {
      date = s.length === 13 ? new Date(Number(s)) : new Date(Number(s) * 1000);
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

function formatRate(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const sourceDomain = sourceUrl.match(/https?:\/\/([^/]+)/)?.[1] || sourceUrl;
  let content = "";
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
      rateValue = amount / rates[item.key];
      text = `${amount}${item.label}${flagMap[item.key] || ""} 兑换 人民币${flagMap.CNY} ${formatRate(rateValue, item.decimals)}`;
    } else {
      rateValue = amount * rates[item.key];
      text = `${amount}人民币${flagMap.CNY} 兑换 ${item.label}${flagMap[item.key] || ""} ${formatRate(rateValue, item.decimals)}`;
    }

    logInfo(`汇率信息：${text}`);

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
        fluctuations.push(`${item.key} 汇率${change > 0 ? "上涨" : "下跌"}：${changeStr}`);
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

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
    logInfo(`检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    logInfo("无汇率波动超出阈值");
  }

  content += `\n数据来源：${sourceDomain}\n数据更新时间：${lastUpdate}\n下次更新时间：${nextUpdate}`;
  logInfo(`刷新面板内容：\n${content}`);

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

fetchWithFallback(urls);
