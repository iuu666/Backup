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
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import contextmanager

from public_suffix_list import PublicSuffixList

# ========== 预编译正则表达式（性能优化）==========
RE_PERFECT = re.compile(r'^\|\|([a-zA-Z0-9\-\.]+)\^')
RE_FIXABLE = re.compile(r'^\|\|([a-zA-Z0-9\-\.]+)(?:/|\^)')
RE_HOSTS = re.compile(r'^\d+\.\d+\.\d+\.\d+\s+([a-zA-Z0-9\-\.]+)$')
RE_PLAIN = re.compile(r'^([a-zA-Z0-9\-\.]+)$')
RE_ILLEGAL_CHARS = re.compile(r'[^a-zA-Z0-9\-\.]')
RE_AD_SIZE = re.compile(r'\d{2,4}[x\-]\d{2,4}')  # 广告尺寸模式
RE_PURE_NUMERIC = re.compile(r'^[\d\-]+$')       # 纯数字横线

# 有效 TLD 白名单
VALID_TLDS = {
    'com', 'org', 'net', 'io', 'co', 'uk', 'de', 'fr', 'jp', 'cn',
    'ru', 'br', 'tr', 'pl', 'cz', 'nl', 'se', 'no', 'fi', 'dk',
    'at', 'ch', 'be', 'it', 'es', 'pt', 'gr', 'hu', 'ro', 'ua',
    'in', 'id', 'my', 'sg', 'hk', 'tw', 'kr', 'au', 'nz', 'ca',
    'mx', 'ar', 'cl', 'za', 'eu', 'gov', 'edu', 'mil', 'info', 'biz',
    'tv', 'cc', 'me', 'name', 'pro', 'xyz', 'top', 'club', 'online',
    'site', 'tech', 'store', 'press', 'host', 'space', 'website',
    'cloud', 'app', 'dev', 'page', 'ly', 'today', 'group', 'work',
    'link', 'news', 'media', 'social', 'blog', 'world', 'life', 'one'
}

# 需要过滤的文件扩展名
INVALID_EXTENSIONS = {'.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.html', '.htm', '.json', '.xml', '.txt'}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))
DIFF_DIR = os.path.join(BASE_DIR, "diffs")
META_FILE = os.path.join(BASE_DIR, ".rules_meta.json")
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".adguard_cache")
WARNINGS_FILE = os.path.join(BASE_DIR, "filter_warnings.log")

TIMEOUT = 20
RETRY = 3
ANOMALY_THRESHOLD = 0.3

psl = PublicSuffixList()
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(DIFF_DIR, exist_ok=True)

OPTIONAL_BLACKLIST = {
    # 'googleadservices.com',
    # 'pagead2.googlesyndication.com',
}

# ========== 临时文件管理 ==========
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

# ========== 域名验证（增强版）==========
def is_ip_address(domain: str) -> bool:
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False

def is_valid_domain(domain_str: str) -> bool:
    # ========== 硬性过滤 ==========
    # 1. 广告尺寸模式
    if RE_AD_SIZE.search(domain_str):
        return False
    
    # 2. 以横线或点开头
    if domain_str.startswith(('-', '.')):
        return False
    
    # 3. 以横线或点结尾
    if domain_str.endswith(('-', '.')):
        return False
    
    # 4. 连续两个点
    if '..' in domain_str:
        return False
    
    # 5. 纯数字或纯横线组合
    if RE_PURE_NUMERIC.match(domain_str):
        return False
    
    # 6. 空字符串或没有点
    if not domain_str or '.' not in domain_str:
        return False
    
    # 7. 检查是否以无效文件扩展名结尾
    for ext in INVALID_EXTENSIONS:
        if domain_str.endswith(ext):
            return False
    
    # ========== 基础验证 ==========
    if is_ip_address(domain_str):
        return False
    
    if len(domain_str) < 3 or len(domain_str) > 253:
        return False
    
    if RE_ILLEGAL_CHARS.search(domain_str):
        return False
    
    # ========== TLD 白名单验证 ==========
    parts = domain_str.split('.')
    if len(parts) < 2:
        return False
    tld = parts[-1].lower()
    if tld not in VALID_TLDS:
        return False
    
    # ========== 公共后缀列表验证（兜底）==========
    try:
        suffix = psl.public_suffix(domain_str)
        return suffix is not None
    except:
        return True  # 白名单已经通过，这里返回 True

def is_blacklisted(domain: str) -> bool:
    return domain in OPTIONAL_BLACKLIST

# ========== Surge 兼容性验证 ==========
def is_surge_compatible(domain_with_dot: str) -> bool:
    if not domain_with_dot.startswith('.'):
        return False
    if '*' in domain_with_dot or '?' in domain_with_dot:
        return False
    if len(domain_with_dot) > 255:
        return False
    if '..' in domain_with_dot:
        return False
    if RE_AD_SIZE.search(domain_with_dot):
        return False
    for ext in INVALID_EXTENSIONS:
        if domain_with_dot.endswith(ext):
            return False
    return True

