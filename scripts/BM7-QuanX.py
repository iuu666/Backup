import os  # 导入用于文件和目录操作的库
import requests  # 导入用于发送 HTTP 请求的库
import json  # 导入用于处理 JSON 数据的库

# 创建 BM7 和 QuanX 文件夹
os.makedirs(os.path.join("BM7", "QuanX"), exist_ok=True)

# 新的 IP 列表的 URL
urls = {
    "Direct": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Direct/Direct.list",
    "Hijacking": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Hijacking/Hijacking.list",
    "Privacy": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Privacy/Privacy.list",
    "Apple": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Apple/Apple.list",
    "Microsoft": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Microsoft/Microsoft.list",
    "Google": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Google/Google.list",
    "OpenAI": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/OpenAI/OpenAI.list",
    "GitHub": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/GitHub/GitHub.list",
    "Telegram": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Telegram/Telegram.list",
    "Instagram": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Instagram/Instagram.list",
    "TikTok": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/TikTok/TikTok.list",
    "Spotify": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Spotify/Spotify.list",
    "YouTube": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/YouTube/YouTube.list",
    "Netflix": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Netflix/Netflix.list",
    "Disney": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Disney/Disney.list",
    "ChinaMedia": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/ChinaMedia/ChinaMedia.list",
    "GlobalMedia": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/GlobalMedia/GlobalMedia.list",
    "Proxy": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Proxy/Proxy.list",
    "China": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/China/China.list"
}

def fetch_and_save(url, file_name):
    try:
        # 发起 GET 请求获取页面内容
        r = requests.get(url)
        r.raise_for_status()  # 检查请求是否成功
        
        # 保存提取的数据到指定文件
        with open(os.path.join("BM7", "QuanX", file_name), "w", encoding='utf-8') as file:
            file.write(r.text)  # 写入文件内容

    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
    except Exception as e:
        print(f"Error saving to {file_name}: {e}")

# 执行函数，保存数据
for name, url in urls.items():
    fetch_and_save(url, f"{name}.list")
