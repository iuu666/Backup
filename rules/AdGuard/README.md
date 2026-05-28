# 🛡️ AdGuard 规则

> 每天自动更新 · Surge 专用

## 📦 规则列表

| 文件 | 说明 |
|------|------|
| **base-filter.txt** | 基础广告过滤 |
| **tracking-protection.txt** | 隐私追踪保护 |
| **chinese-filter.txt** | 中文网站专用 |
| **social-media.txt** | 社交媒体屏蔽 |
| **dns-filter.txt** | 恶意域名屏蔽 |
| **annoyances.txt** | 烦人元素合集（包含以下 5 个子项） |

<details>
<summary>📎 烦人元素子项（点击展开）</summary>

- annoyances-cookie-notices.txt — Cookie 通知屏蔽
- annoyances-popups.txt — 弹窗屏蔽
- annoyances-mobile-app-banners.txt — 移动端横幅屏蔽
- annoyances-widgets.txt — 网页挂件屏蔽
- annoyances-other.txt — 其他烦人元素

</details>

## 🔧 Surge 配置

```text
# 核心必选
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT

# 可选增强
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT

# 烦人元素（二选一）
# 方式一：使用合集
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT

# 方式二：单独使用子项
# DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-cookie-notices.txt,REJECT
# DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-popups.txt,REJECT
# DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-mobile-app-banners.txt,REJECT
# DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-widgets.txt,REJECT
# DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-other.txt,REJECT
```
## 📊 规则数量趋势

| 规则文件 | 7天前 | 昨天 | 今天 | 趋势 |
|---------|-------|------|------|------|
| base-filter.txt | - | - | 64,041 | - |

## 📌 说明

- 规则文件每天北京时间 08:30 自动更新
- 来源：[AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry)
- 转换工具：Python + [AdGuard Hostlist Compiler](https://github.com/AdguardTeam/HostlistCompiler)