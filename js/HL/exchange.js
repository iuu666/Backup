/**
 * 汇率监控脚本
 *
 * 功能总结：
 * - 每次运行时检测汇率波动，超过阈值即提醒（阈值可通过参数设置，默认0.3%）
 * - 支持参数 notify 控制是否推送手机通知（true开启，false关闭，默认开启）
 * - 面板展示当前各币种汇率及波动情况（带涨跌箭头和百分比）
 * - 通过持久化存储保存上次汇率，用于计算涨跌幅
 * - 支持自定义图标和图标颜色
 * - 面板标题显示接口更新时间和下次更新时间（UTC）
 */

// 汇率接口地址，基准货币为人民币CNY
const url = "https://open.er-api.com/v6/latest/CNY";

// 从 Surge 脚本参数中解析参数对象
const params = getParams($argument);

// 波动提醒阈值（百分比），默认0.3%
const threshold = parseFloat(params.threshold || "0.3");

// 是否开启推送通知，默认开启(true)
const enableNotify = (params.notify || "true").toLowerCase() === "true";

// 日志打印当前脚本执行时间（北京时间）
console.log(`[Exchange] 脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);

// 日志打印通知开关状态
console.log(`[Exchange] 通知开关状态：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

// 发起HTTP GET请求，获取汇率数据
$httpClient.get(url, function (error, response, data) {
  // 如果请求出错，打印日志并结束脚本，显示错误通知
  if (error) {
    console.log(`[Exchange] 请求失败：${error}`);
    $done({
      title: "汇率获取失败",           // 通知标题
      content: "请求错误：" + error,   // 通知内容
      icon: "xmark.octagon",           // 通知图标（红色叉号）
      "icon-color": "#FF3B30"
    });
    return; // 结束脚本
  }

  let rates, lastUpdate, nextUpdate;

  try {
    // 解析返回的 JSON 数据
    const parsed = JSON.parse(data);

    // 提取汇率数据字段
    rates = parsed.rates;
    if (!rates) throw new Error("No rates field");

    // 提取接口返回的最后更新时间（UTC字符串）
    lastUpdate = parsed.time_last_update_utc || "未知";

    // 提取接口返回的预计下次更新时间（UTC字符串）
    nextUpdate = parsed.time_next_update_utc || "未知";

    // 在日志打印更新时间信息
    console.log(`[Exchange] 数据最后更新时间（UTC）：${lastUpdate}`);
    console.log(`[Exchange] 预计下一次更新时间（UTC）：${nextUpdate}`);

  } catch (e) {
    // 解析失败时打印日志并结束脚本，显示错误通知
    console.log(`[Exchange] 数据解析异常`);
    $done({
      title: "汇率获取失败",
      content: "数据解析异常",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return; // 结束脚本
  }

  /**
   * 格式化数字，保留指定小数位，默认2位
   * @param {number|string} value 要格式化的数字
   * @param {number} decimals 小数位数，默认2
   * @returns {string} 格式化后的字符串
   */
  function formatRate(value, decimals = 2) {
    return Number(value).toFixed(decimals);
  }

  // 要展示的币种列表及对应的汇率计算方法
  // 统一计算结果单位都是人民币（CNY）
  const displayRates = [
    { key: "USD", label: "🇺🇸1美元兑换", value: () => 1 / rates.USD, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "EUR", label: "🇪🇺1欧元兑换", value: () => 1 / rates.EUR, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "GBP", label: "🇬🇧1英镑兑换", value: () => 1 / rates.GBP, suffix: "🇨🇳人民币", decimals: 2 },
    { key: "HKD", label: "🇨🇳1人民币兑换", value: () => rates.HKD, suffix: "🇭🇰港币", decimals: 2 },
    { key: "JPY", label: "🇨🇳1人民币兑换", value: () => rates.JPY, suffix: "🇯🇵日元", decimals: 0 },
    { key: "KRW", label: "🇨🇳1人民币兑换", value: () => rates.KRW, suffix: "🇰🇷韩元", decimals: 0 },
    { key: "TRY", label: "🇨🇳1人民币兑换", value: () => rates.TRY, suffix: "🇹🇷里拉", decimals: 2 }
  ];

  // 用于拼接面板内容字符串
  let content = "";

  // 用于保存波动超过阈值的币种信息，做提醒和通知
  let fluctuations = [];

  // 遍历币种列表，计算当前汇率并检测波动
  for (const item of displayRates) {
    // 当前汇率数值
    const current = item.value();

    // 格式化汇率值，保留小数
    const rounded = formatRate(current, item.decimals);

    // 从持久化存储读取上次汇率
    const prev = parseFloat($persistentStore.read("exrate_" + item.key));

    // 如果上次汇率存在，则计算涨跌百分比
    if (!isNaN(prev)) {
      const change = ((current - prev) / prev) * 100; // 涨跌幅百分比

      // 如果涨跌幅超过阈值，触发提醒
      if (Math.abs(change) >= threshold) {
        // 根据涨跌符号设置图标
        const symbol = change > 0 ? "📈" : "📉";

        // 涨跌百分比字符串，保留两位小数
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;

        // 详情信息字符串
        const detail = `当前汇率：${item.label} ${rounded}${item.suffix}`;

        // 记录本次波动信息
        fluctuations.push(`${item.key} 汇率${symbol === "📈" ? "上涨" : "下跌"}：${changeStr}`);

        // 如果通知开关开启，发送本地推送通知
        if (enableNotify) {
          $notification.post(
            `${symbol} ${item.key} ${change > 0 ? "上涨" : "下跌"}：${changeStr}`, // 通知标题
            "", // 副标题为空
            detail // 通知正文
          );
        }
      }
    }

    // 将当前汇率写入持久化存储，供下次比较
    $persistentStore.write(String(current), "exrate_" + item.key);

    // 拼接面板内容字符串
    content += `${item.label} ${rounded}${item.suffix}\n`;
  }

  // 如果有波动超过阈值的币种，追加波动提醒到面板内容
  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}`;
    console.log(`[Exchange] 🚨 检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    console.log("[Exchange] ✅ 无汇率波动超出阈值");
  }

  // 获取北京时间，格式化为时分秒，用于面板标题显示
  const beijingTime = new Date().toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });

  // 组装面板数据对象
  const panel = {
    // 面板标题：显示北京时间 + 接口返回的更新时间和下次更新时间（UTC）
    title: `当前汇率信息 ${beijingTime}\n更新时间（UTC）：${lastUpdate}\n下次更新时间（UTC）：${nextUpdate}`,

    // 面板内容：汇率信息 + 波动提醒
    content: content.trim(),

    // 图标及颜色（可通过参数自定义）
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  };

  // 日志打印最终刷新面板的内容
  console.log("[Exchange] 刷新面板，内容如下：\n" + content);

  // 结束脚本，返回面板数据
  $done(panel);
});

/**
 * 解析脚本传入的参数字符串，返回参数对象
 * @param {string} param 参数字符串，一般是 $argument
 * @returns {Object} 参数对象
 */
function getParams(param) {
  try {
    return Object.fromEntries(
      (param || $argument || "")
        .split("&")            // 按 & 分割参数
        .filter(Boolean)       // 过滤空字符串
        .map(item => item.split("=")) // 按 = 分割键值对
        .map(([k, v]) => [k, decodeURIComponent(v)]) // 对值进行解码
    );
  } catch (e) {
    // 解析失败返回空对象
    return {};
  }
}
