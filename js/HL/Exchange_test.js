/**
 * 汇率监控脚本（基准货币：CNY）
 * Author: okk
 * Version: 1.3
 * Last Updated: 2025-08-07
 * Environment: Surge,其他未知
 *
 * ------------------------------------------------------------
 * 📌 功能概述:
 * ------------------------------------------------------------
 * 本脚本基于多源汇率数据（Google Finance + API 备选）实现以下功能：
 *
 * 1. 实时监控 CNY 对 7 种主要货币的汇率变动
 * 2. 自动从 Google Finance 抓取网页数据，确保第一手市场报价
 * 3. 若 Google 数据缺失或异常，自动回退至多组备选 API
 * 4. 提供汇率波动检测功能，支持用户自定义波动阈值
 * 5. 汇率变化超出设定阈值时，可通过通知提醒用户
 * 6. 支持每种币种设置通知冷却时间，避免重复提醒
 * 7. 支持自定义货币基数：
 *    - 对于强势币种（如 USD、EUR、GBP），可自定义兑换单位基数（默认为 1）
 *    - 对于弱势币种（如 JPY、KRW、HKD、TRY），可自定义人民币兑换单位基数（默认为 1）
 *    该功能方便用户根据实际需求调整汇率换算的基础数量
 * 8. 汇率数据持久化缓存，便于进行前后变化对比
 * 9. 脚本输出适配 Surge 面板，模块支持自定义参数
 *
 * ------------------------------------------------------------
 * 🌐 支持币种（自用固定顺序，不接受建议）：
 * ------------------------------------------------------------
 * - USD 🇺🇸 美元
 * - EUR 🇪🇺 欧元
 * - GBP 🇬🇧 英镑
 * - HKD 🇭🇰 港币
 * - JPY 🇯🇵 日元
 * - KRW 🇰🇷 韩元
 * - TRY 🇹🇷 土耳其里拉
 *
 * 所有汇率基准为 CNY，计算方式如下：
 * - 强势币种（如 USD）：以 1 单位外币换算成人民币
 * - 弱势币种（如 JPY）：以 1 单位人民币换算为外币
 *
 * ------------------------------------------------------------
 * ⚙️ 参数配置：
 * ------------------------------------------------------------
 * 所有参数均为可自定义，示例见下方
 *
 * - `threshold`（数值）   ：汇率波动提醒阈值，单位为百分比，默认 `0.1`
 * - `notify`（true/false）：是否启用系统通知提醒，默认 `true`
 * - `notify_cooldown`（整数）：单币种通知冷却时间（分钟），默认 `5`
 * - `base_strong`（数值） ：强势币种换算单位（如 USD），默认 `1`
 * - `base_weak`（数值）   ：弱势币种换算单位（如 JPY），默认 `1`
 * - `icon`（字符串）      ：Surge 面板图标，默认 `bitcoinsign.circle`
 * - `color`（字符串）     ：Surge 面板图标颜色，默认 `#EF8F1C`
 *
 * ------------------------------------------------------------
 * 🔁 数据来源优先级与降级机制：
 * ------------------------------------------------------------
 * 1. 优先使用 Google 财经（https://www.google.com/finance/quote/XXX-CNY）
 * 2. 若 Google 数据部分缺失 → 使用 API 补全（open.er-api.com 等）
 * 3. 若 Google 完全失败 → 全量使用 API 数据（多源轮询降级）
 *
 * 所有接口响应解析均带 `try-catch` 容错，避免因异常中断执行
 *
 * ------------------------------------------------------------
 * 📤 Surge面板输出内容说明：
 * ------------------------------------------------------------
 * - 汇率面板标题：当前北京时间（精确至秒）
 * - 每个币种显示：当前换算结果 + 来源标识（WEB/API）
 * - 如发生波动：在面板中追加“汇率波动提醒”列表
 * - 显示最后更新时间与预估下一次更新时间（获取不到的不显示）
 *
 * ------------------------------------------------------------
 * 🧠 使用建议：
 * ------------------------------------------------------------
 * - 建议设置脚本每 2~4 小时运行一次，获取数据精度与资源平衡
 * - 不建议执行频率过高，避免频繁通知或接口限流
 *
 */

// 汇率源配置与基准币种设置 
const googleCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"]; // 要抓取的币种列表，基准是CNY
const baseCurrency = "CNY"; // 基准币种，人民币

// 汇率API接口列表，依次备用
const apiUrls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];

