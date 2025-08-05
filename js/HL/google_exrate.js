/**
 * Google 汇率监控脚本
 * 支持多基准币种、多目标币种
 * 通过 Google 搜索解析汇率（非官方API，可能不稳定）
 */

const params = getParams($argument);
const base = (params.base || "CNY").toUpperCase();
const currencies = (params.currencies || "USD,EUR,JPY").toUpperCase().split(",");
const threshold = parseFloat(params.threshold || "0.3");
const enableNotify = (params.notify || "true").toLowerCase() === "true";

console.log(`[GoogleRate] 基准币种: ${base}`);
console.log(`[GoogleRate] 目标币种: ${currencies.join(", ")}`);
console.log(`[GoogleRate] 通知开关: ${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

const headers = {
  "User-Agent": "Mozilla/5.0"
};

// 币种国旗和中文名映射
const currencyMap = {
  USD: { name: "美元", flag: "🇺🇸" },
  CNY: { name: "人民币", flag: "🇨🇳" },
  EUR: { name: "欧元", flag: "🇪🇺" },
  JPY: { name: "日元", flag: "🇯🇵" },
  HKD: { name: "港币", flag: "🇭🇰" },
  KRW: { name: "韩元", flag: "🇰🇷" },
  GBP: { name: "英镑", flag: "🇬🇧" },
  TRY: { name: "里拉", flag: "🇹🇷" }
};

(async () => {
  let results = [];
  let fluctuations = [];

  for (let target of currencies) {
    const url = `https://www.google.com/search?q=1+${base}+to+${target}`;
    try {
      const html = await httpGet(url, headers);

      // 尝试匹配格式如 "1 Chinese Yuan equals 0.14 United States Dollar"
      // 或 Google 页面中动态渲染部分，匹配浮点数汇率
      const regex = /(?:\d[\d,.]*)\s*(?:<span[^>]*>)?([A-Z]{3})/g;

      // 这里改为用更稳定的解析，先找第一个浮点数，再找目标币种
      // 解析汇率的常用方法：查找 "1 base = rate target"
      const matchRate = html.match(/(?:1\s+)(?:[A-Za-z\s]+)\s+=\s+([\d,.]+)/i) || html.match(/([\d,.]+)\s+([A-Z]{3})/i);
      let rate = null;

      if (matchRate) {
        rate = parseFloat(matchRate[1].replace(/,/g, ""));
      }

      // 备用方案：用自定义正则抓第一组数字
      if (rate === null || isNaN(rate)) {
        // 尝试匹配页面里的第一个数字
        const fallbackMatch = html.match(/[\d,.]+/);
        rate = fallbackMatch ? parseFloat(fallbackMatch[0].replace(/,/g, "")) : null;
      }

      if (rate === null || isNaN(rate)) throw new Error("无法解析汇率");

      // 读取上次缓存
      const key = `google_rate_${base}_${target}`;
      const prev = parseFloat($persistentStore.read(key));
      const change = !isNaN(prev) ? ((rate - prev) / prev) * 100 : null;

      if (change !== null && Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        if (enableNotify) {
          $notification.post(
            `${symbol} ${currencyMap[base]?.name || base} → ${currencyMap[target]?.name || target} 汇率${change > 0 ? "上涨" : "下跌"}`,
            "",
            `当前汇率: 1 ${base} = ${rate} ${target} (${changeStr})`
          );
        }
        fluctuations.push(`${currencyMap[base]?.name || base}→${currencyMap[target]?.name || target} ${changeStr}`);
      }

      $persistentStore.write(String(rate), key);

      // 格式化显示
      const fromName = `${currencyMap[base]?.flag || ""}${currencyMap[base]?.name || base}`;
      const toName = `${currencyMap[target]?.flag || ""}${currencyMap[target]?.name || target}`;
      results.push(`${fromName} → ${toName}：${rate}`);

    } catch (e) {
      results.push(`❌ 1 ${base} = ? ${target}`);
      console.log(`[GoogleRate] ${base}→${target} 获取失败: ${e.message}`);
    }
  }

  const timestamp = new Date().toLocaleString("zh-CN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Shanghai"
  });

  let content = results.join("\n");
  if (fluctuations.length > 0) {
    content += `\n\n💱 汇率波动提醒（>${threshold}%）：\n${fluctuations.join("\n")}`;
  }

  $done({
    title: `Google 汇率监控 ${timestamp}`,
    content,
    icon: params.icon || "bitcoinsign.circle",
    "icon-color": params.color || "#3A78F2"
  });
})();

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, headers }, (err, resp, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function getParams(param) {
  try {
    return Object.fromEntries(
      (param || $argument || "")
        .split("&")
        .filter(Boolean)
        .map(item => item.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
  } catch (e) {
    return {};
  }
}
