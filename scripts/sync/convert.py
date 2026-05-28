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
# 用于验证域名是否有合法的顶级域（如 .com、.co.uk）
from public_suffix_list import PublicSuffixList

# ========== 路径配置 ==========
# 当前脚本所在目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# JSON 配置文件目录
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
# 仓库根目录（脚本目录的上两级）
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))
# 元数据文件路径：记录每个规则文件最后更新时间
META_FILE = os.path.join(ROOT_DIR, "rules", "AdGuard", ".rules_meta.json")

# ========== 网络配置 ==========
TIMEOUT = 20      # 下载超时（秒）
RETRY = 3         # 下载失败重试次数

# ========== 初始化公共后缀列表 ==========
# 首次使用会自动从 https://publicsuffix.org/list/public_suffix_list.dat 下载
# 缓存 24 小时后自动更新
psl = PublicSuffixList()

# ========== 可选黑名单 ==========
# 如果你确定要过滤某些域名，可以取消注释
# 这些域名会被完全排除，不会出现在最终规则中
OPTIONAL_BLACKLIST = {
    # 'googleadservices.com',      # Google 广告服务
    # 'pagead2.googlesyndication.com',  # Google 广告
}

# ========== 临时文件管理 ==========
@contextmanager
def temp_file(content: bytes = None, suffix: str = '.txt'):
    """
    安全的临时文件上下文管理器
    使用 with 语句自动创建和清理临时文件
    """
    fd, path = tempfile.mkstemp(suffix=suffix)  # 创建临时文件
    os.close(fd)                                 # 关闭文件描述符
    try:
        if content:
            with open(path, 'wb') as f:
                f.write(content)
        yield path  # 返回文件路径给 with 代码块使用
    finally:
        if os.path.exists(path):
            os.unlink(path)  # 自动删除临时文件

# ========== 域名验证函数 ==========
def is_ip_address(domain: str) -> bool:
    """判断字符串是否为 IP 地址（IPv4 或 IPv6）"""
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        return False

def is_valid_domain(domain_str: str) -> bool:
    """
    检查字符串是否为有效域名
    验证规则：长度、格式、公共后缀
    """
    # 基础检查
    if not domain_str or '.' not in domain_str:
        return False
    
    # 不能是 IP 地址
    if is_ip_address(domain_str):
        return False
    
    # 不能有连续两个点（无效域名格式）
    if '..' in domain_str:
        return False
    
    # 域名长度检查（RFC 标准）
    if len(domain_str) < 3 or len(domain_str) > 253:
        return False
    
    # 使用公共后缀列表验证顶级域是否有效
    # 例如：com、org、co.uk 等都是有效后缀
    try:
        suffix = psl.public_suffix(domain_str)
        return suffix is not None
    except:
        # 如果库出错，降级为简单检查：至少有2个部分
        return len(domain_str.split('.')) >= 2

def is_blacklisted(domain: str) -> bool:
    """检查域名是否在可选黑名单中"""
    return domain in OPTIONAL_BLACKLIST

# ========== 域名提取函数 ==========
def extract_domain_from_rule(line: str):
    """
    从编译器输出的 AdGuard 规则中提取纯域名
    编译器输出格式示例：||example.com^
    """
    s = line.strip()
    if not s:
        return None
    
    # 跳过注释行
    if s.startswith(('!', '#', '@@')):
        return None
    
    # 匹配 ||example.com^ 格式
    # 正则说明：^\|\| 开头，([a-zA-Z0-9\-\.]+) 捕获域名，\^ 结尾
    m = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', s)
    if m:
        domain = m.group(1)
        # 验证域名有效且不在黑名单
        if is_valid_domain(domain) and not is_blacklisted(domain):
            return domain
    
    return None

# ========== AdGuard 编译器封装 ==========
def compile_with_adguard(raw_content: bytes) -> bytes:
    """
    使用 AdGuard 官方编译器优化规则
    
    转换说明：
    - RemoveComments: 删除注释行
    - RemoveModifiers: 删除修饰符（如 $third-party）
    - Compress: 压缩规则，合并冗余子域名
    - Deduplicate: 去除重复规则
    - Validate: 严格验证，删除不安全或不兼容的规则
      包括：$domain= 条件规则、正则规则、无效 TLD 规则等
    """
    try:
        with temp_file(raw_content, '.txt') as input_path:
            # 编译器配置
            config = {
                "name": "AdGuard Compiled",
                "sources": [{"source": input_path, "type": "adblock"}],
                "transformations": [
                    "RemoveComments",      # 删除注释
                    "RemoveModifiers",     # 删除修饰符
                    "Compress",            # 压缩合并
                    "Deduplicate",         # 去重
                    "Validate"             # 严格验证（会删除不兼容规则）
                ]
            }
            with temp_file(json.dumps(config).encode(), '.json') as config_path:
                # 调用编译器
                # -c: 配置文件路径
                # -o /dev/stdout: 输出到标准输出
                result = subprocess.run(
                    ['hostlist-compiler', '-c', config_path, '-o', '/dev/stdout'],
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=60
                )
                return result.stdout.encode('utf-8')
    except subprocess.TimeoutExpired:
        print("   ⚠️ 编译器超时，回退到原始转换")
        return raw_content
    except Exception as e:
        print(f"   ⚠️ 编译器异常: {e}，回退到原始转换")
        return raw_content

