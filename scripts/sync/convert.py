import os
import re
from pathlib import Path

# 配置：原始文件目录 -> 转换后输出目录
CONVERSIONS = [
    {
        "name": "AdGuard Base Filter",
        "input": "raw/base-filter.txt",           # sync.py 下载的原始文件路径
        "output": "domain-set/base-filter.txt",   # 转换后的 DOMAIN-SET 输出路径
    },
    {
        "name": "AdGuard Tracking Protection",
        "input": "raw/tracking-protection.txt",
        "output": "domain-set/tracking-protection.txt",
    },
    {
        "name": "AdGuard Annoyances",
        "input": "raw/annoyances.txt",
        "output": "domain-set/annoyances.txt",
    },
    # 按需添加更多
]

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

def convert_to_domainset(raw_content: str) -> list:
    """
    将 AdGuard 原始规则转换为 Surge DOMAIN-SET 格式的域名列表
    """
    domains = set()
    
    for line in raw_content.splitlines():
        line = line.strip()
        
        # 跳过空行、注释、例外规则
        if not line or line.startswith('!') or line.startswith('#') or line.startswith('@@'):
            continue
        
        # 匹配 ||example.com^ 格式
        # 也处理 ||example.com^$third-party 这类带选项的
        match = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', line)
        if match:
            domains.add(match.group(1))
    
    return sorted(domains)

def main():
    changed = False
    
    for cfg in CONVERSIONS:
        input_path = os.path.join(ROOT_DIR, cfg["input"])
        output_path = os.path.join(ROOT_DIR, cfg["output"])
        
        if not os.path.exists(input_path):
            print(f"⚠️ 跳过 {cfg['name']}：输入文件不存在 {input_path}")
            continue
        
        print(f"🔄 转换: {cfg['name']}")
        
        # 读取原始规则
        with open(input_path, 'r', encoding='utf-8') as f:
            raw_content = f.read()
        
        # 转换
        domains = convert_to_domainset(raw_content)
        
        # 确保输出目录存在
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        # 生成新内容
        new_content = '\n'.join(domains)
        
        # 检查是否有变化
        old_content = ""
        if os.path.exists(output_path):
            with open(output_path, 'r', encoding='utf-8') as f:
                old_content = f.read()
        
        if old_content != new_content:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"  ✅ 已更新: {len(domains)} 条规则 -> {cfg['output']}")
            changed = True
        else:
            print(f"  ✔ 无变化: {len(domains)} 条规则")
    
    # 更新 .changed 标记（如果之前 sync.py 已经创建了，这里追加变化标记）
    changed_file = os.path.join(ROOT_DIR, ".changed")
    if changed:
        with open(changed_file, 'w') as f:
            f.write('1')
        print("\n📝 标记：有规则更新")
    else:
        # 如果 sync.py 已经标记了变化，保留它；否则写 0
        if not os.path.exists(changed_file):
            with open(changed_file, 'w') as f:
                f.write('0')

if __name__ == "__main__":
    main()
