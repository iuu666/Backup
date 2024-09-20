import requests
from lxml import etree
import json

# 新的 IP 列表的 URL
Direct = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Direct/Direct.list"
Hijacking = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Hijacking/Hijacking.list"
Privacy = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Privacy/Privacy_All.list"

def fetch_and_save(url, file_name):
    r = requests.get(url)
    tree = etree.HTML(r.text)
    asns = tree.xpath('//*[@data-target="react-app.embeddedData"]')[0].text
    x = json.loads(asns)['payload']['blob']['rawLines']
    with open(file_name, "w", encoding='utf-8') as file:
        for i in x:
            file.write(i)
            file.write('\n')

# 执行函数，保存数据
fetch_and_save(Direct, "Direct.list")
fetch_and_save(Hijacking, "Hijacking.list")
fetch_and_save(Privacy, "Privacy_All.list")
