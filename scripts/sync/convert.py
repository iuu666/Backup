import os
import re
import json
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../"))

def convert_to_domainset(raw_content: str) -> list:
    """将 AdGuard 原始规则转换为 Surge DOMAIN-SET 格式"""
    domains = set()
    
    for line in raw_content.splitlines():
        line = line.strip()
        
        if not line or line.startswith('!') or line.startswith('#') or line.startswith('@@'):
            continue
        
        match = re.match(r'^\|\|([a-zA-Z0-9\-\.]+)\^', line)
        if match:
            domains.add(match.group(1))
    
    return sorted(domains)

def load_all_sources():
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
    changed_file = os.path.join(ROOT_DIR, ".changed_convert")
    
    for src in sources:
        if "output" not in src or "output_domainset" not in src:
            continue
        
        name = src["name"]
        input_path = os.path.join(ROOT_DIR, src["output"])
        output_path = os.path.join(ROOT_DIR, src["output_domainset"])
        
        print(f"\n🔄 转换: {name}")
        
        if not os.path.exists(input_path):
            print(f"   ⚠️ 跳过：输入文件不存在")
            continue
        
        with open(input_path, 'r', encoding='utf-8') as f:
            raw_content = f.read()
        
        domains = convert_to_domainset(raw_content)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        new_content = '\n'.join(domains)
        
        old_content = ""
        if os.path.exists(output_path):
            with open(output_path, 'r', encoding='utf-8') as f:
                old_content = f.read()
        
        if old_content != new_content:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"   ✅ 已更新: {len(domains)} 条规则")
            changed = True
        else:
            print(f"   ✔ 无变化: {len(domains)} 条规则")
        
        # 删除原始文件
        os.remove(input_path)
        print(f"   🗑️ 已删除: {src['output']}")
    
    with open(changed_file, "w") as f:
        f.write("1" if changed else "0")
    
    print(f"\n=== RESULT ===\n{'🚀 Changes detected' if changed else '😴 No changes'}")

if __name__ == "__main__":
    main()
