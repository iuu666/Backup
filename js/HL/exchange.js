/**
 * 汇率监控脚本（支持阈值提醒 + 通知开关 + 自定义刷新间隔）
 *
 * 参数说明：
 * - threshold: 汇率波动阈值百分比，超过触发提醒（默认0.3）
 * - notify: 是否推送通知 true/false（默认true）
 * - refresh_interval: 脚本内部控制刷新间隔，单位秒（默认3600秒）
 * - icon: 面板图标名（默认 bitcoinsign.circle）
 * - color: 面板图标颜色（默认 #EF8F1C）
 */

const url = "https://open.er-api.com/v6/latest/CNY";
const params = getParams($argument);

const threshold = parseFloat(params.threshold || "0.3");
const enableNotify = (params.notify || "true").toLowerCase() === "true";
const refreshInterval = parseInt(params.refresh_interval || "3600"); // 单位秒，默认1小时

// 读取上次更新时间（毫秒）
const lastFetchKey = "exrate_last_fetch_time";
const now = Date.now();
const lastFetch = parseInt($persistentStore.read(lastFetchKey) || "0");

// 判断是否达到脚本内部刷新间隔，未到则直接返回上次面板内容（缓存版）
if (now - lastFetch < refreshInterval * 1000) {
  console.log(`[Exchange] 未达到刷新间隔，跳过更新`);

  const savedContent = $persistentStore.read("exrate_last_panel") || "等待刷新...";
  const panel = {
    title: `当前汇率信息（缓存）`,
    content: savedContent,
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  };
  $done(panel);
  return;
}

// 到了刷新间隔，继续执行正常抓取
console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
console.log(`[Exchange] 通知开关状态：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

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

  let rates;
  try {
    const parsed = JSON.parse(data);
    rates = parsed.rates;
    if (!rates) throw new Error("No rates field");
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

  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

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

  const timestamp = new Date().toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });

  // 保存本次内容和更新时间到持久存储
  $persistentStore.write(String(now), lastFetchKey);
  $persistentStore.write(content.trim(), "exrate_last_panel");

  const panel = {
    title: `当前汇率信息 ${timestamp}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  };

  console.log("[Exchange] 刷新面板，内容如下：\n" + content);
  $done(panel);
});

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
