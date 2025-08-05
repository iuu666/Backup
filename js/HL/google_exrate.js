const params = getParams($argument);
const base = (params.base || "CNY").toUpperCase();
const currencies = (params.currencies || "USD,EUR,JPY").toUpperCase().split(",");
const threshold = parseFloat(params.threshold || "0.3");
const enableNotify = (params.notify || "true").toLowerCase() === "true";

console.log(`[GoogleRate] 基准币种: ${base}`);
console.log(`[GoogleRate] 目标币种: ${currencies.join(", ")}`);
console.log(`[GoogleRate] 通知开关: ${enableNotify ? "开启 ✅" : "关闭 🚫"}`);

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

(async () => {
  let results = [];
  let fluctuations = [];

  for (let target of currencies) {
    const url = `https://www.google.com/search?q=1+${base}+to+${target}`;
    try {
      const html = await httpGet(url, headers);

      // 调试：打印HTML前500字符，方便确认内容
      console.log(`[GoogleRate] ${base}→${target} 页面内容预览：\n${html.slice(0, 500)}`);

      // 用更稳健的正则匹配汇率：寻找形如 "1 USD = 7.24 CNY" 中的数字
      const regex = new RegExp(`1\\s+${base}\\s*=\\s*([\\d,.]+)`, "i");
      let match = html.match(regex);

      let rate = null;
      if (match) {
        rate = parseFloat(match[1].replace(/,/g, ""));
      }

      if (!rate || isNaN(rate)) {
        throw new Error("解析汇率失败");
      }

      const key = `google_rate_${base}_${target}`;
      const prev = parseFloat($persistentStore.read(key));
      const change = !isNaN(prev) ? ((rate - prev) / prev) * 100 : null;

      if (change !== null && Math.abs(change) >= threshold) {
        const symbol = change > 0 ? "📈" : "📉";
        const changeStr = `${symbol}${Math.abs(change).toFixed(2)}%`;
        if (enableNotify) {
          $notification.post(
            `${symbol} ${base} → ${target} 汇率${change > 0 ? "上涨" : "下跌"}`,
            "",
            `当前汇率: 1 ${base} = ${rate} ${target} (${changeStr})`
          );
        }
        fluctuations.push(`${base}→${target} ${changeStr}`);
      }

      $persistentStore.write(String(rate), key);

      results.push(`1 ${base} = ${rate} ${target}`);

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
