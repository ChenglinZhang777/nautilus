---
name: fetch-config
description: >
  从 Obsidian vault 读取项目配置（环境变量、服务凭证），合并后写入 .env 文件。
  当需要初始化项目环境变量、同步 Obsidian 配置到本地、检查缺失凭证时使用。
user-invocable: true
disable-model-invocation: true
allowed-tools: mcp__obsidian__read_note, mcp__obsidian__search_notes, mcp__obsidian__get_frontmatter, Bash, Read, Write, Edit
argument-hint: "[project] [--dry-run] [--env-file=.env]"
replaces: _bmad/config/scripts/obsidian-config-reader.ts
---

# /fetch-config

从 Obsidian vault 读取项目配置，合并后写入当前目录的 `.env` 文件。

## 使用方式

```
/fetch-config [project] [--dry-run] [--env-file=.env]
```

**参数**：
- `project`：项目名称（默认 `nautilus`），对应 `configs/projects/{project}.md`
- `--dry-run`：仅预览，不实际写入
- `--env-file`：指定 .env 文件路径（默认当前目录 `.env`）

---

## 执行指令

当用户运行 `/fetch-config $ARGUMENTS` 时，按以下步骤执行。

### Step 1：解析参数

从 `$ARGUMENTS` 中提取：
- `projectName`：第一个非 `--` 参数，默认 `nautilus`
- `dryRun`：是否包含 `--dry-run`
- `envFilePath`：`--env-file=` 的值，默认 `.env`

### Step 2：读取项目配置

使用 `mcp__obsidian__read_note` 读取笔记：

```
path: configs/projects/{projectName}.md
```

从笔记内容中提取两类信息：

**A) 环境变量表格**：

查找含「变量名」/「ENV」/「Variable」表头的 Markdown 表格，逐行解析：
- 格式：`| \`VAR_NAME\` | value | 说明 | ... |`
- 变量名判定：去掉反引号后匹配 `^[A-Z][A-Z0-9_]*$`
- 有值 → 加入 `resolved`；无值 → 加入 `missing`

**B) 关联服务**：

用正则 `\[\[services\/([^\]]+)\]\]` 提取所有 Obsidian wiki-link，得到关联服务名列表。

### Step 3：读取服务配置

对 Step 2 提取的每个服务名，使用 `mcp__obsidian__read_note` 读取：

```
path: configs/services/{serviceName}.md
```

对每个服务笔记：

1. 使用 `mcp__obsidian__get_frontmatter` 提取元数据，关注：
   - `can_auto_fetch`（boolean）：是否支持自动获取
   - `auth_type`（string）：认证方式

2. 解析 Markdown 表格（同 Step 2A 规则）

3. 合并到 `resolved` / `missing`（项目级变量优先，已有同名 key 不覆盖）

4. 若变量无值且 `can_auto_fetch=true`，标记为"可自动获取"

### Step 4：输出配置摘要

```
📋 配置摘要 [项目: {projectName}]
   已配置: N 个变量
   缺失: M 个变量

已配置变量：
  ✅ ANTHROPIC_API_KEY = sk-ant-****（来源: services/anthropic）
  ✅ GITHUB_TOKEN = ghp_****（来源: projects/nautilus）

缺失变量：
  ❌ OPENAI_API_KEY（来源: services/openai，可自动获取 → /fetch-api-key openai）
  ❌ STRIPE_KEY（来源: services/stripe，需手动填写）
```

敏感值掩码规则：显示前 8 字符 + `****`

### Step 5：写入 .env

若非 `--dry-run`：

1. 使用 Read 工具读取现有 `.env` 文件（若存在），解析已有 key
2. 对 `resolved` 中每个变量：已存在的 key **不覆盖**（增量写入）
3. 使用 Edit 或 Write 工具写入 `.env`

输出写入结果：
```
✅ 写入 .env：新增 N 个，跳过已有 M 个
```

### Step 6：提示后续操作

若有缺失变量：

```
⚠️  有 M 个变量未配置：
  - OPENAI_API_KEY：可运行 /fetch-api-key openai 自动获取
  - STRIPE_KEY：请在 Obsidian configs/services/stripe.md 中填写后重新运行

提示：所有变量就绪后可再运行 /fetch-config {projectName} 验证
```

---

## 注意事项

- 此 Skill 依赖 **Obsidian MCP Server**，执行前确认 MCP 已连接（可用 `mcp__obsidian__get_vault_stats` 验证）
- 所有 Obsidian 读写通过 MCP 工具完成，不直接访问文件系统
- 敏感信息写入 .env 后不显示完整值
- 若 Obsidian MCP 不可用，提示用户检查 MCP 配置
