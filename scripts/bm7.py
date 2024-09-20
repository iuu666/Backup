import requests
from lxml import etree
import json
from datetime import datetime

# 新的 IP 列表的 URL
Direct = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Direct/Direct.list"
Hijacking = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Hijacking/Hijacking.list"
Privacy = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Privacy/Privacy_All.list"

def get_header(name, author, repo_url, total):
    return f"// NAME: {name}\n// AUTHOR: {author}\n// REPO: {repo_url}\n// TOTAL: {total}\n\n"

def fetch_and_save(url, file_name):
    r = requests.get(url)
    tree = etree.HTML(r.text)
    asns = tree.xpath('//*[@data-target="react-app.embeddedData"]')[0].text
    x = json.loads(asns)['payload']['blob']['rawLines']
    
    repo_url = url.replace("blob/", "")  # 修改 REPO 地址为下载内容的地址
    total_count = len(x)  # 计算总行数
    name = file_name.split('.')[0]  # 提取文件名作为 NAME
    author = "YourName"  # 替换为你的作者名

    with open(file_name, "w", encoding='utf-8') as file:
        # 写入头部信息
        file.write(get_header(name, author, repo_url, total_count))
        for i in x:
            file.write(i)
            file.write('\n')

# 执行函数，保存数据
fetch_and_save(Direct, "Direct.list")
fetch_and_save(Hijacking, "Hijacking.list")
fetch_and_save(Privacy, "Privacy_All.list")
