import os
import re
import json
import requests
import hashlib
import time
import ipaddress
import concurrent.futures
import subprocess
import tempfile
import threading
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import contextmanager

from public_suffix_list import PublicSuffixList

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))
META_FILE = os.path.join(ROOT_DIR, ".rules_meta.json")
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".adguard_cache")

TIMEOUT = 20
RETRY = 3
ANOMALY_THRESHOLD = 0.3

psl = PublicSuffixList()
os.makedirs(CACHE_DIR, exist_ok=True)

# 线程锁，用于保护 meta 字典的写入
meta_lock = threading.Lock()

OPTIONAL_BLACKLIST = {
    # 'googleadservices.com',
    # 'pagead2.googlesyndication.com',
}

@contextmanager
def temp_file(content: bytes = None, suffix: str = '.txt'):
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        if content:
            with open(path, 'wb') as f:
                f.write(content)
        yield path
    finally:
        if os.path.exists(path):
            os.unlink(path)

def is_ip_address(domain: str) -> bool:
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False

def is_valid_domain(domain_str: str) -> bool:
    if not domain_str or '.' not in domain_str:
        return False
    if is_ip_address(domain_str):
        return False
    if '..' in domain_str:
        return False
    if len(domain_str) < 3 or len(domain_str) > 253:
        return False
    try:
        suffix = psl.public_suffix(domain_str)
        return suffix is not None
    except:
        parts = domain_str.split('.')
        if len(parts) < 2:
            return False
        tld = parts[-1].lower()
        if tld in ('js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'html', 'htm', 'json', 'xml', 'txt'):
            return False
        return True

def is_blacklisted(domain: str) -> bool:
    return domain in OPTIONAL_BLACKLIST

def extract_domain_from_rule(line: str):
    s = line.strip()
    if not s:
        return None
    if s.startswith(('!', '#', '@@')):
        return None
    m = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', s)
    if m:
        domain = m.group(1)
        if is_valid_domain(domain) and not is_blacklisted(domain):
            return domain
    return None

def compile_with_adguard(raw_content: bytes) -> bytes:
    content_hash = hashlib.md5(raw_content).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{content_hash}.txt")
    
    if os.path.exists(cache_file):
        with open(cache_file, 'rb') as f:
            cached_content = f.read()
        if cached_content:
            return cached_content
    
    try:
        with temp_file(raw_content, '.txt') as input_path:
            config = {
                "name": "AdGuard Compiled",
                "sources": [{"source": input_path, "type": "adblock"}],
                "transformations": [
                    "RemoveComments",
                    "RemoveModifiers",
                    "Compress",
                    "Deduplicate",
                    "Validate"
                ]
            }
            with temp_file(json.dumps(config).encode(), '.json') as config_path:
                result = subprocess.run(
                    ['hostlist-compiler', '-c', config_path, '-o', '/dev/stdout'],
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=60
                )
                compiled = result.stdout.encode('utf-8')
                with open(cache_file, 'wb') as f:
                    f.write(compiled)
                return compiled
    except Exception as e:
        print(f"   ⚠️ 编译器异常: {e}，回退到原始转换")
        return raw_content

def convert_to_domainset(raw_content: bytes) -> bytes:
    compiled_content = compile_with_adguard(raw_content)
    text = compiled_content.decode('utf-8')
    domains = set()
    for line in text.splitlines():
        domain = extract_domain_from_rule(line)
        if not domain:
            continue
        domains.add(domain)
    result = '\n'.join('.' + d for d in sorted(domains))
    return result.encode('utf-8')

def fetch(url: str, silent: bool = False) -> bytes:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    for i in range(RETRY):
        try:
            r = requests.get(url, timeout=TIMEOUT, headers=headers)
            r.raise_for_status()
            return r.content
        except Exception as e:
            if i == RETRY - 1:
                raise Exception(f"Fetch failed: {url}")
            if not silent:
                wait_time = 2 ** i
                print(f"   [WARN] Retry {i+1}/{RETRY}: {e}, waiting {wait_time}s")
            time.sleep(2 ** i)
    raise Exception(f"Fetch failed: {url}")

def load_all_sources():
    all_sources = []
    target_file = os.path.join(CONFIG_DIR, "adguard.json")
    if os.path.exists(target_file):
        print(f"📦 Loading adguard.json")
        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            all_sources.extend(data)
    else:
        print(f"⚠️ 未找到 adguard.json")
    return all_sources

def load_meta() -> dict:
    if os.path.exists(META_FILE):
        with open(META_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_meta(meta: dict):
    Path(META_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

def get_beijing_time() -> str:
    return (datetime.utcnow() + timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S")

def check_count_anomaly(filename: str, current_count: int, meta: dict) -> bool:
    last_data = meta.get(filename, {})
    last_count = last_data.get("count", 0) if isinstance(last_data, dict) else 0
    if last_count == 0:
        return False
    change_ratio = (current_count - last_count) / last_count
    if change_ratio < -ANOMALY_THRESHOLD:
        print(f"   ⚠️ 【数量异常】{filename}: {last_count} → {current_count} (下降 {abs(change_ratio)*100:.1f}%)")
        return True
    return False

def generate_readme(sources: list, root_dir: str, meta: dict):
    readme_path = os.path.join(root_dir, "rules", "AdGuard", "README.md")
    
    lines = []
    lines.append("# AdGuard 规则说明\n")
    lines.append("> 本目录下的规则文件由 GitHub Actions 自动生成，请勿手动修改。\n")
    lines.append("## 规则列表\n")
    lines.append("| 文件名 | 作用 | 规则来源 | 更新时间 |")
    lines.append("|--------|------|----------|----------|")
    
    for src in sources:
        filename = os.path.basename(src["output_domainset"])
        name = src["name"]
        time_data = meta.get(filename, {})
        update_time = time_data.get("time", "未知") if isinstance(time_data, dict) else time_data
        lines.append(f"| {filename} | {name} | AdGuard | {update_time} |")
    
    lines.append("\n## Surge 使用说明\n")
    lines.append("在 Surge 配置文件中添加以下规则（按需选择）：\n")
    
    lines.append("### 核心必选\n")
    lines.append("```text")
    lines.append("# 基础广告过滤")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT")
    lines.append("")
    lines.append("# 隐私追踪保护")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT")
    lines.append("```\n")
    
    lines.append("### 可选增强\n")
    lines.append("```text")
    lines.append("# 中文网站专用")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT")
    lines.append("")
    lines.append("# 社交媒体组件屏蔽")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT")
    lines.append("")
    lines.append("# DNS 恶意域名屏蔽")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT")
    lines.append("```\n")
    
    lines.append("### 烦人元素屏蔽\n")
    lines.append("#### 方式一：使用合集（包含以下 5 个子项，推荐）\n")
    lines.append("```text")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT")
    lines.append("```\n")
    
    lines.append("#### 方式二：单独使用子项（按需选择）\n")
    lines.append("```text")
    lines.append("# 1. Cookie 通知屏蔽")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-cookie-notices.txt,REJECT")
    lines.append("")
    lines.append("# 2. 弹窗屏蔽")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-popups.txt,REJECT")
    lines.append("")
    lines.append("# 3. 移动端 App 横幅屏蔽")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-mobile-app-banners.txt,REJECT")
    lines.append("")
    lines.append("# 4. 网页挂件屏蔽")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-widgets.txt,REJECT")
    lines.append("")
    lines.append("# 5. 其他烦人元素屏蔽")
    lines.append("DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-other.txt,REJECT")
    lines.append("```")
    
    lines.append("\n---\n")
    lines.append("## 规则来源\n")
    lines.append("- 原始规则：[AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry)\n")
    lines.append("- 转换工具：自定义 Python 脚本 + [AdGuard Hostlist Compiler](https://github.com/AdguardTeam/HostlistCompiler)\n")
    
    Path(readme_path).parent.mkdir(parents=True, exist_ok=True)
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"📄 已生成说明文件: {readme_path}")

def process_single(src: dict, root_dir: str, meta: dict) -> tuple:
    name = src["name"]
    url = src["url"]
    filename = os.path.basename(src["output_domainset"])
    output_path = os.path.join(root_dir, src["output_domainset"])

    print(f"\n🔄 {name}")

    try:
        raw_content = fetch(url, silent=True)
    except Exception as e:
        print(f"   ❌ 下载失败: {e}")
        return (name, False, filename, 0)

    converted_content = convert_to_domainset(raw_content)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    rule_count = len(converted_content.splitlines())
    check_count_anomaly(filename, rule_count, meta)

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
        print(f"   ✅ 已更新 ({rule_count} 条)")
        
        # 线程安全写入 meta
        with meta_lock:
            meta[filename] = {
                "time": get_beijing_time(),
                "count": rule_count
            }
        return (name, True, filename, rule_count)
    else:
        print(f"   ✔ 无变化 ({rule_count} 条)")
        return (name, False, filename, rule_count)

def main():
    sources = load_all_sources()
    if not sources:
        print("❌ 没有加载到任何规则")
        changed_file = os.path.join(ROOT_DIR, ".changed")
        with open(changed_file, "w") as f:
            f.write("0")
        return
    
    meta = load_meta()
    changed = False
    changed_file = os.path.join(ROOT_DIR, ".changed")
    updated_sources = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(process_single, src, ROOT_DIR, meta) for src in sources]
        for future in concurrent.futures.as_completed(futures):
            try:
                name, has_changed, filename, count = future.result()
                if has_changed:
                    changed = True
                    updated_sources.append(name)
            except Exception as e:
                print(f"⚠️ 处理规则时出错: {e}")

    if changed:
        save_meta(meta)
        generate_readme(sources, ROOT_DIR, meta)
        with open(changed_file, "w") as f:
            f.write("1")
    else:
        with open(changed_file, "w") as f:
            f.write("0")

    print(f"\n=== RESULT ===")
    if changed:
        print(f"🚀 已更新: {', '.join(updated_sources)}")
    else:
        print("😴 无变化")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ 致命错误: {e}")
        changed_file = os.path.join(ROOT_DIR, ".changed")
        with open(changed_file, "w") as f:
            f.write("0")
        raise
