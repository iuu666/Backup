import os
import requests
from lxml import etree
import json
import time

# -----------------------------------------------------
# 配置
# -----------------------------------------------------
SAVE_DIR = os.path.join("EAlyce", "Rule")
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
    "Apple.list": "https://github.com/EAlyce/conf/blob/main/Rule/Apple.list",
    "Crypto.list": "https://github.com/EAlyce/conf/blob/main/Rule/Crypto.list",
    "CryptoDraft.list": "https://github.com/EAlyce/conf/blob/main/Rule/CryptoDraft.list",
    "FQNovelAdvertising.list": "https://github.com/EAlyce/conf/blob/main/Rule/FQNovelAdvertising.list",
    "OpenAI.list": "https://github.com/EAlyce/conf/blob/main/Rule/OpenAI.list",
    "Oracle.list": "https://github.com/EAlyce/conf/blob/main/Rule/Oracle.list",
    "PayPal.list": "https://github.com/EAlyce/conf/blob/main/Rule/PayPal.list",
    "Proxy.list": "https://github.com/EAlyce/conf/blob/main/Rule/Proxy.list",
    "Telegram.list": "https://github.com/EAlyce/conf/blob/main/Rule/Telegram.list",
}

# -----------------------------------------------------
# 执行
# -----------------------------------------------------
for name, url in rules.items():
    fetch_and_save(url, name)
