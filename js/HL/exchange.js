const urls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

const params = getParams($argument);
const threshold = parseFloat(params.threshold || "0.3");
const enableNotify = (params.notify || "true").toLowerCase() === "true";

console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
console.log(`[Exchange] 通知开关状态：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

function formatTimeToBeijing(timeInput) {
  if (timeInput === undefined || timeInput === null || timeInput === "" || timeInput === "未知") return "未知";
  let date;
  if ((typeof timeInput === "number") || (/^\d{9,}$/.test(timeInput))) {
    date = new Date(Number(timeInput) * 1000);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(timeInput)) {
    date = new Date(timeInput + "T00:00:00Z");
  } else {
    date = new Date(timeInput);
  }
  if (isNaN(date)) return "时间格式异常";
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

function fetchWithFallback(urls, index = 0) {
  if (index >= urls.length) {
    console.log("[Exchange] ❌ 所有接口请求均失败，脚本结束");
    $done({
      title: "汇率获取失败",
      content: "所有接口请求均失败",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }
  const url = urls[index];
  console.log(`[Exchange] 正在请求接口：${url}`);
  $httpClient.get(url, (error, response, data) => {
    if (error || !data) {
      console.log(`[Exchange] 请求失败：${error || "无响应"}, 切换下一个接口`);
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
        lastUpdate = formatTimeToBeijing(parsed.time_last_updated);
        nextUpdate = "未知";
      } else if (url.includes("api.frankfurter.app")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.date);
        nextUpdate = "未知";
      } else {
        throw new Error("未知接口格式");
      }
      console.log(`[Exchange] 数据获取成功，接口：${url.match(/https?:\/\/([^/]+)/)[1]}`);
      console.log(`[Exchange] 数据最后更新时间（北京时间）：${lastUpdate}`);
      console.log(`[Exchange] 预计下一次更新时间（北京时间）：${nextUpdate}`);
      processData(rates, lastUpdate, nextUpdate, url);
    } catch (e) {
      console.log(`[Exchange] 数据解析异常：${e.message || e}, 尝试下一个接口`);
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
  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换人民币", value: () => 1 / rates.USD, suffix: "🇨🇳", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换人民币", value: () => 1 / rates.EUR, suffix: "🇨🇳", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换人民币", value: () => 1 / rates.GBP, suffix: "🇨🇳", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换港币", value: () => rates.HKD, suffix: "🇭🇰", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换日元", value: () => rates.JPY, suffix: "🇯🇵", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换韩元", value: () => rates.KRW, suffix: "🇰🇷", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换土耳其里拉", value: () => rates.TRY, suffix: "🇹🇷", decimals: 2 }
  ];
  let fluctuations = [];
  for (const item of displayRates) {
    if (!(item.key in rates)) {
      console.log(`[Exchange] 警告：${item.key} 数据缺失`);
      content += `${item.label} 数据缺失\n`;
      continue;
    }
    const current = item.value();
    const rounded = formatRate(current, item.decimals);
    const prev = parseFloat($persistentStore.read("exrate_" + item.key));
    if (!isNaN(prev)) {
      const change = ((current - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);
        if (enableNotify) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
            "",
            `当前汇率：${item.label} ${rounded}${item.suffix}`
          );
          console.log(`[Exchange] 通知发送：${item.key} ${change > 0 ? "上涨" : "下跌"} ${changeStr}`);
        }
      }
    }
    $persistentStore.write(String(current), "exrate_" + item.key);
    console.log(`[Exchange] 缓存写入：${item.key} = ${rounded}`);
    // 显示1单位基准币种换算目标币种（如 1人民币换港币）
    content += `${item.label} ${rounded}${item.suffix}\n`;

    // 支持unit参数，自定义换算单位（非基准币种），显示N单位兑换人民币
    if (item.key !== "CNY") {
      const unit = parseFloat(params[`unit_${item.key}`] || "1");
      const converted = item.key === "HKD" || item.key === "JPY" || item.key === "KRW" || item.key === "TRY" 
        ? (unit / rates[item.key]) // N单位外币兑换人民币（如港币、日元、韩元、土耳其里拉）
        : (unit / rates[item.key]); // 对美元、欧元、英镑等反转率也是这样计算
      content += `${unit}${item.key}兑换人民币 ${formatRate(converted, 2)} 🇨🇳\n`;
    }
  }
  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
    console.log(`[Exchange] 🚨 检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    console.log("[Exchange] ✅ 无汇率波动超出阈值");
  }
  content += `\n数据来源：${sourceDomain}\n数据更新时间：${lastUpdate}\n下次更新时间：${nextUpdate}`;
  console.log(`[Exchange] 刷新面板，内容如下：\n${content}`);
  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  $done({
    title: `当前汇率信息 ${beijingTime}`,
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
