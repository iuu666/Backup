# AdGuard 规则说明

> 本目录下的规则文件由 GitHub Actions 自动生成，请勿手动修改。

## 规则来源

- 原始规则：[AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry)

- 转换工具：自定义 Python 脚本 + [AdGuard Hostlist Compiler](https://github.com/AdguardTeam/HostlistCompiler)


## 规则列表

| 文件名 | 作用 | 规则来源 | 更新时间 |
|--------|------|----------|----------|
| base-filter.txt | AdGuard 基础广告过滤 | AdGuard | 2026-05-28 16:50:13 |
| chinese-filter.txt | AdGuard 中文网站专用 | AdGuard | 2026-05-28 16:50:05 |
| tracking-protection.txt | AdGuard 隐私追踪保护 | AdGuard | 2026-05-28 16:50:09 |
| annoyances.txt | AdGuard 烦人元素（合集） | AdGuard | 2026-05-28 16:50:06 |
| annoyances-cookie-notices.txt | AdGuard Cookie 通知屏蔽 | AdGuard | 2026-05-28 16:50:07 |
| annoyances-popups.txt | AdGuard 弹窗屏蔽 | AdGuard | 未知 |
| annoyances-mobile-app-banners.txt | AdGuard 移动端 App 横幅屏蔽 | AdGuard | 未知 |
| annoyances-widgets.txt | AdGuard 网页挂件屏蔽 | AdGuard | 未知 |
| annoyances-other.txt | AdGuard 其他烦人元素屏蔽 | AdGuard | 未知 |
| social-media.txt | AdGuard 社交媒体组件屏蔽 | AdGuard | 未知 |
| dns-filter.txt | AdGuard DNS 恶意域名屏蔽 | AdGuard | 2026-05-28 16:50:14 |

## Surge 使用说明

在 Surge 配置文件中添加以下规则（按需选择）：

### 核心必选

```text
# 基础广告过滤
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT

# 隐私追踪保护
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT
```

### 可选增强

```text
# 中文网站专用
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT

# 社交媒体组件屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT

# DNS 恶意域名屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT
```

### 烦人元素屏蔽

#### 方式一：使用合集（包含以下 5 个子项，推荐）

```text
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT
```

#### 方式二：单独使用子项（按需选择）

```text
# 1. Cookie 通知屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-cookie-notices.txt,REJECT

# 2. 弹窗屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-popups.txt,REJECT

# 3. 移动端 App 横幅屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-mobile-app-banners.txt,REJECT

# 4. 网页挂件屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-widgets.txt,REJECT

# 5. 其他烦人元素屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-other.txt,REJECT
```