// ✅ 推荐的参数解析，兼容 Surge 的模块参数传入格式
const params = (() => {
  if (typeof $argument !== "undefined") {
    return Object.fromEntries(
      $argument.split("&").map(p => {
        const [key, value = ""] = p.split("="); // 拆分key=value
        return [key.trim(), decodeURIComponent(value)]; // 去空白并解码value
      })
    );
  }
  return {}; // 如果没有参数，返回空对象
})();

// 参数解析与默认值设置 
const thresholdRaw = parseFloat(params.threshold); // 解析波动阈值，字符串转浮点数
const threshold = (isNaN(thresholdRaw) || thresholdRaw <= 0) ? 0.1 : thresholdRaw; // 无效则默认0.1%
const enableNotify = (params.notify || "true").toLowerCase() === "true"; // 是否开启通知，默认开启
const strongAmountRaw = parseFloat(params.base_strong); // 强势币兑换基数，浮点数
const strongAmount = (isNaN(strongAmountRaw) || strongAmountRaw <= 0) ? 1 : strongAmountRaw; // 默认1
const weakAmountRaw = parseFloat(params.base_weak); // 弱势币兑换基数，浮点数
const weakAmount = (isNaN(weakAmountRaw) || weakAmountRaw <= 0) ? 1 : weakAmountRaw; // 默认1
const notifyCooldownMinutesRaw = parseInt(params.notify_cooldown); // 通知冷却时间，整数分钟
const notifyCooldownMinutes = (isNaN(notifyCooldownMinutesRaw) || notifyCooldownMinutesRaw <= 0) ? 5 : notifyCooldownMinutesRaw; // 默认5分钟冷却

// 调试日志，打印脚本执行时间（北京时间）
logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
// 打印通知开关状态
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
// 打印汇率波动阈值
logInfo(`汇率波动阈值：${threshold}%`);
// 打印兑换基数设置
logInfo(`兑换基数（强势币）：${strongAmount}，兑换基数（弱势币）：${weakAmount}`);
// 打印通知冷却时间
logInfo(`通知冷却时间：${notifyCooldownMinutes} 分钟`);

let globalGoogleResult = null;  // 全局变量保存谷歌抓取结果
let globalApiResult = null;     // 全局变量保存API补充结果

// 主入口，先尝试谷歌财经抓取所有币种汇率
fetchFromGoogle((googleResult) => {
  if (googleResult && Object.keys(googleResult.rates).length > 0) {
    globalGoogleResult = googleResult; // 保存谷歌数据结果
    // 找出谷歌抓取中缺失的币种
    const missingCurrencies = googleCurrencies.filter(c => !(c in googleResult.rates));
    if (missingCurrencies.length === 0) {
      // 谷歌抓取全部成功，无需补充，直接处理数据
      logInfo("谷歌财经所有币种均抓取成功，无需API补充");
      processData(googleResult.rates, googleResult.lastUpdate, googleResult.nextUpdate, null);
    } else {
      // 部分币种缺失，用API补充缺失币种数据
      logInfo(`谷歌财经部分币种缺失，开始用API补充缺失币种：${missingCurrencies.join(", ")}`);
      fetchFromApiForCurrencies(missingCurrencies, (apiResult) => {
        globalApiResult = apiResult; // 保存API补充结果
        // 合并谷歌与API结果，API补充缺失币种
        const combinedRates = { ...googleResult.rates, ...apiResult.rates };
        processData(combinedRates, null, null, null); // 统一处理数据，更新时间单独处理
      });
    }
  } else {
    // 谷歌财经抓取失败，整体用API接口fallback获取汇率
    logInfo("谷歌财经抓取失败，开始使用API接口fallback");
    fetchWithFallback(apiUrls, 0);
  }
});

