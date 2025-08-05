/**
 * 汇率监控脚本（更新时间和下次更新时间均用北京时间中文格式显示）
 */

const url = "https://open.er-api.com/v6/latest/CNY"; // 汇率API地址，基准货币为人民币CNY
const params = getParams($argument); // 解析脚本参数
const threshold = parseFloat(params.threshold || "0.3"); // 波动阈值，默认0.3%
const enableNotify = (params.notify || "true").toLowerCase() === "true"; // 是否开启通知，默认开启

// 日志打印脚本执行时间（北京时间）
console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
console.log(`[Exchange] 通知开关状态：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

// 将UTC时间字符串格式化为北京时间的中文时间字符串
function formatUTCToBeijing(utcStr) {
  if (!utcStr || utcStr === "未知") return "未知";
  const date = new Date(utcStr);
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

$httpClient.get(url, function (error, response, data) {
  if (error) {
    console.log(`[Exchange] 请求失败：${error}`);
    $done({
      title: "汇率获取失败",
      content: "请求错误：" + error,
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  let rates, lastUpdate, nextUpdate;
  try {
    const parsed = JSON.parse(data);
    rates = parsed.rates;
    if (!rates) throw new Error("无汇率字段");

    // 格式化更新时间和下次更新时间为北京时间
    lastUpdate = formatUTCToBeijing(parsed.time_last_update_utc);
    nextUpdate = formatUTCToBeijing(parsed.time_next_update_utc);

    console.log(`[Exchange] 数据最后更新时间（北京时间）：${lastUpdate}`);
    console.log(`[Exchange] 预计下一次更新时间（北京时间）：${nextUpdate}`);
  } catch (e) {
    console.log(`[Exchange] 数据解析异常`);
    $done({
      title: "汇率获取失败",
      content: "数据解析异常",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  // 格式化数字，默认保留2位小数
  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

  // 显示的币种及对应汇率计算
  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  let content = "";
  let fluctuations = [];

  for (const item of displayRates) {
    const current = item.value();
    const rounded = formatRate(current, item.decimals);
    const prev = parseFloat($persistentStore.read("exrate_" + item.key));

    if (!isNaN(prev)) {
      const change = ((current - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        const detail = `当前汇率：${item.label} ${rounded}${item.suffix}`;

        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);

        if (enableNotify) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
            "",
            detail
          );
        }
      }
    }

    $persistentStore.write(String(current), "exrate_" + item.key);
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}`;
    console.log(`[Exchange] 🚨 检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    console.log("[Exchange] ✅ 无汇率波动超出阈值");
  }

  // 北京时间格式，用于面板标题显示
  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const panel = {
    title: `当前汇率信息 ${beijingTime}\n更新时间（北京时间）：${lastUpdate}\n下次更新时间（北京时间）：${nextUpdate}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  };

  console.log("[Exchange] 刷新面板，内容如下：\n" + content);
  $done(panel);
});

// 解析参数函数
function getParams(param) {
  try {
    return Object.fromEntries(
      (param || $argument || "")
        .split("&")
        .filter(Boolean)
        .map(item => item.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
  } catch {
    return {};
  }
}
