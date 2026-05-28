import os
import re
import json
import requests
import hashlib
import time
import ipaddress
import concurrent.futures
from pathlib import Path
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

TIMEOUT = 20
RETRY = 3

# 正则预编译
DOMAIN_PATTERN = re.compile(r'^\|\|([a-zA-Z0-9\-\.]+)\^')
IP_PATTERN = re.compile(r'^\d+\.\d+\.\d+\.\d+$')

# 统计文件路径
STATS_FILE = os.path.join(ROOT_DIR, "stats.json")


def is_ip_address(domain: str) -> bool:
    """判断是否为 IP 地址（支持 IPv4 和 IPv6）"""
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False


def fetch(url: str) -> bytes:
    """指数退避重试下载"""
    for i in range(RETRY):
        try:
            r = requests.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            return r.content
        except Exception as e:
            wait_time = 2 ** i  # 1, 2, 4 秒
            print(f"[WARN] Retry {i+1}/{RETRY}: {e}, waiting {wait_time}s")
            time.sleep(wait_time)
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
        
        # 使用预编译的正则
        match = DOMAIN_PATTERN.match(line)
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


def load_stats() -> dict:
    """加载历史统计信息"""
    if os.path.exists(STATS_FILE):
        with open(STATS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_stats(stats: dict):
    """保存统计信息"""
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)


def check_domain_count_anomaly(name: str, domain_count: int, old_stats: dict) -> bool:
    """检查域名数量是否异常（突然下降超过 30%）"""
    if name not in old_stats:
        return False
    
    old_count = old_stats[name].get("domain_count", 0)
    if old_count == 0:
        return False
    
    change_ratio = (domain_count - old_count) / old_count
    # 下降超过 30% 视为异常
    if change_ratio < -0.3:
        print(f"   ⚠️ 警告: 域名数量从 {old_count} 骤降至 {domain_count} (变化 {change_ratio:.1%})")
        return True
    
    return False


def process_single(src: dict, root_dir: str) -> tuple[str, bool, str, int, int]:
    """处理单个规则源，返回 (name, 是否有变化, output_path, 原始行数, 域名数)"""
    name = src["name"]
    url = src["url"]
    output_path = os.path.join(root_dir, src["output_domainset"])
    
    print(f"\n🔄 处理: {name}")
    print(f"   URL: {url}")
    
    # 下载原始规则
    try:
        raw_content = fetch(url)
    except Exception as e:
        print(f"   ❌ 下载失败: {e}")
        return (name, False, output_path, 0, 0)
    
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
        return (name, True, output_path, total_lines, domain_count)
    else:
        print(f"   ✔ 无变化")
        return (name, False, output_path, total_lines, domain_count)


def main():
    sources = load_all_sources()
    old_stats = load_stats()
    new_stats = {}
    changed = False
    changed_file = os.path.join(ROOT_DIR, ".changed")
    updated_sources = []
    
    # 并发下载处理
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single, src, ROOT_DIR) for src in sources]
        
        for future in concurrent.futures.as_completed(futures):
            name, has_changed, output_path, total_lines, domain_count = future.result()
            
            if has_changed:
                changed = True
                updated_sources.append(name)
            
            # 更新统计信息
            new_stats[name] = {
                "domain_count": domain_count,
                "total_lines": total_lines,
                "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "output_path": output_path
            }
            
            # 检查异常
            if domain_count > 0:
                check_domain_count_anomaly(name, domain_count, old_stats)
    
    # 保存统计信息
    save_stats(new_stats)
    
    # 写入变化标记
    with open(changed_file, "w") as f:
        f.write("1" if changed else "0")
    
    print(f"\n=== RESULT ===")
    if changed:
        print(f"🚀 Changes detected: {', '.join(updated_sources)}")
    else:
        print("😴 No changes")
    
    # 打印统计摘要
    print(f"\n📊 统计摘要已保存至: {STATS_FILE}")


if __name__ == "__main__":
    main()
