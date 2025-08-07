/**
 * 汇率监控脚本（基准货币：CNY）
 * Author: okk
 * Version: 1.0
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
const googleCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY"];
const baseCurrency = "CNY";

const apiUrls = [
  "https://open.er-api.com/v6/latest/CNY",
  "https://api.exchangerate-api.com/v4/latest/CNY",
  "https://api.frankfurter.app/latest?from=CNY"
];
// 参数解析与默认值设置 
const params = getParams($argument);
const thresholdRaw = parseFloat(params.threshold);
const threshold = (isNaN(thresholdRaw) || thresholdRaw <= 0) ? 0.1 : thresholdRaw;
const enableNotify = (params.notify || "true").toLowerCase() === "true";
const strongAmountRaw = parseFloat(params.base_strong);
const strongAmount = (isNaN(strongAmountRaw) || strongAmountRaw <= 0) ? 1 : strongAmountRaw;
const weakAmountRaw = parseFloat(params.base_weak);
const weakAmount = (isNaN(weakAmountRaw) || weakAmountRaw <= 0) ? 1 : weakAmountRaw;
const notifyCooldownMinutesRaw = parseInt(params.notify_cooldown);
const notifyCooldownMinutes = (isNaN(notifyCooldownMinutesRaw) || notifyCooldownMinutesRaw <= 0) ? 5 : notifyCooldownMinutesRaw;

logInfo(`脚本执行时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
logInfo(`通知推送开关：${enableNotify ? "开启 ✅" : "关闭 🚫"}`);
logInfo(`汇率波动阈值：${threshold}%`);
logInfo(`兑换基数（强势币）：${strongAmount}，兑换基数（弱势币）：${weakAmount}`);
logInfo(`通知冷却时间：${notifyCooldownMinutes} 分钟`);

let globalGoogleResult = null;  // 记录谷歌结果
let globalApiResult = null;     // 记录API补充结果

// 主入口，先尝试谷歌财经抓取所有币种
fetchFromGoogle((googleResult) => {
  if (googleResult && Object.keys(googleResult.rates).length > 0) {
    globalGoogleResult = googleResult;
    // 检查哪些币种缺失
    const missingCurrencies = googleCurrencies.filter(c => !(c in googleResult.rates));
    if (missingCurrencies.length === 0) {
      // 全部抓取成功，直接处理
      logInfo("谷歌财经所有币种均抓取成功，无需API补充");
      processData(googleResult.rates, googleResult.lastUpdate, googleResult.nextUpdate, null);
    } else {
      logInfo(`谷歌财经部分币种缺失，开始用API补充缺失币种：${missingCurrencies.join(", ")}`);
      // 用API补充缺失币种
      fetchFromApiForCurrencies(missingCurrencies, (apiResult) => {
        globalApiResult = apiResult;
        // 合并谷歌和API结果（以API补充缺失币种）
        const combinedRates = { ...googleResult.rates, ...apiResult.rates };
        processData(combinedRates, null, null, null); // 数据更新时间统一在 processData 里单独处理
      });
    }
  } else {
    // 谷歌财经抓取完全失败，整体用API接口fallback
    logInfo("谷歌财经抓取失败，开始使用API接口fallback");
    fetchWithFallback(apiUrls, 0);
  }
});

// 从谷歌财经抓取函数
function fetchFromGoogle(callback) {
  const results = {};
  let completed = 0;
  let hasError = false;
  let lastUpdateTimestamp = 0;

  function tryFinish() {
    completed++;
    if (completed === googleCurrencies.length) {
      if (hasError && Object.keys(results).length === 0) {
        callback(null);
        return;
      }
      // 转换成基准CNY的rates
      const rates = {};
      for (const curr of googleCurrencies) {
        if (curr === baseCurrency) {
          rates[curr] = 1;
        } else if (results[curr]) {
          rates[curr] = 1 / results[curr];
        }
      }
      const lastUpdate = formatTimeToBeijing(lastUpdateTimestamp * 1000);
      const nextUpdate = "未知";
      logInfo(`谷歌财经所有币种汇率抓取完成，时间：${lastUpdate}`);
      callback({ rates, lastUpdate, nextUpdate });
    }
  }

  for (const curr of googleCurrencies) {
    if (curr === baseCurrency) {
      results[curr] = 1;
      tryFinish();
      continue;
    }
    const url = `https://www.google.com/finance/quote/${curr}-${baseCurrency}`;
    logInfo(`请求谷歌财经汇率页面：${url}`);
    $httpClient.get(url, (error, response, data) => {
      if (error || !data) {
        logInfo(`谷歌财经请求失败：${curr} - ${error || "无响应"}`);
        hasError = true;
        tryFinish();
        return;
      }
      try {
        const regex = /<div[^>]*data-source="(\w+)"[^>]*data-target="(\w+)"[^>]*data-last-price="([\d\.]+)"[^>]*data-last-normal-market-timestamp="(\d+)"[^>]*>/g;
        let match, foundRate = null, foundTimestamp = null;
        while ((match = regex.exec(data)) !== null) {
          const [_, source, target, priceStr, tsStr] = match;
          if (source === curr && target === baseCurrency) {
            foundRate = parseFloat(priceStr);
            foundTimestamp = parseInt(tsStr);
            break;
          }
        }
        if (foundRate === null) {
          logInfo(`未找到${curr}≈${baseCurrency}汇率`);
          hasError = true;
        } else {
          results[curr] = foundRate;
          if (foundTimestamp > lastUpdateTimestamp) lastUpdateTimestamp = foundTimestamp;
          logInfo(`谷歌财经抓取${curr}≈${baseCurrency}汇率成功：${foundRate}`);
        }
      } catch (e) {
        logInfo(`解析${curr}汇率异常：${e.message || e}`);
        hasError = true;
      }
      tryFinish();
    });
  }
}

// 用API补充部分币种汇率
function fetchFromApiForCurrencies(currencyList, callback) {
  let apiIndex = 0;

  function tryApiFetch() {
    if (apiIndex >= apiUrls.length) {
      logInfo("❌ 所有接口请求均失败，补充币种失败");
      callback({ rates: {}, lastUpdate: "未知", nextUpdate: "未知" });
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
        const parsed = JSON.parse(data);
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

  tryApiFetch();
}

// 失败时用API接口fallback抓取（整体抓取）
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
      fetchWithFallback(urls, index + 1);
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
      processData(rates, lastUpdate, nextUpdate, url);
    } catch (e) {
      logInfo(`数据解析异常：${e.message || e}，尝试下一个接口`);
      fetchWithFallback(urls, index + 1);
    }
  });
}

// 处理汇率数据并生成面板内容，逐条显示数据来源
function processData(rates, lastUpdate, nextUpdate, sourceUrl) {
  const googleRates = globalGoogleResult?.rates || {};
  const apiRates = globalApiResult?.rates || {};

  const displayRates = [
    { key: "USD", label: "美元", isBaseForeign: true, decimals: 2 },
    { key: "EUR", label: "欧元", isBaseForeign: true, decimals: 2 },
    { key: "GBP", label: "英镑", isBaseForeign: true, decimals: 2 },
    { key: "HKD", label: "港币", isBaseForeign: false, decimals: 2 },
    { key: "JPY", label: "日元", isBaseForeign: false, decimals: 0 },
    { key: "KRW", label: "韩元", isBaseForeign: false, decimals: 0 },
    { key: "TRY", label: "里拉", isBaseForeign: false, decimals: 2 }
  ];

  const nameMap = {
    USD: "美元", EUR: "欧元", GBP: "英镑",
    HKD: "港币", JPY: "日元", KRW: "韩元", TRY: "里拉"
  };

  let content = "";
  let fluctuations = [];

  for (const item of displayRates) {
    let rateValue;
    let sourceLabel = "";
    if (googleRates[item.key] !== undefined) {
      sourceLabel = "WEB";
      rateValue = item.isBaseForeign ? strongAmount / googleRates[item.key] : weakAmount * googleRates[item.key];
    } else if (apiRates[item.key] !== undefined) {
      sourceLabel = "API";
      rateValue = item.isBaseForeign ? strongAmount / apiRates[item.key] : weakAmount * apiRates[item.key];
    } else {
      content += `${item.label} 数据缺失\n`;
      continue;
    }

    let prev = NaN;
    try {
      const cacheStr = $persistentStore.read("exrate_" + item.key);
      prev = cacheStr !== null ? parseFloat(cacheStr) : NaN;
    } catch {
      prev = NaN;
    }

    let trendSymbol = "";
    if (!isNaN(prev)) {
      if (rateValue > prev) trendSymbol = " ↑";
      else if (rateValue < prev) trendSymbol = " ↓";
    }

    const text = item.isBaseForeign
      ? `${strongAmount}${item.label} ≈ 人民币 ${formatRate(rateValue, item.decimals)}${trendSymbol} （${sourceLabel}）`
      : `${weakAmount}人民币 ≈ ${item.label} ${formatRate(rateValue, item.decimals)}${trendSymbol} （${sourceLabel}）`;

    content += text + "\n";

    if (!isNaN(prev)) {
      const change = ((rateValue - prev) / prev) * 100;
      if (Math.abs(change) >= threshold) {
        const arrow = change > 0 ? "📈" : "📉";
        fluctuations.push(`${nameMap[item.key]} 汇率${change > 0 ? "上涨" : "下跌"}：${arrow}${Math.abs(change).toFixed(2)}%`);
        if (enableNotify && canNotify(item.key)) {
          $notification.post(
            `${arrow} ${nameMap[item.key]} ${change > 0 ? "上涨" : "下跌"}：${Math.abs(change).toFixed(2)}%`,
            "",
            `当前汇率：${text}`
          );
          setNotifyTime(item.key);
        }
      }
    }

    try {
      $persistentStore.write(String(rateValue), "exrate_" + item.key);
    } catch (e) { }
  }

  if (fluctuations.length > 0) {
    content += `\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}\n`;
  }

  let lastUpdateContent = "";
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

  $done({
    title: `汇率信息 ${beijingTime}`,
    content: content.trim(),
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#EF8F1C"
  });
}

// 格式化时间为北京时间字符串
function formatTimeToBeijing(timeInput) {
  if (!timeInput || timeInput === "未知") return "未知";
  let date = null;
  if (typeof timeInput === "number") {
    if (timeInput > 1e12) {
      date = new Date(timeInput);
    } else if (timeInput > 1e10) {
      date = new Date(timeInput);
    } else {
      date = new Date(timeInput * 1000);
    }
  } else if (typeof timeInput === "string") {
    const s = timeInput.trim();
    if (/^\d{10,13}$/.test(s)) {
      if (s.length === 13) {
        date = new Date(Number(s));
      } else if (s.length === 10) {
        date = new Date(Number(s) * 1000);
      }
    } else if (/^\d{4}-\d{2}-\d{2}(T.*)?/.test(s)) {
      date = new Date(s);
    } else {
      date = new Date(s);
    }
  } else {
    date = new Date(timeInput);
  }
  if (!date || isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

// 判断是否可以发送通知（是否冷却完成）
function canNotify(key) {
  try {
    const lastTimeStr = $persistentStore.read("notify_time_" + key);
    if (!lastTimeStr) return true;
    const lastTime = new Date(lastTimeStr);
    const now = new Date();
    return (now - lastTime) / 60000 >= notifyCooldownMinutes;
  } catch {
    return true;
  }
}

// 设置通知发送时间
function setNotifyTime(key) {
  try {
    $persistentStore.write(new Date().toISOString(), "notify_time_" + key);
  } catch { }
}

// 日志打印辅助函数
function logInfo(msg) {
  const prefix = "[汇率监控] ";
  if (typeof console !== "undefined" && console.log) {
    console.log(prefix + msg);
  } else if (typeof $console !== "undefined" && $console.info) {
    $console.info(prefix + msg);
  }
}

// 解析脚本参数
function getParams(arg) {
  if (!arg) return {};
  const obj = {};
  arg.split(",").forEach(pair => {
    const [k, v] = pair.split(":");
    if (k && v) obj[k.trim()] = v.trim();
  });
  return obj;
}

// 格式化汇率数值
function formatRate(num, decimals = 2) {
  if (typeof num !== "number" || isNaN(num)) return "未知";
  return num.toFixed(decimals);
}
