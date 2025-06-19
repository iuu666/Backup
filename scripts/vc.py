import os 
import requests  
from lxml import etree  
import json  

# 创建 BM7 和 Surge 文件夹
os.makedirs(os.path.join("VirgilClyne", "Sgmodule"), exist_ok=True)

# 新的 IP 列表的 URL
HTTPDNS.Block = "https://github.com/VirgilClyne/GetSomeFries/blob/main/sgmodule/HTTPDNS.Block.sgmodule"
General = "https://github.com/VirgilClyne/GetSomeFries/blob/main/sgmodule/General.sgmodule"
DNS = "https://github.com/VirgilClyne/GetSomeFries/blob/main/sgmodule/DNS.sgmodule"

def fetch_and_save(url, file_name):
    try:
        # 发起 GET 请求获取页面内容
        r = requests.get(url)
        r.raise_for_status()  # 如果请求失败，抛出异常
        
        # 解析 HTML 内容
        tree = etree.HTML(r.text)
        
        # 提取嵌入的数据
        try:
            asns = tree.xpath('//*[@data-target="react-app.embeddedData"]')[0].text
        except IndexError:
            print(f"Failed to find embedded data in {url}")
            return
        
        # 解析 JSON 数据
        x = json.loads(asns)['payload']['blob']['rawLines']
        
        # 保存提取的数据到指定文件
        with open(os.path.join("BM7", "Surge", file_name), "w", encoding='utf-8') as file:
            # 写入每条数据到文件
            for i in x:
                file.write(i)  # 写入数据行
                file.write('\n')  # 换行
        print(f"Successfully saved data to {file_name}")
    
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch {url}: {e}")

# 执行函数，保存数据
fetch_and_save(HTTPDNS.Block, "HTTPDNS.Block.sgmodule")
fetch_and_save(General, "General.sgmodule")
fetch_and_save(DNS, "DNS.sgmodule")
