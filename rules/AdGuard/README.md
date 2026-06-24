# AdGuard 规则

> 最后更新：2026-06-24 12:48:51

## 规则列表

| 文件名 | 作用 | 7天前 | 昨天 | 今天 | 趋势 |
|--------|------|-------|------|------|------|
| base-filter | 基础广告过滤 | 55,945 | 57,092 | 57,370 | 📈 +0.5% |
| tracking-protection | 隐私追踪保护 | 84,650 | 84,664 | 84,668 | 📈 +0.0% |
| chinese-filter | 中文网站广告过滤 | 6,484 | 6,551 | 6,563 | 📈 +0.2% |
| social-media | 社交媒体组件屏蔽 | 49 | 49 | 49 | ➡️ 持平 |
| dns-filter | DNS 层广告拦截 | 156,162 | 157,406 | 157,706 | 📈 +0.2% |
| annoyances | 烦人元素合集（包含以下子项） | 863 | 864 | 864 | ➡️ 持平 |
| annoyances-cookie-notices | &nbsp;&nbsp;&nbsp;├─ Cookie 通知屏蔽 | 181 | 181 | 181 | ➡️ 持平 |
| annoyances-popups | &nbsp;&nbsp;&nbsp;├─ 弹窗屏蔽 | 419 | 419 | 419 | ➡️ 持平 |
| annoyances-mobile-app-banners | &nbsp;&nbsp;&nbsp;├─ 移动端横幅屏蔽 | 3 | 3 | 3 | ➡️ 持平 |
| annoyances-widgets | &nbsp;&nbsp;&nbsp;├─ 网页挂件屏蔽 | 248 | 249 | 249 | ➡️ 持平 |
| annoyances-other | &nbsp;&nbsp;&nbsp;└─ 其他烦人元素 | 16 | 16 | 16 | ➡️ 持平 |

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
# 中文网站广告过滤
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT

# 社交媒体组件屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT

# DNS 层广告拦截
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT
```

### 烦人元素屏蔽

#### 方式一：使用合集（推荐）

```text
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT
```

#### 方式二：单独使用子项

```text
# Cookie 通知屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-cookie-notices.txt,REJECT

# 弹窗屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-popups.txt,REJECT

# 移动端横幅屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-mobile-app-banners.txt,REJECT

# 网页挂件屏蔽
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-widgets.txt,REJECT

# 其他烦人元素
DOMAIN-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances-other.txt,REJECT
```

---

## 规则来源

- 原始规则：[AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry)
- 转换工具：Python + [AdGuard Hostlist Compiler](https://github.com/AdguardTeam/HostlistCompiler)