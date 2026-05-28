#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AdGuard 规则转换器 - 将 AdGuard 官方规则转换为 Surge DOMAIN-SET 格式

工作流程：
1. 从 adguard.json 读取规则配置（11个 AdGuard 官方过滤器）
2. 并发下载原始规则文件
3. 使用 AdGuard 官方编译器优化规则（去重、压缩、验证）
4. 提取纯域名并验证有效性
5. 输出为 Surge 支持的 .domain.com 格式
6. 生成 README.md 说明文件和元数据文件

优化特性：
- 编译器缓存：避免重复编译相同内容
- 规则数量监控：检测异常骤降（下降超过 30% 时告警）
"""

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

# 第三方库：自动从 IANA/Mozilla 获取最新公共后缀列表
from public_suffix_list import PublicSuffixList

# ========== 路径配置 ==========
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))
META_FILE = os.path.join(ROOT_DIR, "rules", "AdGuard", ".rules_meta.json")

# 编译器缓存目录（使用系统临时目录）
CACHE_DIR = os.path.join(tempfile.gettempdir(), "adguard_rule_cache")

# ========== 网络配置 ==========
TIMEOUT = 20
RETRY = 3

# 规则数量异常阈值（下降超过此比例时告警）
ANOMALY_THRESHOLD = 0.3  # 30%

# ========== 初始化 ==========
psl = PublicSuffixList()

# 确保缓存目录存在
os.makedirs(CACHE_DIR, exist_ok=True)

# ========== 可选黑名单 ==========
OPTIONAL_BLACKLIST = {
    # 'googleadservices.com',
    # 'pagead2.googlesyndication.com',
}

# ========== 临时文件管理 ==========
@contextmanager
def temp_file(content: bytes = None, suffix: str = '.txt'):
    """安全的临时文件上下文管理器，自动清理"""
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

# ========== 域名验证函数 ==========
def is_ip_address(domain: str) -> bool:
    """判断字符串是否为 IP 地址"""
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
    if '..' in domain_str:
        return False
    if len(domain_str) < 3 or len(domain_str) > 253:
        return False
    try:
        suffix = psl.public_suffix(domain_str)
        return suffix is not None
    except:
        return len(domain_str.split('.')) >= 2

def is_blacklisted(domain: str) -> bool:
    """检查域名是否在可选黑名单中"""
    return domain in OPTIONAL_BLACKLIST

# ========== 域名提取 ==========
def extract_domain_from_rule(line: str):
    """从编译器输出的 AdGuard 规则中提取纯域名"""
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

# ========== AdGuard 编译器（带缓存）==========
def compile_with_adguard(raw_content: bytes) -> bytes:
    """
    使用 AdGuard 官方编译器优化规则
    支持缓存：相同内容只编译一次
    """
    # 计算原始内容的 MD5 作为缓存键
    content_hash = hashlib.md5(raw_content).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{content_hash}.txt")
    
    # 检查缓存是否存在
    if os.path.exists(cache_file):
        with open(cache_file, 'rb') as f:
            cached_content = f.read()
        # 验证缓存内容有效性（非空）
        if cached_content:
            return cached_content
    
    # 缓存未命中，执行编译
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
                
                # 保存到缓存
                with open(cache_file, 'wb') as f:
                    f.write(compiled)
                
                return compiled
    except subprocess.TimeoutExpired:
        print("   ⚠️ 编译器超时，回退到原始转换")
        return raw_content
    except Exception as e:
        print(f"   ⚠️ 编译器异常: {e}，回退到原始转换")
        return raw_content

# ========== 规则转换主函数 ==========
def convert_to_domainset(raw_content: bytes) -> bytes:
    """将原始规则转换为 Surge DOMAIN-SET 格式"""
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

# ========== 下载函数 ==========
def fetch(url: str, silent: bool = False) -> bytes:
    """下载文件，支持指数退避重试"""
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

# ========== 配置加载 ==========
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

# ========== 元数据管理 ==========
def load_meta() -> dict:
    """加载元数据文件"""
    if os.path.exists(META_FILE):
        with open(META_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_meta(meta: dict):
    """保存元数据文件"""
    Path(META_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

def get_beijing_time() -> str:
    """返回当前北京时间字符串"""
    return (datetime.utcnow() + timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S")

# ========== 规则数量监控 ==========
def check_count_anomaly(filename: str, current_count: int, meta: dict) -> bool:
    """
    检查规则数量是否异常
    返回 True 表示有异常
    """
    # 获取上次记录的规则数量
    last_data = meta.get(filename, {})
    last_count = last_data.get("count", 0) if isinstance(last_data, dict) else 0
    
    if last_count == 0:
        return False
    
    change_ratio = (current_count - last_count) / last_count
    
    # 下降超过阈值时告警
    if change_ratio < -ANOMALY_THRESHOLD:
        print(f"   ⚠️ 【数量异常】{filename}: {last_count} → {current_count} (下降 {abs(change_ratio)*100:.1f}%)")
        return True
    
    # 可选：增长超过阈值时也告警（通常是正常情况，不报警）
    # if change_ratio > ANOMALY_THRESHOLD:
    #     print(f"   📈 规则增长: {last_count} → {current_count} (+{change_ratio*100:.1f}%)")
    
    return False

# ========== 生成 README ==========
def generate_readme(sources: list, root_dir: str, meta: dict):
    """生成 rules/AdGuard/README.md 说明文件"""
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
        # 兼容新旧元数据格式
        time_data = meta.get(filename, {})
        update_time = time_data.get("time", "未知") if isinstance(time_data, dict) else time_data
        lines.append(f"| {filename} | {name} | AdGuard | {update_time} |")
    
    lines.append("\n## Surge 使用说明\n")
    lines.append("在 Surge 配置文件中添加以下规则（按需选择）：\n")
    
    lines.append("### 核心必选\n")
    lines.append("```text")
    lines.append("# 基础广告过滤")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT")
    lines.append("")
    lines.append("# 隐私追踪保护")
    lines.append("RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT")
    lines.append("```\n")
    
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
    """处理单个规则源，返回 (规则名称, 是否有变化, 文件名, 规则数量)"""
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

    # 规则数量异常监控
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
        # 更新元数据：存储时间和规则数量
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
