const url = "https://api.exchangerate-api.com/v4/latest/CNY";
const params = getParams($argument);  // 确保$argument已经传入
$httpClient.get(url, function(error, response, data) {
  if (error) {
    $done({
      title: "Error",
      content: "无法获取汇率信息，请稍后再试。",
      icon: "✖️",  // 错误图标
      "icon-color": "red"
    });
    return;
  }
  
  try {
    const rates = JSON.parse(data).rates;

    const usdToCny = (1 / rates.USD).toFixed(2);
    const cnyToHkd = rates.HKD.toFixed(2);
    const cnyToJpy = rates.JPY.toFixed(2);
    const cnyToKrw = rates.KRW.toFixed(2);
    const eurToCny = (1 / rates.EUR).toFixed(2);
    const gbpToCny = (1 / rates.GBP).toFixed(2);
    const tryToCny = rates.TRY.toFixed(2);

    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const content = `
🇺🇸1美元兑换 ${usdToCny}🇨🇳人民币
🇪🇺1欧元兑换 ${eurToCny}🇨🇳人民币
🇬🇧1英镑兑换 ${gbpToCny}🇨🇳人民币
🇨🇳1人民币兑换 ${cnyToHkd}🇭🇰港币
🇨🇳1人民币兑换 ${cnyToJpy}🇯🇵日元
🇨🇳1人民币兑换 ${cnyToKrw}🇰🇷韩元
🇨🇳1人民币兑换 ${tryToCny}🇹🇷里拉
    `;

    const panel = {
      title: `当前汇率信息 ${timestamp}`,
      content: content,
      icon: params.icon || "💵",  // 提供默认图标
      "icon-color": params.color || "green"  // 提供默认颜色
    };

    $done(panel);
    
  } catch (e) {
    $done({
      title: "Error",
      content: "解析汇率数据失败，请稍后再试。",
      icon: "✖️",
      "icon-color": "red"
    });
  }
});

function getParams(param) {
  if (!param) return {};  // 防止$argument为空时出错
  return Object.fromEntries(
    param
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}
