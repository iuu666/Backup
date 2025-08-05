/**
 * 汇率监控脚本（适用于 Surge 面板）
 * 
 * ✅ 功能说明：
 * 1. 获取人民币(CNY)汇率数据，支持多币种显示；
 * 2. 每日首次检测时，如果波动超过阈值（默认0.3%），触发提醒；
 * 3. 每次运行都会刷新面板显示，记录是否提醒；
 * 4. 日志中输出提醒状态，面板中显示提醒信息；
 * 5. 支持参数配置 threshold / icon / color。
 */

const url = "https://open.er-api.com/v6/latest/CNY";
const params = getParams($argument);
const threshold = parseFloat(params.threshold || "0.3");
const today = new Date().toISOString().slice(0, 10);
const remindKey = "exrate_daily_reminded";
const lastRemindDate = $persistentStore.read(remindKey);
const remindedToday = lastRemindDate === today;

// ✅ 打印当前执行时间
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
      if (Math.abs(change) >= threshold && !remindedToday) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);
      }
    }

    $persistentStore.write(String(current), "exrate_" + item.key);
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  // ✅ 添加提醒状态到日志 & 面板内容
  if (!remindedToday) {
    if (fluctuations.length > 0) {
      console.log(`[Exchange] ✅ 今日首次提醒，内容如下：\n${fluctuations.join("\n")}`);
      content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}`;
      content += `\n✅ 今日首次提醒（已发送通知）`;
    } else {
      console.log("[Exchange] 🟡 今日首次执行，但无汇率波动，未发送提醒");
      content += `\n⏳ 今日首次执行，无波动，无需提醒`;
    }
    $persistentStore.write(today, remindKey);
  } else {
    console.log("[Exchange] 🔄 今日已提醒过，跳过重复提醒");
    content += `\n✅ 今日已提醒`;
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
