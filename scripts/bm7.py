import requests
from lxml import etree
import json
from datetime import datetime, timedelta

# 生成头部信息
def get_header(file_name, count):
    utc_time = datetime.utcnow()  # 获取当前的 UTC 时间
    china_time = utc_time + timedelta(hours=8)  # 转换为 CST (UTC+8)
    local_time = china_time.strftime("%Y-%m-%d %H:%M:%S")  # 格式化时间为字符串
    # 根据文件名生成相应的头部信息
    header = f"""\
// {file_name.replace('.list', '')}
// Link: https://github.com/iuu666/ASN.China
// Total Count: {count}
// Last Updated: CST {local_time}
// Made by iuu, All rights reserved.

"""
    return header

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
        # 写入数据，并为每条数据添加 "IP-CIDR," 前缀
        for i in x:
            file.write(f"IP-CIDR,{i}")
            file.write('\n')

# 各种 IP 列表的 URL
Direct = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Direct/Direct.list"
Hijacking = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Hijacking/Hijacking.list"
Privacy = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Privacy/Privacy_All.list"

# 执行函数，保存数据
fetch_and_save(allChina, "Direct.list")
fetch_and_save(v4China, "Hijacking.list")
fetch_and_save(v6China, "Privacy_All.list")