# ========== 规则转换主函数 ==========
def convert_to_domainset(raw_content: bytes) -> bytes:
    """
    将原始规则转换为 Surge DOMAIN-SET 格式
    
    步骤：
    1. 调用 AdGuard 编译器优化规则
    2. 逐行提取域名
    3. 去重、排序
    4. 加上前缀点（匹配子域名）
    """
    # 第一步：编译器优化
    compiled_content = compile_with_adguard(raw_content)
    text = compiled_content.decode('utf-8')
    
    # 第二步：提取域名
    domains = set()
    for line in text.splitlines():
        domain = extract_domain_from_rule(line)
        if not domain:
            continue
        domains.add(domain)
    
    # 第三步：输出格式处理
    # 加前缀点：.example.com 可以匹配 example.com 及其所有子域名
    result = '\n'.join('.' + d for d in sorted(domains))
    return result.encode('utf-8')

# ========== 下载函数（带重试）==========
def fetch(url: str, silent: bool = False) -> bytes:
    """
    下载文件，支持指数退避重试
    
    重试等待时间：1秒、2秒、4秒
    """
    for i in range(RETRY):
        try:
            r = requests.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            return r.content
        except Exception as e:
            if i == RETRY - 1:  # 最后一次重试失败
                raise Exception(f"Fetch failed: {url}")
            if not silent:
                wait_time = 2 ** i
                print(f"   [WARN] Retry {i+1}/{RETRY}: {e}, waiting {wait_time}s")
            time.sleep(2 ** i)
    raise Exception(f"Fetch failed: {url}")

# ========== 加载 JSON 配置 ==========
def load_all_sources():
    """
    加载 adguard.json 配置文件
    只加载这一个文件，忽略 sources 目录下的其他 JSON
    """
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
    """
    加载元数据文件
    元数据记录每个规则文件最后更新时间，用于 README 显示
    """
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
    """返回当前北京时间字符串（用于更新时间记录）"""
    return (datetime.utcnow() + timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S")

# ========== 生成 README 说明文件 ==========
def generate_readme(sources: list, root_dir: str, meta: dict):
    """
    生成 rules/AdGuard/README.md 说明文件
    
    包含：
    - 规则列表表格（文件名、作用、来源、更新时间）
    - Surge 配置示例（按大类分组，方便复制）
    - 规则来源和转换工具说明（放在最下面）
    """
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
        update_time = meta.get(filename, "未知")
        lines.append(f"| {filename} | {name} | AdGuard | {update_time} |")
    
    lines.append("\n## Surge 使用说明\n")
    lines.append("在 Surge 配置文件中添加以下规则（按需选择）：\n")
    
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
    
    # ========== 规则来源和转换工具==========
    lines.append("\n---\n")
    lines.append("## 规则来源\n")
    lines.append("- 原始规则：[AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry)\n")
    lines.append("- 转换工具：自定义 Python 脚本 + [AdGuard Hostlist Compiler](https://github.com/AdguardTeam/HostlistCompiler)\n")
    
    Path(readme_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    
    print(f"📄 已生成说明文件: {readme_path}")
# ========== 处理单个规则（并发执行）==========
def process_single(src: dict, root_dir: str, meta: dict) -> tuple:
    """
    处理单个规则源
    返回：(规则名称, 是否有变化, 文件名)
    """
    name = src["name"]
    url = src["url"]
    filename = os.path.basename(src["output_domainset"])
    output_path = os.path.join(root_dir, src["output_domainset"])

    print(f"\n🔄 {name}")

    # 下载原始规则
    try:
        raw_content = fetch(url, silent=True)
    except Exception as e:
        print(f"   ❌ 下载失败: {e}")
        return (name, False, filename)

    # 转换为 DOMAIN-SET
    converted_content = convert_to_domainset(raw_content)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # 检查是否需要更新（MD5 对比）
    need_update = False
    if os.path.exists(output_path):
        with open(output_path, "rb") as f:
            old_content = f.read()
        if hashlib.md5(old_content).hexdigest() != hashlib.md5(converted_content).hexdigest():
            need_update = True
    else:
        need_update = True

    # 如果需要更新，写入文件并记录时间
    if need_update:
        with open(output_path, "wb") as f:
            f.write(converted_content)
        line_count = len(converted_content.splitlines())
        print(f"   ✅ 已更新 ({line_count} 条)")
        # 更新元数据中的时间戳
        meta[filename] = get_beijing_time()
        return (name, True, filename)
    else:
        print(f"   ✔ 无变化")
        return (name, False, filename)

# ========== 主函数 ==========
def main():
    """
    主流程：
    1. 加载配置
    2. 并发下载并转换所有规则
    3. 记录有变化的规则
    4. 保存元数据并生成 README
    5. 标记是否提交（.changed 文件）
    """
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

    # 并发处理（最多 3 个线程）
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(process_single, src, ROOT_DIR, meta) for src in sources]
        for future in concurrent.futures.as_completed(futures):
            try:
                name, has_changed, filename = future.result()
                if has_changed:
                    changed = True
                    updated_sources.append(name)
            except Exception as e:
                print(f"⚠️ 处理规则时出错: {e}")

    # 只有有变化时，才保存元数据并重新生成 README
    if changed:
        save_meta(meta)
        generate_readme(sources, ROOT_DIR, meta)
        with open(changed_file, "w") as f:
            f.write("1")
    else:
        # 无变化时，标记为 0，GitHub Actions 不会提交
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
