import os
import requests
from lxml import etree
import json
import time

# -----------------------------------------------------
# 配置
# -----------------------------------------------------
SAVE_DIR = os.path.join("BM7", "Surge")
os.makedirs(SAVE_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

# -----------------------------------------------------
# 下载函数（自动识别 raw/blob）
# -----------------------------------------------------
def fetch_and_save(url, file_name, retry=3):
    print(f"\n=== Fetching {file_name} ===")
    print(f"URL: {url}")

    for attempt in range(1, retry + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            text = r.text

            # -----------------------------------------------------
            # ① RAW 文件（raw.githubusercontent.com）
            # -----------------------------------------------------
            if "raw.githubusercontent.com" in url:
                print("→ Detected RAW file. Saving directly.")
                lines = text.splitlines()

            # -----------------------------------------------------
            # ② GitHub blob 页面（含 embeddedData）
            # -----------------------------------------------------
            elif "github.com" in url and "/blob/" in url:
                print("→ Detected GitHub BLOB HTML page. Parsing embeddedData...")

                tree = etree.HTML(text)
                node = tree.xpath('//*[@data-target="react-app.embeddedData"]')

                if not node:
                    print("× ERROR: EmbeddedData not found, trying fallback direct text")
                    lines = text.splitlines()
                else:
                    embedded_json = node[0].text
                    raw_data = json.loads(embedded_json)
                    lines = raw_data["payload"]["blob"]["rawLines"]
                    print("✓ EmbeddedData parsed successfully.")

            # -----------------------------------------------------
            # ③ 其他情况 fallback（普通文本）
            # -----------------------------------------------------
            else:
                print("→ Unknown URL type, using fallback direct text mode.")
                lines = text.splitlines()

            # -----------------------------------------------------
            # 保存文件
            # -----------------------------------------------------
            save_path = os.path.join(SAVE_DIR, file_name)
            with open(save_path, "w", encoding="utf-8") as f:
                for line in lines:
                    f.write(line.rstrip() + "\n")

            print(f"✓ Saved: {save_path}")
            return

        except Exception as e:
            print(f"× Attempt {attempt}/{retry} failed: {e}")

            if attempt < retry:
                print("→ Retrying after 2s...")
                time.sleep(2)
            else:
                print("✖ Completely failed.\n")


# -----------------------------------------------------
# 规则 URL 列表
# -----------------------------------------------------
rules = {
    "Direct.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Direct/Direct.list",
    "Hijacking.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Hijacking/Hijacking.list",
    "Privacy_All_No_Resolve.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Privacy/Privacy_All_No_Resolve.list",
    "Apple_All_No_Resolve.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Apple/Apple_All_No_Resolve.list",
    "Microsoft.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Microsoft/Microsoft.list",
    "Google.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Google/Google.list",
    "OpenAI.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/OpenAI/OpenAI.list",
    "GitHub.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/GitHub/GitHub.list",
    "Telegram.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Telegram/Telegram.list",
    "Instagram.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Instagram/Instagram.list",
    "TikTok.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/TikTok/TikTok.list",
    "Spotify.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Spotify/Spotify.list",
    "YouTube.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/YouTube/YouTube.list",
    "Netflix.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Netflix/Netflix.list",
    "Disney.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Disney/Disney.list",
    "DouYin.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/DouYin/DouYin.list",
    "Gemini.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Gemini/Gemini.list",
    "ChinaMedia.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/ChinaMedia/ChinaMedia.list",
    "GlobalMedia_All_No_Resolve.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/GlobalMedia/GlobalMedia_All_No_Resolve.list",
    "Proxy_All_No_Resolve.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/Proxy/Proxy_All_No_Resolve.list",
    "China_All_No_Resolve.list": "https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Surge/China/China_All_No_Resolve.list",
    "ChinaMax_All.list": "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Surge/ChinaMax/ChinaMax_All.list",
}

# -----------------------------------------------------
# 执行
# -----------------------------------------------------
for name, url in rules.items():
    fetch_and_save(url, name)
