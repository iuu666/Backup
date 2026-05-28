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
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

TIMEOUT = 20
RETRY = 3

# ========== 有效顶级域名列表 ==========
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

# ========== 域名验证 ==========
def is_ip_address(domain: str) -> bool:
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False

def is_valid_domain(domain_str: str) -> bool:
    """检查字符串是否为有效域名"""
    if not domain_str or '.' not in domain_str:
        return False
    
    if is_ip_address(domain_str):
        return False
    
    parts = domain_str.split('.')
    if len(parts) < 2:
        return False
    
    tld = parts[-1].lower()
    return tld in VALID_TLDS

# ========== 域名提取（增强版）==========
def extract_domain_from_rule(line: str):
    """从各种规则行中提取出纯域名，并进行有效性验证"""
    s = line.strip()
    if not s:
        return None

    # 跳过注释 / 白名单 / 隐藏元素规则等
    if s.startswith(('!', '#', '@@', '##', '$$', '$.', '#')):
        return None

    # 匹配各种规则格式
    patterns = [
        r'^\|\|([a-zA-Z0-9\-\.]+)\^',           # ||example.com^
        r'^\|\|([a-zA-Z0-9\-\.]+)(?=/|\^)',     # ||example.com/path^
        r'^([a-zA-Z0-9\-\.]+)$',                 # example.com
        r'^\d+\.\d+\.\d+\.\d+\s+([a-zA-Z0-9\-\.]+)$',  # 0.0.0.0 example.com
        r'^\|https?://([a-zA-Z0-9\-\.]+)/?\|$', # |http://example.com|
        r'\*\.([a-zA-Z0-9\-\.]+)',               # *.example.com
        r'^\*\.([a-zA-Z0-9\-\.]+)$',             # *.example.com
        r'^\.([a-zA-Z0-9\-\.]+)$'                # .example.com
    ]
    
    for pattern in patterns:
        m = re.match(pattern, s)
        if m:
            domain = m.group(1)
            if is_valid_domain(domain):
                return domain
            # 如果域名无效，继续尝试其他模式
            continue
    
    return None

# ========== 使用 AdGuard 编译器优化 ==========
def compile_with_adguard(raw_content: bytes) -> bytes:
    """使用 AdGuard 官方编译器优化规则"""
    try:
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.txt', delete=False) as f:
            f.write(raw_content)
            input_path = f.name
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
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
            json.dump(config, f)
            config_path = f.name
        
        result = subprocess.run(
            ['hostlist-compiler', '-c', config_path, '-o', '/dev/stdout'],
            capture_output=True,
            text=True,
            check=True
        )
        
        os.unlink(input_path)
        os.unlink(config_path)
        
        return result.stdout.encode('utf-8')
    
    except Exception as e:
        print(f"   ⚠️ 编译器调用异常: {e}，回退到原始转换")
        return raw_content

# ========== 转换为 DOMAIN-SET ==========
def convert_to_domainset(raw_content: bytes) -> bytes:
    """将编译后的规则转换为 Surge DOMAIN-SET 格式"""
    compiled_content = compile_with_adguard(raw_content)
    text = compiled_content.decode('utf-8')
    domains = set()

    for line in text.splitlines():
        domain = extract_domain_from_rule(line)
        if not domain:
            continue
        domains.add(domain)

    # 输出时加前缀点，匹配域名及其所有子域名
    result = '\n'.join('.' + d for d in sorted(domains))
    return result.encode('utf-8')

# ========== 下载（指数退避重试）==========
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

# ========== 加载 JSON 配置 ==========
def load_all_sources():
    """只加载 adguard.json，忽略其他 JSON 文件"""
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

# ========== 生成 README 说明文件 ==========
def generate_readme(sources: list, root_dir: str, update_time: str):
    """生成 rules/AdGuard/README.md 说明文件"""
    readme_path = os.path.join(root_dir, "rules", "AdGuard", "README.md")
    
    lines = []
    lines.append("# AdGuard 规则说明\n")
    lines.append(f"> 最后更新时间：{update_time}\n")
    lines.append("> 本目录下的规则文件由 GitHub Actions 自动生成，请勿手动修改。\n")
    lines.append("## 规则列表\n")
    lines.append("| 文件名 | 规则来源 | 作用 |")
    lines.append("|--------|----------|------|")
    
    for src in sources:
        filename = os.path.basename(src["output_domainset"])
        name = src["name"]
        lines.append(f"| {filename} | AdGuard | {name} |")
    
    lines.append("\n## Surge 使用说明\n")
    lines.append("在 Surge 配置文件中添加以下规则（按需选择）：\n")
    
    # ========== 按大类分组，每个分组一个代码块 ==========
    
    # 核心必选
    lines.append("### 核心必选\n")
    lines.append("```text")
    lines.append("# 基础广告过滤")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT")
    lines.append("")
    lines.append("# 隐私追踪保护")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT")
    lines.append("```\n")
    
    # 可选增强
    lines.append("### 可选增强\n")
    lines.append("```text")
    lines.append("# 中文网站专用")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT")
    lines.append("")
    lines.append("# 社交媒体组件屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT")
    lines.append("")
    lines.append("# DNS 恶意域名屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT")
    lines.append("```\n")
    
    # 烦人元素合集
    lines.append("### 烦人元素屏蔽\n")
    lines.append("#### 方式一：使用合集（包含以下 5 个子项，推荐）\n")
    lines.append("```text")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT")
    lines.append("```\n")
    
    lines.append("#### 方式二：单独使用子项（按需选择）\n")
    lines.append("```text")
    lines.append("# 1. Cookie 通知屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-cookie-notices.txt,REJECT")
    lines.append("")
    lines.append("# 2. 弹窗屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-popups.txt,REJECT")
    lines.append("")
    lines.append("# 3. 移动端 App 横幅屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-mobile-app-banners.txt,REJECT")
    lines.append("")
    lines.append("# 4. 网页挂件屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-widgets.txt,REJECT")
    lines.append("")
    lines.append("# 5. 其他烦人元素屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-other.txt,REJECT")
    lines.append("```")
    
    Path(readme_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    
    print(f"📄 已生成说明文件: {readme_path}")

# ========== 处理单个规则 ==========
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

# ========== 主函数 ==========
def main():
    sources = load_all_sources()
    
    if not sources:
        print("❌ 没有加载到任何规则")
        changed_file = os.path.join(ROOT_DIR, ".changed")
        with open(changed_file, "w") as f:
            f.write("0")
        return
    
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

    # 获取当前北京时间
    beijing_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 生成 README 说明文件
    generate_readme(sources, ROOT_DIR, beijing_time)

    with open(changed_file, "w") as f:
        f.write("1" if changed else "0")

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
