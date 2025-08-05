// 设置新的汇率 API 接口
const url = "https://open.er-api.com/v6/latest/CNY";

// 解析 Surge 模块参数（如 icon、color）
const params = getParams($argument);

// 发起 HTTP 请求获取汇率数据
$httpClient.get(url, function (error, response, data) {
  if (error) {
    // 如果请求失败，返回错误面板
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
    // 解析返回的 JSON 数据，提取 rates 字段
    const parsed = JSON.parse(data);
    rates = parsed.rates;
    if (!rates) throw new Error("No rates field");
  } catch (e) {
    // 如果解析失败，返回错误面板
    $done({
      title: "汇率获取失败",
      content: "数据解析异常",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }

  // 辅助函数：保留指定小数位数
  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

  // 要显示的货币列表及其计算方式
  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  let content = ""; // 汇率信息展示内容
  let fluctuations = []; // 汇率波动提醒内容

  for (const item of displayRates) {
    const current = item.value(); // 当前汇率
    const rounded = formatRate(current, item.decimals); // 四舍五入
    const prev = $persistentStore.read("exrate_" + item.key); // 读取之前的汇率

    // 如果有历史数据则比较差异
    if (prev) {
      const change = ((current - prev) / prev) * 100;
      if (change !== 0) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);
      }
    }

    // 存储当前汇率用于下次比较
    $persistentStore.write(String(current), "exrate_" + item.key);

    // 拼接汇率信息展示内容
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  // 获取北京时间，格式如 "20:47"
  const timestamp = new Date().toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/
