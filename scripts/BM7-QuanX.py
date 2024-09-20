import requests  # 用于发起 HTTP 请求
from lxml import etree  # 用于解析 HTML 内容
import json  # 用于处理 JSON 数据

# 数据抓取和保存的主函数
def fetch_and_save(url, file_name):
    try:
        # 发起 GET 请求获取页面内容
        r = requests.get(url)
        if r.status_code != 200:  # 检查请求是否成功
            print(f"Error: Failed to fetch data from {url}. Status code: {r.status_code}")
            return  # 如果请求失败，终止函数

        r_text = r.text  # 获取响应文本

        # 解析 HTML 内容
        tree = etree.HTML(r_text)
        # 提取嵌入的数据
        asns_element = tree.xpath('//*[@data-target="react-app.embeddedData"]')
        if not asns_element:  # 检查数据元素是否成功提取
            print("Error: Failed to locate the embedded data element.")
            return

        asns = asns_element[0].text  # 获取嵌入的数据文本
        if not asns:  # 检查提取的数据是否为空
            print("Error: Extracted data is empty.")
            return

        # 解析 JSON 数据
        try:
            x = json.loads(asns)['payload']['blob']['rawLines']  # 解析 JSON 数据并提取行
        except (json.JSONDecodeError, KeyError) as e:  # 处理 JSON 解析错误
            print(f"Error: Failed to parse JSON data. {str(e)}")
            return

        # 保存数据到文件
        with open(file_name, "w", encoding='utf-8') as file:
            # 写入数据
            for i in x:
                file.write(f"{i}")  # 直接写入数据，不加前缀
                file.write('\n')

        print(f"Success: Data successfully fetched and saved to {file_name}")  # 打印成功信息

    except Exception as e:  # 捕获其他意外错误
        print(f"Unexpected error: {str(e)}")

# 各种 IP 列表的 URL
Direct = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Direct/Direct.list"
Hijacking = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Hijacking/Hijacking.list"
Privacy = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Privacy/Privacy.list"
Apple = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Apple/Apple.list"
Microsoft = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Microsoft/Microsoft.list"
Google = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Google/Google.list"
OpenAI = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/OpenAI/OpenAI.list"
GitHub = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/GitHub/GitHub.list"
Telegram = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Telegram/Telegram.list"
Instagram = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Instagram/Instagram.list"
TikTok = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/TikTok/TikTok.list"
Spotify = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Spotify/Spotify.list"
YouTube = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/YouTube/YouTube.list"
Netflix = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Netflix/Netflix.list"
Disney = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Disney/Disney.list"
ChinaMedia = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/ChinaMedia/ChinaMedia.list"
GlobalMedia = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/GlobalMedia/GlobalMedia.list"
Proxy = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Proxy/Proxy.list"
China = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/China/China.list"

# 执行函数，保存数据
fetch_and_save(Direct, "Direct.list")  # 抓取和保存 Direct 列表
fetch_and_save(Hijacking, "Hijacking.list")  # 抓取和保存 Hijacking 列表
fetch_and_save(Privacy, "Privacy.list")  # 抓取和保存 Privacy 列表
fetch_and_save(Apple, "Apple.list")  # 抓取和保存 Apple 列表
fetch_and_save(Microsoft, "Microsoft.list")  # 抓取和保存 Microsoft 列表
fetch_and_save(Google, "Google.list")  # 抓取和保存 Google 列表
fetch_and_save(OpenAI, "OpenAI.list")  # 抓取和保存 OpenAI 列表
fetch_and_save(GitHub, "GitHub.list")  # 抓取和保存 GitHub 列表
fetch_and_save(Telegram, "Telegram.list")  # 抓取和保存 Telegram 列表
fetch_and_save(Instagram, "Instagram.list")  # 抓取和保存 Instagram 列表
fetch_and_save(TikTok, "TikTok.list")  # 抓取和保存 TikTok 列表
fetch_and_save(Spotify, "Spotify.list")  # 抓取和保存 Spotify 列表
fetch_and_save(YouTube, "YouTube.list")  # 抓取和保存 YouTube 列表
fetch_and_save(Netflix, "Netflix.list")  # 抓取和保存 Netflix 列表
fetch_and_save(Disney, "Disney.list")  # 抓取和保存 Disney 列表
fetch_and_save(ChinaMedia, "ChinaMedia.list")  # 抓取和保存 ChinaMedia 列表
fetch_and_save(GlobalMedia, "GlobalMedia.list")  # 抓取和保存 GlobalMedia 列表
fetch_and_save(Proxy, "Proxy.list")  # 抓取和保存 Proxy 列表
fetch_and_save(China, "China.list")  # 抓取和保存 China 列表
