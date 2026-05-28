import os
import re
import json
import requests
import hashlib
import time
import ipaddress
import concurrent.futures
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

TIMEOUT = 20
RETRY = 3

# 正则预编译
DOMAIN_PATTERN = re.compile(r'^\|\|([a-zA-Z0-9\-\.]+)\^')


def is_ip_address(domain: str) -> bool:
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False


def fetch(url: str) -> bytes:
    for i in range(RETRY):
        try:
            r = requests.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            return r.content
        except Exception as e:
            wait_time = 2 ** i
            print(f"[WARN] Retry {i+1}/{RETRY}: {e}, waiting {wait_time}s")
            time.sleep(wait_time)
    raise Exception(f"Fetch failed: {url}")


def convert_to_domainset(raw_content: bytes) -> bytes:
    text = raw_content.decode('utf-8')
    domains = set()
    
    for line in text.splitlines():
        line = line.strip()
        
        if not line or line.startswith('!') or line.startswith('#') or line.startswith('@@'):
            continue
        
        match = DOMAIN_PATTERN.match(line)
        if match:
            domain = match.group(1)
            if not is_ip_address(domain):
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


def process_single(src: dict, root_dir: str) -> tuple[str, bool]:
    name = src["name"]
    url = src["url"]
    output_path = os.path.join(root_dir, src["output_domainset"])
    
    print(f"\n🔄 {name}")
    
    try:
        raw_content = fetch(url)
    except Exception as e:
        print(f"   ❌ 下载失败: {e}")
        return (name, False)
    
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
        print(f"   ✅ 已更新 ({len(converted_content.splitlines())} 条)")
        return (name, True)
    else:
        print(f"   ✔ 无变化")
        return (name, False)


def main():
    sources = load_all_sources()
    changed = False
    changed_file = os.path.join(ROOT_DIR, ".changed")
    updated_sources = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single, src, ROOT_DIR) for src in sources]
        
        for future in concurrent.futures.as_completed(futures):
            name, has_changed = future.result()
            if has_changed:
                changed = True
                updated_sources.append(name)
    
    with open(changed_file, "w") as f:
        f.write("1" if changed else "0")
    
    print(f"\n=== RESULT ===")
    if changed:
        print(f"🚀 已更新: {', '.join(updated_sources)}")
    else:
        print("😴 无变化")


if __name__ == "__main__":
    main()
