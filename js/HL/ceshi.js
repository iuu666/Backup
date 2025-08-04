const testUrl = "https://api.exchangerate.host/latest?base=CNY";

$httpClient.get(testUrl, (error, response, data) => {
  if (error) {
    $notification.post("请求错误", error.toString());
    $done();
    return;
  }

  // 打印 HTTP 状态码
  $notification.post("HTTP状态码", response.status.toString());

  try {
    const json = JSON.parse(data);
    if (json.success === false && json.error) {
      // 说明访问了错误接口，返回了错误信息
      $notification.post("接口错误提示", JSON.stringify(json.error));
    } else if (json.rates) {
      // 正确返回了汇率数据
      $notification.post("接口正常", `基础币种：${json.base}\n汇率样例：USD=${json.rates.USD}`);
    } else {
      // 结构异常
      $notification.post("返回结构异常", data);
    }
  } catch {
    $notification.post("解析异常", data);
  }

  $done();
});
