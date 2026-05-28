# AdGuard 规则

> 每天自动更新

## 规则列表

| 文件名 | 作用 | 更新时间 |
|--------|------|----------|
| base-filter.txt | AdGuard 基础广告过滤 | 2026-05-29 00:06:00 |
| chinese-filter.txt | AdGuard 中文网站专用 | 2026-05-29 00:05:58 |
| tracking-protection.txt | AdGuard 隐私追踪保护 | 2026-05-29 00:06:01 |
| annoyances.txt | AdGuard 烦人元素（合集） | 2026-05-29 00:05:59 |
| annoyances-cookie-notices.txt | AdGuard Cookie 通知屏蔽 | 2026-05-29 00:05:59 |
| annoyances-popups.txt | AdGuard 弹窗屏蔽 | 2026-05-29 00:06:00 |
| annoyances-mobile-app-banners.txt | AdGuard 移动端 App 横幅屏蔽 | 2026-05-29 00:06:00 |
| annoyances-widgets.txt | AdGuard 网页挂件屏蔽 | 2026-05-29 00:06:00 |
| annoyances-other.txt | AdGuard 其他烦人元素屏蔽 | 2026-05-29 00:06:01 |
| social-media.txt | AdGuard 社交媒体组件屏蔽 | 2026-05-29 00:06:01 |
| dns-filter.txt | AdGuard DNS 恶意域名屏蔽 | 2026-05-29 00:06:02 |

## Surge 使用说明

在 Surge 配置文件中添加以下规则（按需选择）：

### 核心必选

```text
# 基础广告过滤
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT

# 隐私追踪保护
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT
```

### 可选增强

```text
# 中文网站专用
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT

# 社交媒体组件屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT

# DNS 恶意域名屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT
```

### 烦人元素屏蔽

#### 方式一：使用合集（包含以下 5 个子项，推荐）

```text
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT
```

#### 方式二：单独使用子项（按需选择）

```text
# 1. Cookie 通知屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-cookie-notices.txt,REJECT

# 2. 弹窗屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-popups.txt,REJECT

# 3. 移动端 App 横幅屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-mobile-app-banners.txt,REJECT

# 4. 网页挂件屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-widgets.txt,REJECT

# 5. 其他烦人元素屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-other.txt,REJECT
```

---

## 规则来源

> 最后更新：2026-05-29 00:06:02

- 原始规则：[AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry)
- 转换工具：Python + [AdGuard Hostlist Compiler](https://github.com/AdguardTeam/HostlistCompiler)