const url = "https://api.exchangerate-api.com/v4/latest/CNY";
const params = getParams($argument);

$httpClient.get(url, function (error, response, data) {
  if (error) {
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
    { key: "USD", label: "🇺🇸1美元兑换", name: "美元", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换", name: "欧元", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换", name: "英镑", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换", name: "港币", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换", name: "日元", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换", name: "韩元", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换", name: "土耳其里拉", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  let content = "";
  let fluctuations = [];

  for (const item of displayRates) {
    const current = item.value();
    const rounded = formatRate(current, item.decimals);
    const prev = $persistentStore.read("exrate_" + item.key);

    if (prev) {
      const change = ((current - prev) / prev) * 100;
      if (change !== 0) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.name} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);

        // 复制内容字符串
        const copyText = `1${item.name}兑换 ${rounded}元人民币`;

        // QX 自动写剪贴板
        if (typeof $clipboard !== "undefined") {
          $clipboard.write(copyText);
        }

        // 通知提示（带点击复制提示）
        $notification.post(
          `${item.name}汇率变动`,
          `${symbol === "📈" ? "上涨" : "下跌"}了 ${Math.abs(change).toFixed(2)}%`,
          `${copyText}（点击复制）`
        );
      }
    }

    $persistentStore.write(String(current), "exrate_" + item.key);
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  const timestamp = new Date().toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });

  if (fluctuations.length > 0) {
    content += "\n💱 汇率波动提醒：\n" + fluctuations.join("\n");
  }

  const panel = {
    title: `当前汇率信息 ${timestamp}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  };

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
