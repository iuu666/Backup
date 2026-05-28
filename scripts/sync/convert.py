import os
import re
import json
import requests
import hashlib
import time
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

TIMEOUT = 20
RETRY = 3

def fetch(url: str) -> bytes:
    for i in range(RETRY):
        try:
            r = requests.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            return r.content
        except Exception as e:
            print(f"[WARN] Retry {i+1}/{RETRY}: {e}")
            time.sleep(2)
    raise Exception(f"Fetch failed: {url}")

def convert_to_domainset(raw_content: bytes) -> bytes:
    """将 AdGuard 原始规则转换为 Surge DOMAIN-SET 格式"""
    text = raw_content.decode('utf-8')
    domains = set()
    ip_pattern = re.compile(r'^\d+\.\d+\.\d+\.\d+$')
    
    for line in text.splitlines():
        line = line.strip()
        
        if not line or line.startswith('!') or line.startswith('#') or line.startswith('@@'):
            continue
        
        match = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', line)
        if match:
            domain = match.group(1)
            # 过滤掉 IP 地址
            if not ip_pattern.match(domain):
                domains.add(domain)
    
    result = '\n'.join(sorted(domains))
    return result.encode('utf-8')

def load_all_sources():
    all_sources = []
    for file in os.listdir(CONFIG_DIR):
        if file.endswith(".json"):
            path = os.path.join(CONFIG_DIR, file)
            print(f"📦 Loading {file}")
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                all_sources.extend(data)
    return all_sources

def main():
    sources = load_all_sources()
    changed = False
    changed_file = os.path.join(ROOT_DIR, ".changed")
    updated_sources = []
    
    for src in sources:
        if "url" not in src or "output_domainset" not in src:
            print(f"⚠️ 跳过 {src.get('name', 'unknown')}: 缺少 url 或 output_domainset")
            continue
        
        name = src["name"]
        url = src["url"]
        output_path = os.path.join(ROOT_DIR, src["output_domainset"])
        
        print(f"\n🔄 处理: {name}")
        
        try:
            raw_content = fetch(url)
        except Exception as e:
            print(f"   ❌ 下载失败: {e}")
            continue
        
        converted_content = convert_to_domainset(raw_content)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        need_update = False
        if os.path.exists(output_path):
            with open(output_path, "rb") as f:
                old_content = f.read()
            if hashlib.md5(old_content).hexdigest() != hashlib.md5(converted_content).hexdigest():
                need_update = True
        else:
            need_update = True
        
        if need_update:
            with open(output_path, "wb") as f:
                f.write(converted_content)
            line_count = len(converted_content.splitlines())
            print(f"   ✅ 已更新: {line_count} 条规则")
            changed = True
            updated_sources.append(name)
        else:
            print(f"   ✔ 无变化")
    
    with open(changed_file, "w") as f:
        f.write("1" if changed else "0")
    
    print(f"\n=== RESULT ===")
    if changed:
        print(f"🚀 Changes detected: {', '.join(updated_sources)}")
    else:
        print("😴 No changes")

if __name__ == "__main__":
    main()
