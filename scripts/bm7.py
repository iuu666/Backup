import requests
import os

def fetch_and_save(url, file_name):
    # 发起 GET 请求获取页面内容
    response = requests.get(url)
    
    # 确保请求成功
    if response.status_code != 200:
        print(f"Failed to fetch data from {url}")
        return
    
    # 保存数据到文件
    with open(file_name, "w", encoding='utf-8') as file:
        file.write(response.text)

# 各种 IP 列表的 URL
Proxy = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Proxy/Proxy_All_No_Resolve.list"
China = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/China/China_All_No_Resolve.list"

# 创建 main 目录，如果不存在的话
os.makedirs('bm7', exist_ok=True)

# 执行函数，保存数据到 main 目录下
fetch_and_save(Proxy, "bm7/Proxy_All_No_Resolve.list")
fetch_and_save(China, "bm7/China_All_No_Resolve.list")