// 从谷歌财经抓取函数，参数是回调函数callback
function fetchFromGoogle(callback) {
  const results = {};          // 保存抓取到的汇率，单位是基准币种的倒数（google结果是curr->baseCurrency）
  let completed = 0;           // 完成计数，等待所有请求结束
  let hasError = false;        // 是否有错误发生
  let lastUpdateTimestamp = 0; // 记录最新更新时间戳（秒）

  // 请求完成后调用此函数检测是否所有请求都完成
  function tryFinish() {
    completed++;
    if (completed === googleCurrencies.length) { // 全部请求完成
      if (hasError && Object.keys(results).length === 0) {
        callback(null); // 都失败了，回调null
        return;
      }
      // 转换成基准CNY的rates（谷歌数据是币种兑CNY汇率，这里转为CNY兑币种汇率）
      const rates = {};
      for (const curr of googleCurrencies) {
        if (curr === baseCurrency) {
          rates[curr] = 1; // 基准币种对自身汇率固定为1
        } else if (results[curr]) {
          rates[curr] = 1 / results[curr]; // 转换成 CNY 对该币种的汇率
        }
      }
      const lastUpdate = formatTimeToBeijing(lastUpdateTimestamp * 1000); // 转换时间戳为北京时间字符串
      const nextUpdate = "未知"; // 谷歌无下一次更新时间信息
      logInfo(`谷歌财经所有币种汇率抓取完成，时间：${lastUpdate}`);
      callback({ rates, lastUpdate, nextUpdate }); // 回调结果对象
    }
  }

  // 对每个币种请求谷歌财经对应页面
  for (const curr of googleCurrencies) {
    if (curr === baseCurrency) {
      results[curr] = 1; // 基准币种直接赋值1
      tryFinish();       // 请求计数+1
      continue;
    }
    const url = `https://www.google.com/finance/quote/${curr}-${baseCurrency}`; // 谷歌财经汇率页面URL
    logInfo(`请求谷歌财经汇率页面：${url}`);
    $httpClient.get(url, (error, response, data) => { // 发送HTTP GET请求
      if (error || !data) {
        logInfo(`谷歌财经请求失败：${curr} - ${error || "无响应"}`);
        hasError = true;
        tryFinish();
        return;
      }
      try {
        // 正则匹配页面中含汇率的div标签，提取币种、目标币种、汇率和时间戳
        const regex = /<div[^>]*data-source="(\w+)"[^>]*data-target="(\w+)"[^>]*data-last-price="([\d\.]+)"[^>]*data-last-normal-market-timestamp="(\d+)"[^>]*>/g;
        let match, foundRate = null, foundTimestamp = null;
        while ((match = regex.exec(data)) !== null) {
          const [_, source, target, priceStr, tsStr] = match;
          if (source === curr && target === baseCurrency) {
            foundRate = parseFloat(priceStr);       // 汇率
            foundTimestamp = parseInt(tsStr);       // 时间戳（秒）
            break;
          }
        }
        if (foundRate === null) {
          logInfo(`未找到${curr}≈${baseCurrency}汇率`);
          hasError = true;
        } else {
          results[curr] = foundRate; // 保存汇率（单位是curr对baseCurrency）
          if (foundTimestamp > lastUpdateTimestamp) lastUpdateTimestamp = foundTimestamp; // 取最大更新时间
          logInfo(`谷歌财经抓取${curr}≈${baseCurrency}汇率成功：${foundRate}`);
        }
      } catch (e) {
        logInfo(`解析${curr}汇率异常：${e.message || e}`);
        hasError = true;
      }
      tryFinish(); // 当前请求结束，计数+1
    });
  }
}

// 用API补充部分币种汇率，参数是缺失币种列表和回调函数
function fetchFromApiForCurrencies(currencyList, callback) {
  let apiIndex = 0; // 当前尝试的API接口索引

  // 尝试用当前API接口请求数据
  function tryApiFetch() {
    if (apiIndex >= apiUrls.length) { // 全部API接口尝试完毕仍失败
      logInfo("❌ 所有接口请求均失败，补充币种失败");
      callback({ rates: {}, lastUpdate: "未知", nextUpdate: "未知" }); // 返回空结果
      return;
    }
    const url = apiUrls[apiIndex];
    logInfo(`补充接口请求：${url}`);
    $httpClient.get(url, (error, response, data) => {
      if (error || !data) {
        logInfo(`请求失败：${error || "无响应"}，尝试下一个接口`);
        apiIndex++;
        tryApiFetch();
        return;
      }
      try {
        const parsed = JSON.parse(data); // 解析JSON数据
        let ratesRaw, lastUpdateRaw, nextUpdateRaw;
        if (url.includes("open.er-api.com")) {
          ratesRaw = parsed.rates;
          lastUpdateRaw = parsed.time_last_update_utc;
          nextUpdateRaw = parsed.time_next_update_utc;
        } else if (url.includes("api.exchangerate-api.com")) {
          ratesRaw = parsed.rates;
          lastUpdateRaw = parsed.time_last_updated * 1000 || parsed.time_last_updated;
          nextUpdateRaw = "未知";
        } else if (url.includes("api.frankfurter.app")) {
          ratesRaw = parsed.rates;
          lastUpdateRaw = parsed.date;
          nextUpdateRaw = "未知";
        } else {
          throw new Error("未知接口格式");
        }
        // 过滤只要目标缺失币种的汇率数据
        const filteredRates = {};
        for (const cur of currencyList) {
          if (cur === baseCurrency) {
            filteredRates[cur] = 1;
          } else if (ratesRaw && ratesRaw[cur] !== undefined) {
            filteredRates[cur] = ratesRaw[cur];
          }
        }
        if (Object.keys(filteredRates).length > 0) {
          logInfo(`补充接口数据获取成功，接口：${url.match(/https?:\/\/([^/]+)/)[1]}`);
          callback({
            rates: filteredRates,
            lastUpdate: formatTimeToBeijing(lastUpdateRaw),
            nextUpdate: formatTimeToBeijing(nextUpdateRaw)
          });
        } else {
          logInfo(`补充接口无目标币种数据，尝试下一个接口`);
          apiIndex++;
          tryApiFetch();
        }
      } catch (e) {
        logInfo(`补充接口数据解析异常：${e.message || e}，尝试下一个接口`);
        apiIndex++;
        tryApiFetch();
      }
    });
  }

  tryApiFetch(); // 启动API补充请求
}

