// 1.0
const currencies = [
  { key: "USD", label: "美元", decimals: 2 },
  { key: "EUR", label: "欧元", decimals: 2 },
  { key: "GBP", label: "英镑", decimals: 2 },
  { key: "HKD", label: "港币", decimals: 2 },
  { key: "JPY", label: "日元", decimals: 0 },
  { key: "KRW", label: "韩元", decimals: 0 },
  { key: "TRY", label: "里拉", decimals: 2 }
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

function fetchGoogleFinanceAll() {
  let results = {};
  let count = 0;

  currencies.forEach(({ key }) => {
    const url = `https://www.google.com/finance/quote/${key}-CNY`;
    logInfo(`请求Google Finance：${url}`);

    $httpClient.get(url, (error, response, data) => {
      count++;
      if (error || !data) {
        logInfo(`${key} 请求失败：${error || "无响应"}`);
      } else {
        const match = data.match(/data-last-price="([\d.]+)"/);
        if (match) {
          const rate = parseFloat(match[1]);
          if (!isNaN(rate)) {
            results[key] = rate;
            logInfo(`${key} 汇率抓取成功：${rate}`);
          } else {
            logInfo(`${key} 汇率解析失败`);
          }
        } else {
          logInfo(`${key} 未匹配到汇率`);
        }
      }

      if (count === currencies.length) {
        if (Object.keys(results).length === 0) {
          $done({
            title: "汇率获取失败",
            content: "Google Finance抓取所有币种均失败",
            icon: "xmark.octagon",
            "icon-color": "#FF3B30"
          });
          return;
        }
        processData(results, getCurrentBeijingTime(), "未知", "Google Finance");
      }
    });
  });
}

function getCurrentBeijingTime() {
  return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const sourceDomain = sourceUrl.match(/https?:\/\/([^/]+)/)?.[1] || sourceUrl;
  let content = "";
  const flagMap = {
    CNY: "🇨🇳", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧",
    HKD: "🇭🇰", JPY: "🇯🇵", KRW: "🇰🇷", TRY: "🇹🇷"
  };

  const displayRates = currencies.map(item => ({
    ...item,
    isBaseForeign: !["HKD", "JPY", "KRW", "TRY"].includes(item.key) // 保持强弱币分类逻辑
  }));

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
      // 强势币（外币兑人民币），Google Finance给的是1外币兑多少人民币
      // 你的计算是基数/汇率得人民币数量，保持原逻辑
      rateValue = amount / rates[item.key];
      text = `${amount}${item.label}${flagMap[item.key]} 兑换 人民币 ${rateValue.toFixed(item.decimals)}${flagMap.CNY}`;
    } else {
      // 弱势币（人民币兑外币），直接人民币基数 * 汇率
      rateValue = amount * rates[item.key];
      text = `${amount}人民币${flagMap.CNY} 兑换 ${item.label} ${rateValue.toFixed(item.decimals)}${flagMap[item.key]}`;
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
      logInfo(`缓存写入：${item.key} = ${rateValue.toFixed(item.decimals)}`);
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

function logInfo(message) {
  const timeStr = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  console.log(`[Exchange ${timeStr}] ${message}`);
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

// 脚本入口，开始抓取Google Finance所有汇率
fetchGoogleFinanceAll();
