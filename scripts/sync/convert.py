import os
import re
import json
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

def convert_to_domainset(raw_content: str) -> list:
    """将 AdGuard 原始规则转换为 Surge DOMAIN-SET 格式的域名列表"""
    domains = set()
    
    for line in raw_content.splitlines():
        line = line.strip()
        
        # 跳过空行、注释、例外规则
        if not line or line.startswith('!') or line.startswith('#') or line.startswith('@@'):
            continue
        
        # 匹配 ||example.com^ 格式，可选 $xxx 后缀
        match = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', line)
        if match:
            domains.add(match.group(1))
    
    return sorted(domains)

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
    
    for src in sources:
        # 只处理配置了 output_domainset 的源
        if "output_domainset" not in src:
            continue
        
        name = src["name"]
        input_path = os.path.join(ROOT_DIR, src["output"])
        output_path = os.path.join(ROOT_DIR, src["output_domainset"])
        
        print(f"\n🔄 转换: {name}")
        
        # 检查输入文件是否存在
        if not os.path.exists(input_path):
            print(f"   ⚠️ 跳过：输入文件不存在 {input_path}")
            continue
        
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
            print(f"   ✅ 已更新: {len(domains)} 条规则 -> {src['output_domainset']}")
            changed = True
        else:
            print(f"   ✔ 无变化: {len(domains)} 条规则")
    
    # 更新 .changed 标记
    if changed:
        with open(changed_file, 'w') as f:
            f.write('1')
        print("\n📝 标记：有规则更新")
    else:
        # 如果 .changed 文件不存在或 sync.py 已标记，保持原有状态
        if not os.path.exists(changed_file):
            with open(changed_file, 'w') as f:
                f.write('0')

if __name__ == "__main__":
    main()
