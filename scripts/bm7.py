import requests

def fetch_and_save(url, file_name):
    # 发起 GET 请求获取页面内容
    response = requests.get(url)
    
def fetch_and_save(url, file_name):
    # 发起 GET 请求获取页面内容
    r = requests.get(url).text
    # 解析 HTML 内容
    tree = etree.HTML(r)
    # 提取嵌入的数据
    asns = tree.xpath('//*[@data-target="react-app.embeddedData"]')[0].text
    # 解析 JSON 数据
    x = json.loads(asns)['payload']['blob']['rawLines']
    # 计算总记录数
    count = len(x)
    # 保存数据到文件
    with open(file_name, "w", encoding='utf-8') as file:
        # 写入头部信息
        file.write(get_header(file_name, count))
        # 写入数据
        for i in x:
            file.write(i)
            file.write('\n')

# 各种 IP 列表的 URL
Proxy = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Proxy/Proxy_All_No_Resolve.list"
China = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/China/China_All_No_Resolve.list"


# 执行函数，保存数据
fetch_and_save(Proxy, "Proxy_All_No_Resolve.list")
fetch_and_save(China, "China_All_No_Resolve.list")
