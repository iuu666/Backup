/**
 * 汇率监控脚本
 * 优先从 Google Finance 网页抓取汇率（USD、EUR、GBP、HKD、JPY、KRW、TRY）
 * 网页失败则自动切换到多API备用接口补充数据
 * 支持波动提醒，通知冷却，面板自定义参数等
 */

const urls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

// 参数处理
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

// 7个币种，前3强势币种优先网页，后4弱势币种优先网页，失败用API补
const displayRates = [
  { key: "USD", label: "美元", isStrong: true, decimals: 4 },
  { key: "EUR", label: "欧元", isStrong: true, decimals: 4 },
  { key: "GBP", label: "英镑", isStrong: true, decimals: 4 },
  { key: "HKD", label: "港币", isStrong: false, decimals: 4 },
  { key: "JPY", label: "日元", isStrong: false, decimals: 0 },
  { key: "KRW", label: "韩元", isStrong: false, decimals: 0 },
  { key: "TRY", label: "里拉", isStrong: false, decimals: 4 }
];

const flagMap = {
  CNY: "🇨🇳", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧",
  HKD: "🇭🇰", JPY: "🇯🇵", KRW: "🇰🇷", TRY: "🇹🇷"
};

logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
logInfo(`汇率波动阈值：${threshold}%`);
logInfo(`兑换基数（强势币）：${strongAmount}，兑换基数（弱势币）：${weakAmount}`);
logInfo(`通知冷却时间：${notifyCooldownMinutes} 分钟`);

