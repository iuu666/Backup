const params = getParams($argument);
const apikey = params.apikey || "";
const url = `https://v6.exchangerate-api.com/v6/${apikey}/latest/CNY`;

$httpClient.get(url, function (error, response, data) {
  if (error) {
    $done({
      title: "汇率获取失败",
      content: "网络错误，请检查连接",
      icon: "exclamationmark.triangle",
      "icon-color": "red",
    });
    return;
  }

  try {
    const rates = JSON.parse(data).conversion_rates;
    const usdToCny = (1 / rates.USD).toFixed(2);
    const cnyToHkd = rates.HKD.toFixed(2);
    const cnyToJpy = rates.JPY.toFixed(2);
    const cnyToKrw = rates.KRW.toFixed(2);
    const eurToCny = (1 / rates.EUR).toFixed(2);
    const gbpToCny = (1 / rates.GBP).toFixed(2);
    const tryToCny = rates.TRY.toFixed(2);

    const timestamp = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const content = `
🇺🇸1美元兑 ${usdToCny}🇨🇳
🇪🇺1欧元兑 ${eurToCny}🇨🇳
🇬🇧1英镑兑 ${gbpToCny}🇨🇳
🇨🇳1人民币兑 ${cnyToHkd}🇭🇰
🇨🇳1人民币兑 ${cnyToJpy}🇯🇵
🇨🇳1人民币兑 ${cnyToKrw}🇰🇷
🇨🇳1人民币兑 ${tryToCny}🇹🇷
    `.trim();

    $done({
      title: `当前汇率 ${timestamp}`,
      content,
      icon: params.icon || "dollarsign.circle",
      "icon-color": params.color || "blue",
    });
  } catch (e) {
    $done({
      title: "汇率解析失败",
      content: "数据异常，请检查 API 密钥",
      icon: "xmark.octagon",
      "icon-color": "red",
    });
  }
});

function getParams(param) {
  return Object.fromEntries(
    param
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}
