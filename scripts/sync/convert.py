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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

TIMEOUT = 20
RETRY = 3

# ---------- 域名提取（从编译后的规则中提取）----------
def is_ip_address(domain: str) -> bool:
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False

def extract_domain_from_rule(line: str):
    """从编译后的 AdGuard 规则中提取纯域名"""
    s = line.strip()
    if not s:
        return None

    # 跳过注释 / 白名单
    if s.startswith(('!', '#', '@@')):
        return None

    # 匹配 ||example.com^ 格式（编译器输出格式）
    m = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', s)
    if m:
        return m.group(1)

    # 匹配 ||example.com/path^
    m = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)(?=/|\^)', s)
    if m:
        return m.group(1)

    # 匹配 .example.com 格式（某些情况）
    m = re.match(r'^\.([a-zA-Z0-9\-\.]+)$', s)
    if m:
        return m.group(1)

    return None

def compile_with_adguard(raw_content: bytes) -> bytes:
    """使用 AdGuard 官方编译器优化规则"""
    try:
        # 创建临时文件保存原始规则
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.txt', delete=False) as f:
            f.write(raw_content)
            input_path = f.name
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            # 创建编译器配置文件
            config = {
                "name": "AdGuard Compiled",
                "sources": [
                    {
                        "source": input_path,
                        "type": "adblock"
                    }
                ],
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
        
        # 调用 hostlist-compiler
        result = subprocess.run(
            ['hostlist-compiler', '-c', config_path, '-o', '/dev/stdout'],
            capture_output=True,
            text=True,
            check=True
        )
        
        # 清理临时文件
        os.unlink(input_path)
        os.unlink(config_path)
        
        return result.stdout.encode('utf-8')
    
    except subprocess.CalledProcessError as e:
        print(f"   ⚠️ 编译器执行失败: {e.stderr}")
        print(f"   ⚠️ 回退到原始转换")
        return raw_content
    except Exception as e:
        print(f"   ⚠️ 编译器调用异常: {e}")
        print(f"   ⚠️ 回退到原始转换")
        return raw_content

def convert_to_domainset(raw_content: bytes) -> bytes:
    """将编译后的规则转换为 Surge DOMAIN-SET 格式"""
    # 先调用编译器优化
    compiled_content = compile_with_adguard(raw_content)
    
    text = compiled_content.decode('utf-8')
    domains = set()

    for line in text.splitlines():
        domain = extract_domain_from_rule(line)
        if not domain:
            continue
        if is_ip_address(domain):
            continue
        if '.' in domain and not domain.startswith('.') and not domain.endswith('.'):
            domains.add(domain)

    # 输出时加前缀点，匹配域名及其所有子域名
    result = '\n'.join('.' + d for d in sorted(domains))
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

# ---------- 加载 JSON 配置（只加载 adguard.json）----------
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
        print(f"⚠️ 未找到 adguard.json，请检查路径: {target_file}")
    
    return all_sources

# ---------- 生成 README 说明文件 ----------
def generate_readme(sources: list, root_dir: str):
    """生成 rules/AdGuard/README.md 说明文件"""
    readme_path = os.path.join(root_dir, "rules", "AdGuard", "README.md")
    
    lines = []
    lines.append("# AdGuard 规则说明\n")
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
    lines.append("```text")
    lines.append("# ==================== 推荐必选（核心） ====================")
    lines.append("# 基础广告过滤")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT")
    lines.append("")
    lines.append("# 隐私追踪保护")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT")
    lines.append("")
    lines.append("# ==================== 可选增强 ====================")
    lines.append("# 中文网站专用")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT")
    lines.append("")
    lines.append("# 社交媒体组件屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT")
    lines.append("")
    lines.append("# DNS 恶意域名屏蔽")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT")
    lines.append("")
    lines.append("# ==================== 烦人元素屏蔽 ====================")
    lines.append("# 方式一：使用合集（包含以下 5 个子项，推荐）")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT")
    lines.append("")
    lines.append("# 方式二：单独使用子项（按需选择）")
    lines.append("")
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
    
    if not sources:
        print("❌ 没有加载到任何规则，请检查 adguard.json 文件")
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

    # 生成 README 说明文件
    generate_readme(sources, ROOT_DIR)

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