// 失败时用API接口fallback抓取（整体抓取所有币种）
function fetchWithFallback(urls, index = 0) {
  if (index >= urls.length) {
    logInfo("❌ 所有接口请求均失败，脚本结束");
    $done({
      title: "汇率获取失败",
      content: "所有接口请求均失败",
      icon: "xmark.octagon",
      "icon-color": "#FF3B30"
    });
    return;
  }
  const url = urls[index];
  logInfo(`请求接口：${url}`);
  $httpClient.get(url, (error, response, data) => {
    if (error || !data) {
      logInfo(`请求失败：${error || "无响应"}，尝试下一个接口`);
      fetchWithFallback(urls, index + 1); // 递归请求下一个接口
      return;
    }
    try {
      const parsed = JSON.parse(data);
      let rates, lastUpdate, nextUpdate;
      if (url.includes("open.er-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.time_last_update_utc);
        nextUpdate = formatTimeToBeijing(parsed.time_next_update_utc);
      } else if (url.includes("api.exchangerate-api.com")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.time_last_updated * 1000 || parsed.time_last_updated);
        nextUpdate = "未知";
      } else if (url.includes("api.frankfurter.app")) {
        rates = parsed.rates;
        lastUpdate = formatTimeToBeijing(parsed.date);
        nextUpdate = "未知";
      } else {
        throw new Error("未知接口格式");
      }
      logInfo(`数据获取成功，接口：${url.match(/https?:\/\/([^/]+)/)[1]}`);
      logInfo(`数据最后更新时间（北京时间）：${lastUpdate}`);
      logInfo(`预计下一次更新时间（北京时间）：${nextUpdate}`);
      processData(rates, lastUpdate, nextUpdate, url); // 处理抓取的数据
    } catch (e) {
      logInfo(`数据解析异常：${e.message || e}，尝试下一个接口`);
      fetchWithFallback(urls, index + 1); // 解析失败尝试下一个接口
    }
  });
}

