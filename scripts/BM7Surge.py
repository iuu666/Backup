import os 
import requests  
from lxml import etree  
import json  

# 创建 BM7 和 Surge 文件夹
os.makedirs(os.path.join("BM7", "Surge"), exist_ok=True)

# 新的 IP 列表的 URL
Direct = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Direct/Direct.list"
Hijacking = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Hijacking/Hijacking.list"
Privacy = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Privacy/Privacy_All_No_Resolve.list"
Apple = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Apple/Apple_All_No_Resolve.list"
Microsoft = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Microsoft/Microsoft.list"
Google = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Google/Google.list"
OpenAI = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/OpenAI/OpenAI.list"
GitHub = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/GitHub/GitHub.list"
Telegram = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Telegram/Telegram.list"
Instagram = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Instagram/Instagram.list"
TikTok = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/TikTok/TikTok.list"
Spotify = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Spotify/Spotify.list"
YouTube = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/YouTube/YouTube.list"
Netflix = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Netflix/Netflix.list"
Disney = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Disney/Disney.list"
DouYin = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/DouYin/DouYin.list"
Gemini = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Gemini/Gemini.list"
ChinaMedia = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/ChinaMedia/ChinaMedia.list"
GlobalMedia = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/GlobalMedia/GlobalMedia_All_No_Resolve.list"
Proxy = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Proxy/Proxy_All_No_Resolve.list"
China = "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/China/China_All_No_Resolve.list"

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
fetch_and_save(Direct, "Direct.list")
fetch_and_save(Hijacking, "Hijacking.list")
fetch_and_save(Privacy, "Privacy_All_No_Resolve.list")
fetch_and_save(Apple, "Apple_All_No_Resolve.list")
fetch_and_save(Microsoft, "Microsoft.list")
fetch_and_save(Google, "Google.list")
fetch_and_save(OpenAI, "OpenAI.list")
fetch_and_save(GitHub, "GitHub.list")
fetch_and_save(Telegram, "Telegram.list")
fetch_and_save(Instagram, "Instagram.list")
fetch_and_save(TikTok, "TikTok.list")
fetch_and_save(Spotify, "Spotify.list")
fetch_and_save(YouTube, "YouTube.list")
fetch_and_save(Netflix, "Netflix.list")
fetch_and_save(Disney, "Disney.list")
fetch_and_save(DouYin, "DouYin.list")
fetch_and_save(Gemini, "Gemini.list")
fetch_and_save(ChinaMedia, "ChinaMedia.list")
fetch_and_save(GlobalMedia, "GlobalMedia_All_No_Resolve.list")
fetch_and_save(Proxy, "Proxy_All_No_Resolve.list")
fetch_and_save(China, "China_All_No_Resolve.list")
