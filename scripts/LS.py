import os 
import requests  
from lxml import etree  
import json  

# 创建 LS 和 surge 文件夹，如果已存在，则不做任何操作
os.makedirs(os.path.join("LS", "surge"), exist_ok=True)

# 新的 IP 列表的 URL
Apple = "https://github.com/Loyalsoldier/surge-rules/blob/release/apple.txt"
CNCIDR = "https://github.com/Loyalsoldier/surge-rules/blob/release/cncidr.txt"
Direct = "https://github.com/Loyalsoldier/surge-rules/blob/release/direct.txt"
GFW = "https://github.com/Loyalsoldier/surge-rules/blob/release/gfw.txt"
Google = "https://github.com/Loyalsoldier/surge-rules/blob/release/google.txt"
GreatFire = "https://github.com/Loyalsoldier/surge-rules/blob/release/greatfire.txt"
iCloud = "https://github.com/Loyalsoldier/surge-rules/blob/release/icloud.txt"
Private = "https://github.com/Loyalsoldier/surge-rules/blob/release/private.txt"
Proxy = "https://github.com/Loyalsoldier/surge-rules/blob/release/proxy.txt"
Reject = "https://github.com/Loyalsoldier/surge-rules/blob/release/reject.txt"
TelegramCIDR = "https://github.com/Loyalsoldier/surge-rules/blob/release/telegramcidr.txt"
TLDNotCN = "https://github.com/Loyalsoldier/surge-rules/blob/release/tld-not-cn.txt"

def fetch_and_save(url, file_name):
    """ 从指定 URL 获取数据并保存到文件 """
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
            # 如果未找到嵌入数据，打印提示并返回
            print(f"Failed to find embedded data in {url}")
            return
        
        # 解析 JSON 数据
        data = json.loads(asns)
        
        # 检查数据结构是否有效
        if 'payload' in data and 'blob' in data['payload'] and 'rawLines' in data['payload']['blob']:
            x = data['payload']['blob']['rawLines']
            
            # 检查数据是否为空
            if not x:
                print(f"No data found in {url}, skipping {file_name}.")
                return
            
            # 保存提取的数据到指定文件
            with open(os.path.join("LS", "surge", file_name), "w", encoding='utf-8') as file:
                # 写入每条数据到文件
                for i in x:
                    file.write(i)  # 写入数据行
                    file.write('\n')  # 换行
            print(f"Successfully saved data to {file_name}")
        else:
            # 如果数据结构无效，打印提示并返回
            print(f"Invalid data structure from {url}, skipping {file_name}.")

    except requests.exceptions.RequestException as e:
        # 捕获请求异常并打印错误信息
        print(f"Failed to fetch {url}: {e}")

# 执行函数，保存数据
fetch_and_save(Apple, "apple.txt")
fetch_and_save(CNCIDR, "cncidr.txt")
fetch_and_save(Direct, "direct.txt")
fetch_and_save(GFW, "gfw.txt")
fetch_and_save(Google, "google.txt")
fetch_and_save(GreatFire, "greatfire.txt")
fetch_and_save(iCloud, "icloud.txt")
fetch_and_save(Private, "private.txt")
fetch_and_save(Proxy, "proxy.txt")
fetch_and_save(Reject, "reject.txt")
fetch_and_save(TelegramCIDR, "telegramcidr.txt")
fetch_and_save(TLDNotCN, "tld-not-cn.txt")
