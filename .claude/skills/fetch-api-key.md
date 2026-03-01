---
name: fetch-api-key
description: >
  通过 agent-browser 浏览器自动化，登录第三方服务（Anthropic/OpenAI/GitHub）创建 API Key，
  结果写回 Obsidian 和 .env。当缺少 API Key 或 Token 需要自动获取时使用。
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash(agent-browser *), mcp__obsidian__read_note, mcp__obsidian__patch_note, mcp__obsidian__update_frontmatter, Read, Edit, Write
argument-hint: "<service> [--env-file=.env] [--prefix=bmad]"
requires: agent-browser
replaces: _bmad/config/scripts/run-fetcher.ts, _bmad/config/scripts/fetchers/
---

# /fetch-api-key

通过 agent-browser 浏览器自动化登录第三方服务，创建 API Key 并写回 Obsidian + `.env`。

## 使用方式

```
/fetch-api-key <service> [--env-file=.env] [--prefix=bmad]
```

**支持的 service**：`anthropic` | `openai` | `github`

**参数**：
- `service`（必填）：目标服务名称
- `--env-file`：写入的 .env 文件路径（默认 `.env`）
- `--prefix`：创建的 Key 名称前缀（默认 `bmad`）

---

## 前置检查

执行前按顺序检查：

1. **解析参数**：从 `$ARGUMENTS` 提取 `service`、`envFilePath`、`prefix`
2. **验证 service**：必须是 `anthropic`/`openai`/`github` 之一，否则报错退出
3. **检查 agent-browser**：
   ```bash
   agent-browser --version
   ```
   若未安装，输出并停止：
   ```
   需要安装 agent-browser：
     npm install -g agent-browser
     agent-browser install
   ```

---

## 通用执行流程

所有服务共用以下框架，具体差异见各服务章节。

```
session_file = ~/.config/bmad-fetcher/{service}-state.json
key_name = {prefix}-{timestamp}
```

### 1. 加载持久化 Session

```bash
# 若存在已保存的 session，加载它（复用登录 cookie）
test -f {session_file} && agent-browser state load {session_file}
```

### 2. 导航到目标页面并检测登录态

```bash
agent-browser open {service_url}
agent-browser wait --load networkidle
agent-browser snapshot -i
```

分析 snapshot 输出：
- 当前 URL 匹配已登录特征 → 跳到步骤 4
- 当前 URL 跳转到登录页 → 进入步骤 3

### 3. 等待用户手动登录

输出提示：
```
🌐 浏览器已打开登录页面，请手动完成以下操作：
   1. 在浏览器窗口中登录 {service_name}
   2. 完成后告知我继续

⏳ 等待登录完成...
```

使用 AskUserQuestion 等待用户确认，确认后重新快照验证登录态：
```bash
agent-browser snapshot -i
```

登录成功后保存 session：
```bash
mkdir -p ~/.config/bmad-fetcher && agent-browser state save {session_file}
```

### 4. 创建 Key（各服务步骤见下方）

**关键模式**：每次页面导航或交互后必须重新快照以获取新的元素引用。

```bash
# 模式：快照 → 识别元素 → 交互 → 重新快照
agent-browser snapshot -i          # 获取 @e1, @e2, ... 引用
agent-browser click @eN            # 用引用点击
agent-browser fill @eM "text"      # 用引用填充（自动清空已有内容）
agent-browser snapshot -i          # 交互后重新获取引用
```

### 5. 提取 Key 值

从最终 snapshot 的 accessibility tree 中提取 Key 值：
- 查找 `input` 元素的 value 属性
- 查找 `code` / `pre` 元素的文本内容
- 用正则匹配服务特定前缀（见各服务章节）

### 6. 写回 Obsidian

使用 `mcp__obsidian__patch_note` 更新 `configs/services/{service}.md`：

```
path: configs/services/{service}.md
oldString: | `{VAR_NAME}` |  |       ← 匹配空值单元格
newString: | `{VAR_NAME}` | {value} |
```

使用 `mcp__obsidian__update_frontmatter` 更新 `last_updated`：
```
path: configs/services/{service}.md
frontmatter: { last_updated: "YYYY-MM-DD" }
```

### 7. 写入 .env

增量写入，已有 key 不覆盖。使用 Read + Edit 工具操作 `.env` 文件。

### 8. 输出确认

```
✅ {SERVICE_NAME} API Key 已获取
   变量: {VAR_NAME} = {value[:8]}****
   写入: .env + Obsidian configs/services/{service}.md
```

### 9. 保存 Session 并关闭

```bash
agent-browser state save {session_file}
agent-browser close
```

---

## 服务特定步骤

### Anthropic

| 项目 | 值 |
|------|-----|
| 登录 URL | `https://console.anthropic.com` |
| Keys 页面 | `https://console.anthropic.com/settings/keys` |
| 已登录特征 | URL 含 `/dashboard` 或 `/settings` 或 `/workbench` |
| 输出变量 | `ANTHROPIC_API_KEY` |
| Key 格式 | `sk-ant-\S+` |

**创建步骤**：

