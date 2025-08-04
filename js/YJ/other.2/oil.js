/*
Surge Panel：https://raw.githubusercontent.com/githubdulong/Script/master/Surge/Oil.sgmodule

今日油价，仅限Surge Panel使用
*/

const params = getParams($argument); // 解析传入参数
const provinceName = params.provname || "山东"; // 省份名称，默认山东
const apiKey = params.apikey; // API Key，从参数获取
const updateInterval = Number(params.UPDATE_INTERVAL) || 43200; // 刷新间隔秒数，默认43200秒(12小时)

// API接口列表，备用多个Key保证稳定
const apiUrls = [
  `https://apis.tianapi.com/oilprice/index?key=${apiKey}&prov=${encodeURIComponent(provinceName)}`,
  `https://apis.tianapi.com/oilprice/index?key=231de491563c35731436829ac52aad43&prov=${encodeURIComponent(provinceName)}`,
  `https://apis.tianapi.com/oilprice/index?key=a2bc7a0e01be908881ff752677cf94b7&prov=${encodeURIComponent(provinceName)}`,
  `https://apis.tianapi.com/oilprice/index?key=1bcc67c0114bc39a8818c8be12c2c9ac&prov=${encodeURIComponent(provinceName)}`,
  `https://apis.tianapi.com/oilprice/index?key=3c5ee42145c852de4147264f25b858dc&prov=${encodeURIComponent(provinceName)}`,
  `https://apis.tianapi.com/oilprice/index?key=d718b0f7c2b6d71cb3a9814e90bf847f&prov=${encodeURIComponent(provinceName)}`
];

let currentIndex = 0; // 当前请求的API索引，轮流尝试

// 开始请求第一个API
function testNextUrl() {
  if (currentIndex >= apiUrls.length) {
    console.log("所有URL都失败了");
    $done(); // 结束脚本
    return;
  }

  const apiUrl = apiUrls[currentIndex]; // 当前API链接
  $httpClient.get(apiUrl, (error, response, data) => {
    if (error) {
      console.log(`URL ${currentIndex + 1} 出错: ${error}`); // 请求错误日志
      currentIndex++; // 尝试下一个API
      testNextUrl();
    } else {
      handleResponse(data); // 处理请求结果
    }
  });
}

// 处理API返回的数据
function handleResponse(data) {
  let oilPriceData;
  try {
    oilPriceData = JSON.parse(data); // 解析JSON
  } catch (e) {
    console.log("解析JSON失败", e);
    currentIndex++;
    testNextUrl();
    return;
  }

  if (oilPriceData.code === 200) {
    const oilPriceInfo = oilPriceData.result; // 获取油价数据
    // 格式化显示油价信息
    const message = `0#柴油:${oilPriceInfo.p0}元 | 92汽油:${oilPriceInfo.p92}元\n95汽油:${oilPriceInfo.p95}元 | 98汽油:${oilPriceInfo.p98}元`;

    // 检查是否需要弹窗提醒
    checkPopupByInterval(() => {
      // 弹窗完毕或不弹窗后，继续抓取油价预告内容
      proceedFetchTishiContent(message);
    }, message);

  } else {
    console.log(`请求失败，错误信息：${oilPriceData.msg}`);
    currentIndex++;
    testNextUrl();
  }
}

// 根据刷新间隔判断是否弹窗
function checkPopupByInterval(callback, message) {
  const lastPopupTimeKey = "lastOilPopupTime"; // 存储上次弹窗时间的Key
  $prefs.read(lastPopupTimeKey, (lastTimeStr) => {
    const now = Date.now(); // 当前时间戳（毫秒）
    const lastTime = lastTimeStr ? parseInt(lastTimeStr) : 0; // 上次弹窗时间，默认0
    if (now - lastTime > updateInterval * 1000) { // 超过刷新间隔，弹窗
      $notification.post("今日油价提醒", provinceName, message); // 弹窗通知
      $prefs.write(now.toString(), lastPopupTimeKey); // 记录当前弹窗时间
      callback(); // 继续执行后续操作
    } else {
      console.log("未达到弹窗间隔，跳过弹窗");
      callback(); // 直接执行后续操作，不弹窗
    }
  });
}

// 获取油价预告提示内容
function proceedFetchTishiContent(message) {
  $httpClient.get('http://m.qiyoujiage.com/', (error, response, data) => {
    if (error) {
      console.log(`获取HTML内容出错: ${error}`);
      $done();
    } else {
      const tishiMatch = data.match(/var\s+tishiContent\s*=\s*"(.*?)"/);
      if (tishiMatch) {
        let tishiContent = tishiMatch[1];

        const dateMatch = tishiContent.match(/(\d{1,2})月(\d{1,2})日/);
        let formattedDate = "未知日期";
        if (dateMatch) {
          let [month, day] = [parseInt(dateMatch[1]), parseInt(dateMatch[2])];
          formattedDate = `${month.toString().padStart(2, '0')}-${(day + 1).toString().padStart(2, '0')}`;
        }

        let adjustmentSymbols = "";
        const adjustmentMatch = tishiContent.match(/(下调|下跌|上调|上涨)/);
        if (adjustmentMatch) {
          let adjustmentAction = adjustmentMatch[1];
          adjustmentSymbols = (adjustmentAction.includes("下")) ? "\u25BC\u25B3" : "\u25BD\u25B2";
        }

        const priceRangeMatch = tishiContent.match(/(\d+\.\d+)元\/升-(\d+\.\d+)元\/升/);
        let priceAdjustment = "0.00~0.00元";
        if (priceRangeMatch) {
          priceAdjustment = `${priceRangeMatch[1]}~${priceRangeMatch[2]}`;
        }

        tishiContent = tishiContent.replace(/<br\s*\/?>/g, '\n'); // 替换换行符

        // 返回结果，渲染到Surge Panel
        const body = {
          title: `${params.title || "今日油价"} | ${formattedDate} ${adjustmentSymbols} ${priceAdjustment}`, 
          content: `${message}`,
          provname: params.provname,
          icon: params.icon,
          "icon-color": params.color
        };
        $done(body);
      } else {
        console.log("提取`tishiContent`失败");
        currentIndex++;
        testNextUrl();
      }
    }
  });
}

// 解析URL参数为对象
function getParams(param) {
  return Object.fromEntries(
    param
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

// 启动入口，开始请求API
testNextUrl();
