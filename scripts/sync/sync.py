import os
import requests
import hashlib
import json
import time
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "sources.json")

TIMEOUT = 20
RETRY = 3

def md5(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()

def fetch(url: str) -> bytes:
    for i in range(RETRY):
        try:
            r = requests.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            return r.content
        except Exception as e:
            print(f"[WARN] Retry {i+1}/{RETRY}: {e}")
            time.sleep(2)
    raise Exception("Fetch failed")

def ensure_dir(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)

def process(src):
    name = src["name"]
    url = src["url"]
    output = src["output"]

    print(f"Checking {name}")

    new = fetch(url)

    # ⚠️ 输出路径改成基于仓库根目录
    root_dir = os.path.abspath(os.path.join(BASE_DIR, "../../"))
    output_path = os.path.join(root_dir, output)

    if os.path.exists(output_path):
        with open(output_path, "rb") as f:
            old = f.read()
        if md5(old) == md5(new):
            print("No change")
            return False

    ensure_dir(output_path)
    with open(output_path, "wb") as f:
        f.write(new)

    print("Updated")
    return True

def main():
    if not os.path.exists(CONFIG_FILE):
        print("sources.json not found")
        sys.exit(1)

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        sources = json.load(f)

    changed = False

    for s in sources:
        if process(s):
            changed = True

    print("Done")
    sys.exit(0)

if __name__ == "__main__":
    main()