# ========== 规则分类与提取 ==========
def classify_and_extract_rule(line: str):
    s = line.strip()
    if not s:
        return None, 'skip', 'Empty line'
    
    if s.startswith(('!', '#', '@@')):
        return None, 'skip', 'Comment or Whitelist'
    
    # 1. 完美格式
    m = RE_PERFECT.match(s)
    if m:
        domain = m.group(1)
        if not is_valid_domain(domain):
            return None, 'filtered_invalid', f'Filtered invalid domain: {domain}'
        return domain, 'perfect', None
    
    # 2. 可修正格式: 带路径或修饰符
    m = RE_FIXABLE.match(s)
    if m:
        domain = m.group(1)
        if not is_valid_domain(domain):
            return None, 'filtered_invalid', f'Filtered invalid domain: {domain}'
        return domain, 'fixable_path', f'Extracted from path/modifier: {s[:80]}...'
    
    # 3. 可修正格式: hosts 风格
    m = RE_HOSTS.match(s)
    if m:
        domain = m.group(1)
        if not is_valid_domain(domain):
            return None, 'filtered_invalid', f'Filtered invalid domain: {domain}'
        return domain, 'fixable_hosts', f'Extracted from hosts: {s[:80]}...'
    
    # 4. 可修正格式: 纯域名
    m = RE_PLAIN.match(s)
    if m and '.' in m.group(1):
        domain = m.group(1)
        if not is_valid_domain(domain):
            return None, 'filtered_invalid', f'Filtered invalid domain: {domain}'
        return domain, 'fixable_plain', f'Extracted from plain domain: {s[:80]}...'
    
    return None, 'incompatible', f'Unsupported: {s[:100]}...'

# ========== 规则变化报告 ==========
def generate_diff_report(old_content: bytes, new_content: bytes, filename: str):
    old_lines = set(old_content.decode('utf-8').splitlines()) if old_content else set()
    new_lines = set(new_content.decode('utf-8').splitlines())
    
    added = new_lines - old_lines
    removed = old_lines - new_lines
    
    if not added and not removed:
        return
    
    diff_file = os.path.join(DIFF_DIR, f"{filename}.diff.txt")
    with open(diff_file, 'w', encoding='utf-8') as f:
        f.write(f"=== {filename} 规则变化报告 ===\n")
        f.write(f"更新时间: {get_beijing_time()}\n")
        f.write(f"更新前: {len(old_lines)} 条\n")
        f.write(f"更新后: {len(new_lines)} 条\n")
        f.write(f"变化: +{len(added)} / -{len(removed)}\n")
        f.write("\n" + "="*60 + "\n\n")
        
        if added:
            f.write(f"✅ 新增规则 ({len(added)} 条):\n")
            f.write("-" * 40 + "\n")
            for rule in sorted(added):
                f.write(f"  + {rule}\n")
            f.write("\n")
        
        if removed:
            f.write(f"❌ 删除规则 ({len(removed)} 条):\n")
            f.write("-" * 40 + "\n")
            for rule in sorted(removed):
                f.write(f"  - {rule}\n")
            f.write("\n")
    
    print(f"   📊 变化报告已生成: {diff_file}")

# ========== 警告日志管理 ==========
def log_warning(warnings: list, filename: str):
    if not warnings:
        return
    
    with open(WARNINGS_FILE, 'a', encoding='utf-8') as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"[{filename}] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"{'='*60}\n")
        for warning in warnings:
            f.write(f"  ⚠️ {warning}\n")
        f.write(f"共 {len(warnings)} 条警告\n")

# ========== AdGuard 编译器 ==========
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

# ========== 核心转换函数 ==========
def convert_to_domainset(raw_content: bytes, filename: str = "unknown") -> bytes:
    compiled_content = compile_with_adguard(raw_content)
    text = compiled_content.decode('utf-8')
    domains = set()
    warnings = []
    
    for line in text.splitlines():
        domain, rule_type, warning = classify_and_extract_rule(line)
        
        if warning and rule_type not in ('skip', 'perfect'):
            warnings.append(f"[{rule_type}] {warning}")
        
        if domain and is_valid_domain(domain) and not is_blacklisted(domain):
            domains.add(domain)
    
    if warnings:
        log_warning(warnings, filename)
        print(f"   📝 警告 {len(warnings)} 条已记录")
    
    valid_rules = []
    for d in sorted(domains):
        surge_rule = '.' + d
        if is_surge_compatible(surge_rule):
            valid_rules.append(surge_rule)
    
    result = '\n'.join(valid_rules)
    return result.encode('utf-8')

# ========== 下载 ==========
def fetch(url: str, silent: bool = False) -> bytes:
    for i in range(RETRY):
        try:
            r = requests.get(url, timeout=TIMEOUT)
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

# ========== 加载配置 ==========
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

# ========== 元数据管理 ==========
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

# ========== 生成 README ==========
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

# ========== 处理单个规则 ==========
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

    converted_content = convert_to_domainset(raw_content, filename)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    rule_count = len(converted_content.splitlines())
    check_count_anomaly(filename, rule_count, meta)

    need_update = False
    old_content = None
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
        
        if old_content:
            generate_diff_report(old_content, converted_content, filename)
        
        print(f"   ✅ 已更新 ({rule_count} 条)")
        meta[filename] = {
            "time": get_beijing_time(),
            "count": rule_count
        }
        return (name, True, filename, rule_count)
    else:
        print(f"   ✔ 无变化 ({rule_count} 条)")
        return (name, False, filename, rule_count)

# ========== 主函数 ==========
def main():
    if os.path.exists(WARNINGS_FILE):
        os.remove(WARNINGS_FILE)
        print("📝 已清空旧警告日志\n")
    
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

# ========== 入口 ==========
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ 致命错误: {e}")
        changed_file = os.path.join(ROOT_DIR, ".changed")
        with open(changed_file, "w") as f:
            f.write("0")
        raise