```bash
# 1. 导航到 Keys 页面
agent-browser open https://console.anthropic.com/settings/keys
agent-browser wait --load networkidle
agent-browser snapshot -i

# 2. 点击 "Create Key" 按钮
#    从 snapshot 中找到含 "Create Key" / "Create key" / "New key" 文本的 button
agent-browser click @eN    # N = Create Key 按钮的 ref

# 3. 等待弹窗，填写 key 名称
agent-browser snapshot -i
#    找到 name/key 相关的 input（textbox role）
agent-browser fill @eM "{key_name}"

# 4. 确认创建
#    找到确认按钮（"Create Key" / "Create"）
agent-browser click @eK

# 5. 等待 key 生成并显示
agent-browser wait --load networkidle
agent-browser snapshot -i

# 6. 从 snapshot 中提取：
#    - input value 匹配 sk-ant-\S+
#    - 或 code/pre 文本匹配 sk-ant-\S+
```

---

### OpenAI

| 项目 | 值 |
|------|-----|
| 登录 URL | `https://platform.openai.com/login` |
| Keys 页面 | `https://platform.openai.com/api-keys` |
| 已登录特征 | URL 不含 `/login` 且不含 `/auth` |
| 输出变量 | `OPENAI_API_KEY`，可选 `OPENAI_ORG_ID` |
| Key 格式 | `sk-\S+`（通常 `sk-proj-` 开头） |

**创建步骤**：

```bash
# 1. 导航到 API Keys 页面
agent-browser open https://platform.openai.com/api-keys
agent-browser wait --load networkidle
agent-browser snapshot -i

# 2. 点击 "Create new secret key" 按钮
agent-browser click @eN

# 3. 在 dialog 中填写名称
agent-browser snapshot -i
agent-browser fill @eM "{key_name}"

# 4. 确认创建
agent-browser click @eK

# 5. 等待 key 显示
agent-browser wait --load networkidle
agent-browser snapshot -i

# 6. 提取 key：匹配 sk-\S+ 模式
```

**可选获取 Org ID**：

```bash
agent-browser open https://platform.openai.com/settings/organization/general
agent-browser wait --load networkidle
agent-browser snapshot -i
# 提取 org-\S+ 模式
```

---

### GitHub

| 项目 | 值 |
|------|-----|
| 登录 URL | `https://github.com/login` |
| Token 页面 | `https://github.com/settings/tokens/new` |
| 已登录特征 | URL 不含 `/login` `/session` `/signup` |
| 输出变量 | `GITHUB_TOKEN`，可选 `GITHUB_USERNAME` |
| Token 格式 | `ghp_\S+` 或 `github_pat_\S+` |
| 默认权限 | `repo`, `workflow`, `read:org` |

> **GitHub 特殊情况处理**：
> - **Sudo 模式**：访问 token 页面时可能要求重新验证密码
> - **2FA 验证**：生成 token 时可能触发双因素认证
> 两种情况均需暂停，提示用户在浏览器中操作完成后再继续。

**创建步骤**：

```bash
# 1. 导航到 token 创建页
agent-browser open https://github.com/settings/tokens/new
agent-browser wait --load networkidle
agent-browser snapshot -i

# 2. 检查 sudo 模式
#    若 snapshot 中含密码输入框（name="sudo_login" 或 action 含 "sudo"），
#    提示用户：
#      🔐 GitHub 需要重新验证身份，请在浏览器中完成后告知我继续
#    等待用户确认后重新快照

# 3. 填写 token 名称（description 输入框）
agent-browser fill @eN "{key_name}"

# 4. 选择不过期（expiration select）
agent-browser select @eM "0"    # 0 = No expiration

# 5. 勾选权限 scopes
#    从 snapshot 中找到 repo / workflow / read:org 对应的 checkbox
agent-browser check @eA    # repo
agent-browser check @eB    # workflow
agent-browser check @eC    # read:org

# 6. 点击 "Generate token"
agent-browser click @eK

# 7. 检查 2FA
agent-browser snapshot -i
#    若含 OTP 输入框（one-time-code / app_otp），
#    提示用户：
#      🔐 GitHub 需要 2FA 验证，请在浏览器中完成后告知我继续
#    等待用户确认后重新快照

# 8. 读取生成的 token
agent-browser wait --load networkidle
agent-browser snapshot -i
#    提取 token：匹配 ghp_\S+ 或 github_pat_\S+ 模式
#    验证格式：必须以 ghp_ 或 github_pat_ 开头

# 9. 可选：提取用户名（从页面 data-login 属性）
```

---

## 安全提示

- 获取的 Key **仅写入本地** `.env` 文件和 Obsidian vault，不通过网络传输
- 浏览器 session 保存在 `~/.config/bmad-fetcher/`（本地持久化，复用登录状态）
- 定期清理旧 session：`rm -rf ~/.config/bmad-fetcher/{service}-state.json`
- 确保 `.env` 已在 `.gitignore` 中排除
- Key 值在所有输出中均掩码显示（前 8 位 + `****`）

---

## 与 fetch-config 配合使用

推荐工作流：

```
/fetch-config nautilus          # 1. 从 Obsidian 读取已有配置，查看缺失变量
/fetch-api-key anthropic        # 2. 自动获取缺失的 API Key
/fetch-api-key github           # 3. 依次处理各服务
/fetch-config nautilus          # 4. 再次验证所有变量已就绪
```