(async () => {
  try {
    // 先抓网页数据
    const webData = await fetchFromWeb();

    // 再抓API数据，作为备份
    const apiData = await fetchFromAPIs(urls);

    // 合并网页+API数据，网页优先，API补缺
    const finalRates = {};
    const sourceMap = {}; // 记录数据来源（网页 or API）
    for (const item of displayRates) {
      if (webData.rates && typeof webData.rates[item.key] === "number") {
        finalRates[item.key] = webData.rates[item.key];
        sourceMap[item.key] = "网页";
      } else if (apiData && apiData.rates && typeof apiData.rates[item.key] === "number") {
        finalRates[item.key] = apiData.rates[item.key];
        sourceMap[item.key] = "API";
      } else {
        finalRates[item.key] = NaN;
        sourceMap[item.key] = "无数据";
      }
    }

    // 时间取网页时间优先，没有用API时间
    const lastUpdate = webData.lastUpdate || apiData.lastUpdate || "未知";
    const nextUpdate = webData.nextUpdate || apiData.nextUpdate || null;

    // 生成面板内容和日志
    let content = "";
    let fluctuations = [];

    for (const item of displayRates) {
      const key = item.key;
      const rate = finalRates[key];
      const from = sourceMap[key];
      if (isNaN(rate)) {
        content += `${item.label}(${key}) 数据缺失\n`;
        logInfo(`警告：${item.label}(${key}) 无有效数据`);
        continue;
      }
      const amount = item.isStrong ? strongAmount : weakAmount;
      let value;
      let text;

      if (item.isStrong) {
        value = amount / rate;
        text = `${amount}${item.label}${flagMap[key]} 兑换 人民币${flagMap.CNY} ${value.toFixed(item.decimals)}`;
      } else {
        value = amount * rate;
        text = `${amount}人民币${flagMap.CNY} 兑换 ${item.label}${flagMap[key]} ${value.toFixed(item.decimals)}`;
      }

      text += ` （${from}）`;
      content += text + "\n";
      logInfo(`汇率信息：${text}`);

      // 检测波动并通知
      let prev = NaN;
      try {
        const cacheStr = $persistentStore.read("exrate_" + key);
        prev = cacheStr !== null ? parseFloat(cacheStr) : NaN;
      } catch { prev = NaN; }

      if (!isNaN(prev)) {
        const change = ((value - prev) / prev) * 100;
        if (Math.abs(change) >= threshold) {
          const symbol = change > 0 ? "📈" : "📉";
          const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
          fluctuations.push(`${key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);
          if (enableNotify && canNotify(key)) {
            $notification.post(
              `${symbol} ${key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
              "",
              `当前汇率：${text}`
            );
            logInfo(`通知发送：${key} ${change > 0 ? "上涨" : "下跌"} ${changeStr}`);
            setNotifyTime(key);
          }
        }
      }

      try {
        $persistentStore.write(String(value), "exrate_" + key);
        logInfo(`缓存写入：${key} = ${value.toFixed(item.decimals)}`);
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

    content += `\n数据最后更新时间：${lastUpdate}`;
    if (nextUpdate) content += `\n预计下次更新时间：${nextUpdate}`;

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

  } catch (e) {
    logInfo(`脚本执行异常：${e.message || e}`);
    $done({
      title: "汇率监控失败",
      content: e.message || "未知错误",
      icon: "exclamationmark.triangle",
      "icon-color": "#FF3B30"
    });
  }
})();

// --- 函数区 ---

// 抓网页数据（Google Finance）
function fetchFromWeb() {
  return new Promise((resolve) => {
    const url = "https://www.google.com/finance/quote/USD-CNY";
    $httpClient.get(url, (err, resp, data) => {
      if (err || !data) {
        logInfo("网页抓取失败");
        resolve({ rates: null, lastUpdate: null, nextUpdate: null });
        return;
      }
      try {
        // 提取汇率对应的7个币种，从网页只拿美元兑人民币，其他币种网页未必有，网页只做示范抓美元兑人民币汇率和时间
        const usdMatch = data.match(/<div class="YMlKec fxKbKc">([\d.]+)<\/div>/);
        const timeMatch = data.match(/<div class="ygUjEc" jsname="Vebqub">([^<]+?) · <a href="https:\/\/www\.google\.com\/intl\/zh-CN.*?免责声明<\/a><\/div>/);
        let lastUpdate = timeMatch ? timeMatch[1].trim() : null;

        // 汇率数据格式准备
        const rates = {};

        if (usdMatch && usdMatch[1]) {
          rates["USD"] = parseFloat(usdMatch[1]);
        }

        // 其它币种网页未抓取，网页数据只有美元兑人民币汇率，其他币种用API补充
        resolve({ rates, lastUpdate, nextUpdate: null });
      } catch (e) {
        logInfo("网页解析异常：" + e.message);
        resolve({ rates: null, lastUpdate: null, nextUpdate: null });
      }
    });
  });
}

// 抓API数据，循环请求多个备用接口，成功即返回
function fetchFromAPIs(urls, index = 0) {
  return new Promise((resolve) => {
    if (index >= urls.length) {
      logInfo("所有API接口请求失败");
      resolve({ rates: null, lastUpdate: null, nextUpdate: null });
      return;
    }
    const url = urls[index];
    logInfo(`请求API接口：${url}`);
    $httpClient.get(url, (error, response, data) => {
      if (error || !data) {
        logInfo(`API接口请求失败，尝试下一个接口`);
        resolve(fetchFromAPIs(urls, index + 1));
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
          nextUpdate = null;
        } else if (url.includes("api.frankfurter.app")) {
          rates = parsed.rates;
          lastUpdate = formatTimeToBeijing(parsed.date);
          nextUpdate = null;
        } else {
          throw new Error("未知接口格式");
        }
        resolve({ rates, lastUpdate, nextUpdate });
      } catch (e) {
        logInfo(`API数据解析异常：${e.message}，尝试下一个接口`);
        resolve(fetchFromAPIs(urls, index + 1));
      }
    });
  });
}

// 时间格式化：ISO字符串或时间戳转北京时间字符串
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

// 日志打印（带北京时间时分秒）
function logInfo(msg) {
  const timeStr = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  console.log(`[汇率监控 ${timeStr}] ${msg}`);
}

// 通知冷却判断
function canNotify(key) {
  try {
    const lastNotify = parseInt($persistentStore.read("notify_time_" + key)) || 0;
    return Date.now() - lastNotify > notifyCooldownMinutes * 60 * 1000;
  } catch {
    return true;
  }
}

// 写入通知时间戳
function setNotifyTime(key) {
  try {
    $persistentStore.write(String(Date.now()), "notify_time_" + key);
  } catch (e) {
    logInfo(`通知时间写入异常：${e.message || e}`);
  }
}

// 参数解析
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
