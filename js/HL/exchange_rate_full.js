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
    { label: "🇺🇸1美元兑换", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { label: "🇪🇺1欧元兑换", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { label: "🇬🇧1英镑兑换", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { label: "🇨🇳1人民币兑换", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { label: "🇨🇳1人民币兑换", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { label: "🇨🇳1人民币兑换", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { label: "🇨🇳1人民币兑换", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  const content = displayRates.map(item =>
    `${item.label} ${formatRate(item.value(), item.decimals)}${item.suffix}`
  ).join("\n");

  const timestamp = new Date().toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });

  const panel = {
    title: `当前汇率信息 ${timestamp}`,
    content: content,
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