// 处理汇率数据并生成面板内容，逐条显示数据来源
function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const googleRates = globalGoogleResult?.rates || {}; // 谷歌汇率数据
  const apiRates = globalApiResult?.rates || {};       // API汇率数据

  // 定义要展示的币种及其属性
  const displayRates = [
    { key: "USD", label: "美元", isBaseForeign: true, decimals: 2 },
    { key: "EUR", label: "欧元", isBaseForeign: true, decimals: 2 },
    { key: "GBP", label: "英镑", isBaseForeign: true, decimals: 2 },
    { key: "HKD", label: "港币", isBaseForeign: false, decimals: 2 },
    { key: "JPY", label: "日元", isBaseForeign: false, decimals: 0 },
    { key: "KRW", label: "韩元", isBaseForeign: false, decimals: 0 },
    { key: "TRY", label: "里拉", isBaseForeign: false, decimals: 2 }
  ];

  // 币种对应国旗emoji映射
  const flagMap = {
    CNY: "🇨🇳", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧",
    HKD: "🇭🇰", JPY: "🇯🇵", KRW: "🇰🇷", TRY: "🇹🇷"
  };

  // 币种中文名映射
  const nameMap = {
    USD: "美元", EUR: "欧元", GBP: "英镑",
    HKD: "港币", JPY: "日元", KRW: "韩元", TRY: "里拉"
  };

  let content = "";           // 最终面板文本内容
  let fluctuations = [];      // 汇率波动提醒列表

  for (const item of displayRates) {
    let rateValue;
    let sourceLabel = "";

    if (googleRates[item.key] !== undefined) { // 优先使用谷歌汇率
      sourceLabel = "WEB";
      rateValue = item.isBaseForeign
        ? strongAmount / googleRates[item.key] // 外币兑人民币，强势币处理
        : weakAmount * googleRates[item.key];  // 人民币兑外币，弱势币处理

      // 👇调试输出：确认是否正确乘上基数（主要针对韩元）
      if (item.key === "KRW") {
        logInfo(`【调试】KRW 使用 Google 数据`);
        logInfo(`【调试】KRW weakAmount = ${weakAmount}`);
        logInfo(`【调试】KRW googleRate = ${googleRates["KRW"]}`);
        logInfo(`【调试】KRW 显示结果 = ${rateValue}`);
      }

    } else if (apiRates[item.key] !== undefined) { // 没有谷歌数据，使用API数据
      sourceLabel = "API";
      rateValue = item.isBaseForeign
        ? strongAmount / apiRates[item.key]
        : weakAmount * apiRates[item.key];

      // 👇调试输出：如果没有 Google，使用 API 的情况
      if (item.key === "KRW") {
        logInfo(`【调试】KRW 使用 API 数据`);
        logInfo(`【调试】KRW weakAmount = ${weakAmount}`);
        logInfo(`【调试】KRW apiRate = ${apiRates["KRW"]}`);
        logInfo(`【调试】KRW 显示结果 = ${rateValue}`);
      }

    } else {
      logInfo(`警告：${item.key} 数据缺失`); // 两边都无数据，提示缺失
      content += `${item.label} 数据缺失\n`;
      continue;
    }

    // 根据币种强弱构造显示文本，带国旗符号
    const text = item.isBaseForeign
      ? `${strongAmount}${item.label}${flagMap[item.key]} ≈ 人民币 ${formatRate(rateValue, item.decimals)}${flagMap.CNY}`
      : `${weakAmount}人民币${flagMap.CNY} ≈ ${item.label} ${formatRate(rateValue, item.decimals)}${flagMap[item.key]}`;

    content += `${text} （${sourceLabel}）\n`; // 添加显示内容

    logInfo(`汇率信息：${text} （${sourceLabel}）`); // 打印日志

    let prev = NaN; // 读取缓存中的之前汇率
    try {
      const cacheStr = $persistentStore.read("exrate_" + item.key);
      prev = cacheStr !== null ? parseFloat(cacheStr) : NaN;
    } catch {
      prev = NaN;
    }

    if (!isNaN(prev)) { // 计算波动百分比
      const change = ((rateValue - prev) / prev) * 100;

      // —— 这里是波动提醒格式替换开始 —— 
      if (Math.abs(change) >= threshold) { // 超过阈值则触发提醒
        const symbol = change > 0 ? "↑" : "↓"; // 使用 ↑ 和 ↓ 表示涨跌
        const sign = change > 0 ? "+" : "-";  // 显示正负号
        const absChange = Math.abs(change).toFixed(2); // 保留两位小数的绝对变化值
        const changeStr = `${symbol} ${sign}${absChange}%`; // 拼接符号和数值，符号后带空格

        // 构造波动提醒文本，例如：美元：↑ +0.45%
        fluctuations.push(`${nameMap[item.key]}：${changeStr}`);

        if (enableNotify && canNotify(item.key)) { // 符合条件则推送通知
          $notification.post(
            `${symbol} ${nameMap[item.key]} ${sign}${absChange}%`,
            "",
            `当前汇率：${text}`
          );
          logInfo(`通知发送：${item.key} ${change > 0 ? "上涨" : "下跌"} ${changeStr}`);
          setNotifyTime(item.key); // 设置通知时间，防止短时间重复通知
        }
      }
      // —— 波动提醒格式替换结束 —— 
    }

    try {
      // 写入缓存，保存当前汇率数据
      $persistentStore.write(String(rateValue), "exrate_" + item.key);
      logInfo(`缓存写入：${item.key} = ${formatRate(rateValue, item.decimals)}`);
    } catch (e) {
      logInfo(`缓存写入异常：${e.message || e}`);
    }
  }

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`; // 汇率波动提醒信息
    logInfo(`检测到汇率波动：\n${fluctuations.join("\n")}`);
  } else {
    logInfo("无汇率波动超出阈值");
  }

  let lastUpdateContent = "";
  // 显示更新时间信息，谷歌和API分别显示
  if (globalGoogleResult && globalGoogleResult.lastUpdate && globalGoogleResult.lastUpdate !== "未知") {
    lastUpdateContent += `LastUpdate（WEB）：${globalGoogleResult.lastUpdate}\n`;
  }
  if (globalApiResult && globalApiResult.lastUpdate && globalApiResult.lastUpdate !== "未知") {
    lastUpdateContent += `LastUpdate（API）：${globalApiResult.lastUpdate}\n`;
  }
  if (globalGoogleResult && globalGoogleResult.nextUpdate && globalGoogleResult.nextUpdate !== "未知") {
    lastUpdateContent += `NextUpdate（WEB）：${globalGoogleResult.nextUpdate}\n`;
  }
  if (globalApiResult && globalApiResult.nextUpdate && globalApiResult.nextUpdate !== "未知") {
    lastUpdateContent += `NextUpdate（API）：${globalApiResult.nextUpdate}\n`;
  }
  content += `\n${lastUpdateContent.trim()}`;

  // 当前北京时间字符串，用于面板标题时间
  const beijingTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  // 调用$done结束脚本，传递面板显示内容及图标等信息
  $done({
    title: `汇率信息 ${beijingTime}`,
    content: content.trim(),
    icon: params.icon || "arrow.left.arrow.right.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

// 格式化时间为北京时间字符串，支持多种时间格式输入
function formatTimeToBeijing(timeInput) {
  if (!timeInput || timeInput === "未知") return "未知";
  let date = null;
  if (typeof timeInput === "number") {
    if (timeInput > 1e12) {
      date = new Date(timeInput); // 毫秒时间戳
    } else if (timeInput > 1e10) {
      date = new Date(timeInput);
    } else {
      date = new Date(timeInput * 1000); // 秒时间戳转毫秒
    }
  } else if (typeof timeInput === "string") {
    const s = timeInput.trim();
    if (/^\d{10,13}$/.test(s)) { // 纯数字时间戳字符串
      if (s.length === 13) {
        date = new Date(Number(s));
      } else if (s.length === 10) {
        date = new Date(Number(s) * 1000);
      }
    } else if (/^\d{4}-\d{2}-\d{2}(T.*)?/.test(s)) { // 日期格式字符串
      date = new Date(s);
    } else {
      date = new Date(s);
    }
  } else {
    date = new Date(timeInput);
  }
  if (!date || isNaN(date.getTime())) return "未知"; // 非法时间返回未知
  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }); // 转换为北京时间字符串
}

// 判断是否可以发送通知（是否达到冷却时间）
function canNotify(key) {
  try {
    const lastTimeStr = $persistentStore.read("notify_time_" + key); // 读取上次通知时间
    if (!lastTimeStr) return true; // 从未通知过
    const lastTime = new Date(lastTimeStr);
    const now = new Date();
    return (now - lastTime) / 60000 >= notifyCooldownMinutes; // 判断是否超过冷却分钟数
  } catch {
    return true; // 出错则允许通知
  }
}

// 设置通知发送时间，写入当前时间
function setNotifyTime(key) {
  try {
    $persistentStore.write(new Date().toISOString(), "notify_time_" + key);
  } catch { }
}

// 日志打印辅助函数，兼容多环境
function logInfo(msg) {
  const prefix = "[汇率监控] ";
  if (typeof console !== "undefined" && console.log) {
    console.log(prefix + msg);
  } else if (typeof $console !== "undefined" && $console.info) {
    $console.info(prefix + msg);
  }
}

// 解析脚本参数，格式如 "key:value,key2:value2"
function getParams(arg) {
  if (!arg) return {};
  const obj = {};
  arg.split(",").forEach(pair => {
    const [k, v] = pair.split(":");
    if (k && v) obj[k.trim()] = v.trim();
  });
  return obj;
}

// 格式化汇率数值，保留指定小数位
function formatRate(num, decimals = 2) {
  if (typeof num !== "number" || isNaN(num)) return "未知";
  return num.toFixed(decimals);
}

