/**
 * 汇率监控脚本（每次都提醒 + 本地通知）
 *
 * ✅ 每次运行都检测波动，超过 threshold（默认 0.3%）就发送通知
 * ✅ 面板中展示汇率和波动 📈📉
 * ✅ 日志中打印提醒内容
 * ✅ 本地推送提醒中展示汇率和涨跌幅
 */

const url = "https://open.er-api.com/v6/latest/CNY";
const params = getParams($argument);
const threshold = parseFloat(params.threshold || "0.3");

console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);

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
        fluctuations.push({
          title: `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
          detail: `当前汇率：${item.label} ${rounded}${item.suffix}`
        });

        // 本地推送通知
        $notification.post(
          `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`,
          "",
          `当前汇率：${item.label} ${rounded}${item.suffix}`
        );
      }
    }

    // 存储当前汇率供下次比较
    $persistentStore.write(String(current), "exrate_" + item.key);
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  // 添加波动提醒到面板内容
  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.map(f => f.title).join("\n")}`;
    console.log(`[Exchange] 🚨 检测到汇率波动：\n${fluctuations.map(f => f.title).join("\n")}`);
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
      ($argument || "")
        .split("&")
        .filter(Boolean)
        .map(item => item.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
  } catch (e) {
    return {};
  }
}
