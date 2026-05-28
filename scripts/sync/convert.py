# ==================== 推荐必选（核心） ====================
# 基础广告过滤
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/base-filter.txt,REJECT

# 隐私追踪保护
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/tracking-protection.txt,REJECT

# ==================== 可选增强 ====================
# 中文网站专用
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/chinese-filter.txt,REJECT

# 社交媒体组件屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/social-media.txt,REJECT

# DNS 恶意域名屏蔽
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/dns-filter.txt,REJECT

# ==================== 烦人元素屏蔽 ====================
# 方式一：使用合集（包含以下 5 个子项，推荐）
RULE-SET,https://raw.githubusercontent.com/iuu666/Backup/main/rules/AdGuard/annoyances.txt,REJECT

# 方式二：单独使用子项（按需选择）

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
