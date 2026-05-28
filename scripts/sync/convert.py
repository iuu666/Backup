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

# ---------- 域名提取（尽可能完善）----------
def is_ip_address(domain: str) -> bool:
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False

def extract_domain_from_rule(line: str):
    """从各种规则行中提取出纯域名（如果可能）"""
    s = line.strip()
    if not s:
        return None

    # 1. 跳过注释 / 白名单 / 隐藏元素规则等
    if s.startswith(('!', '#', '@@', '##', '$$', '$.', '#')):
        return None

    # 2. ||example.com^ 标准广告规则
    m = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', s)
    if m:
        return m.group(1)

    # 3. ||example.com/path^ 或 ||example.com^$xxx
    m = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)(?=/|\^)', s)
    if m:
        return m.group(1)

    # 4. example.com 纯域名
    m = re.match(r'^([a-zA-Z0-9\-\.]+)$', s)
    if m and '.' in m.group(1):
        return m.group(1)

    # 5. 0.0.0.0 example.com 或 127.0.0.1 example.com
    m = re.match(r'^\d+\.\d+\.\d+\.\d+\s+([a-zA-Z0-9\-\.]+)$', s)
    if m:
        return m.group(1)

    # 6. |http://example.com| 或 |https://example.com|
    m = re.match(r'^\|https?://([a-zA-Z0-9\-\.]+)/?\|$', s)
    if m:
        return m.group(1)

    # 7. *://*.example.com/* 通配符
    m = re.search(r'\*\.([a-zA-Z0-9\-\.]+)', s)
    if m:
        return m.group(1)

    # 8. *.example.com 泛域名
    m = re.match(r'^\*\.([a-zA-Z0-9\-\.]+)$', s)
    if m:
        return m.group(1)

    return None

def convert_to_domainset(raw_content: bytes) -> bytes:
    text = raw_content.decode('utf-8')
    domains = set()

    for line in text.splitlines():
        domain = extract_domain_from_rule(line)
        if not domain:
            continue
        if is_ip_address(domain):
            continue
        if '.' in domain and not domain.startswith('.') and not domain.endswith('.'):
            domains.add(domain)

    result = '\n'.join(sorted(domains))
    return result.encode('utf-8')

# ---------- 下载（指数退避重试）----------
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

# ---------- 加载 JSON 配置 ----------
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

# ---------- 处理单个规则 ----------
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
        line_count = len(converted_content.splitlines())
        print(f"   ✅ 已更新 ({line_count} 条)")
        return (name, True)
    else:
        print(f"   ✔ 无变化")
        return (name, False)

# ---------- 主函数 ----------
def main():
    sources = load_all_sources()
    changed = False
    changed_file = os.path.join(ROOT_DIR, ".changed")
    updated_sources = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single, src, ROOT_DIR) for src in sources]

        for future in concurrent.futures.as_completed(futures):
            try:
                name, has_changed = future.result()
                if has_changed:
                    changed = True
                    updated_sources.append(name)
            except Exception as e:
                print(f"⚠️ 处理规则时出错: {e}")

    with open(changed_file, "w") as f:
        f.write("1" if changed else "0")

    print(f"\n=== RESULT ===")
    if changed:
        print(f"🚀 已更新: {', '.join(updated_sources)}")
    else:
        print("😴 无变化")

# ---------- 入口（全局容错）----------
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ 致命错误: {e}")
        changed_file = os.path.join(ROOT_DIR, ".changed")
        with open(changed_file, "w") as f:
            f.write("0")
        raise
