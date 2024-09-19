import requests

def fetch_and_save(url, file_name):
    # 发起 GET 请求获取页面内容
    response = requests.get(url)
    
    # 如果请求成功
    if response.status_code == 200:
        with open(file_name, 'w', encoding='utf-8') as file:
            file.write(response.text)
        print(f"Content successfully saved to {file_name}")
    else:
        print(f"Failed to fetch content. Status code: {response.status_code}")

# GitHub 上 Proxy_All_No_Resolve.list 的原始内容 URL
url = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Proxy/Proxy_All_No_Resolve.list"
file_name = "Proxy_All_No_Resolve.list"

# 拉取内容并保存到文件
fetch_and_save(url, file_name)
