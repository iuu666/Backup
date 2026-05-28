import os
import re
import json
import requests
import hashlib
import time
import ipaddress
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

TIMEOUT = 20
RETRY = 3

def is_ip_address(domain: str) -> bool:
    """判断是否为 IP 地址（支持 IPv4 和 IPv6）"""
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
            print(f"[WARN] Retry {i+1}/{RETRY}: {e}")
            time.sleep(2)
    raise Exception(f"Fetch failed: {url}")

def convert_to_domainset(raw_content: bytes) -> tuple[bytes, int, int]:
    """将 AdGuard 原始规则转换为 Surge DOMAIN-SET 格式
    返回: (转换后的内容, 原始行数, 提取的域名数)
    """
    text = raw_content.decode('utf-8')
    domains = set()
    total_lines = 0
    
    for line in text.splitlines():
        line = line.strip()
        total_lines += 1
        
        # 跳过空行、注释、例外规则
        if not line or line.startswith('!') or line.startswith('#') or line.startswith('@@'):
            continue
        
        # 匹配 ||example.com^ 格式
        match = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', line)
        if match:
            domain = match.group(1)
            # 过滤 IP 地址
            if not is_ip_address(domain):
                domains.add(domain)
    
    result = '\n'.join(sorted(domains))
    return result.encode('utf-8'), total_lines, len(domains)

def load_all_sources():
    """加载所有 JSON 配置文件"""
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
        print(f"   URL: {url}")
        
        # 下载原始规则
        try:
            raw_content = fetch(url)
        except Exception as e:
            print(f"   ❌ 下载失败: {e}")
            continue
        
        # 转换为 DOMAIN-SET
        converted_content, total_lines, domain_count = convert_to_domainset(raw_content)
        
        # 打印统计信息
        if total_lines > 0:
            filter_ratio = (1 - domain_count / total_lines) * 100
            print(f"   原始规则: {total_lines} 行 → 提取域名: {domain_count} 个 (过滤 {filter_ratio:.1f}%)")
        
        # 确保输出目录存在
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        # 检查是否有变化
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
            print(f"   ✅ 已更新: {src['output_domainset']}")
            changed = True
            updated_sources.append(name)
        else:
            print(f"   ✔ 无变化")
    
    # 写入变化标记
    with open(changed_file, "w") as f:
        f.write("1" if changed else "0")
    
    print(f"\n=== RESULT ===")
    if changed:
        print(f"🚀 Changes detected: {', '.join(updated_sources)}")
    else:
        print("😴 No changes")

if __name__ == "__main__":
    main()
