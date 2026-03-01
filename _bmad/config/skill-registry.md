# Skill Registry

Nautilus 项目 Skill 索引。Agent 在执行任务前应查阅此文件，优先复用已有 Skill。

---

## 项目内 Skill（`.claude/skills/`）

| Skill 名称 | 文件 | 用途 | 依赖 | 调用示例 |
|------------|------|------|------|----------|
| `fetch-config` | `.claude/skills/fetch-config.md` | 从 Obsidian vault 读取项目配置，写入 `.env` | Obsidian MCP | `/fetch-config nautilus` |
| `fetch-api-key` | `.claude/skills/fetch-api-key.md` | 浏览器自动化登录第三方服务（Anthropic/OpenAI/GitHub）创建 API Key，写回 Obsidian + `.env` | agent-browser | `/fetch-api-key anthropic` |

> 当项目内新增 Skill 时，在此表格中注册。

---

## 框架内置 Slash Commands

以下是 Nautilus 框架通过 `.claude/commands/` 提供的命令，功能上等同于 Skill：

| 命令 | 用途 |
|------|------|
| `/run` | 统一入口（自动判断模式并启动团队） |
| `/bmad-bmm-dev-story` | 执行 Story 实现 |
| `/bmad-bmm-create-story` | 创建 Story 文件 |
| `/bmad-bmm-code-review` | 代码审查 |
| `/bmad-bmm-sprint-planning` | Sprint 规划 |
| `/bmad-bmm-quick-spec` | Solo 快速规格 |
| `/bmad-bmm-quick-dev` | Solo 快速实现 |
| `/bmad-bmm-retrospective` | Sprint 回顾 |

---

## 推荐外部 Skill

可通过社区获取的高质量 Skill，按需安装到 `.claude/skills/`：

| Skill 名称 | 来源 | 用途 | 下载量 | 安装方式 |
|------------|------|------|--------|----------|
| agent-browser | clawhub.ai | 浏览器自动化（导航/点击/填充/快照/session 持久化），可替代自定义 Playwright 脚本 | 11,836 (Top 7) | `npm install -g agent-browser` |
| github | clawhub.ai | PR 创建、代码审查、CI 监控、Issue 分流，增强 Git 工作流 | 10,611 (Top 9) | 下载 SKILL.md 至 `.claude/skills/` |
| summarize | clawhub.ai | 长文本摘要压缩，用于 Sprint 回顾/PRD 摘要 | 10,956 (Top 8) | 下载 SKILL.md 至 `.claude/skills/` |
| find-skills | clawhub.ai | Skill 发现和安装助手，帮助动态发现可用 Skill | 7,077 (Top 16) | 下载 SKILL.md 至 `.claude/skills/` |
| bitwarden | clawhub.ai | 通过 rbw CLI 安全操作 Bitwarden vault，比 .env 更安全的 API key 管理 | — | 下载 SKILL.md 至 `.claude/skills/` |
| agentkeys | clawhub.ai | AI Agent 安全凭证代理，统一密钥代理层 | — | 下载 SKILL.md 至 `.claude/skills/` |

> ⚠️ 使用 clawhub.ai Skill 前必须人工审查 SKILL.md 源码，约 7-11% 的 Skill 存在安全问题（凭证泄露、恶意代码）。建议仅使用高下载量、经过验证的 Skill。

---

## 注册新 Skill

新增 Skill 时按以下步骤操作：

1. 将 `.md` 文件放入 `.claude/skills/` 目录
2. 在上方「项目内 Skill」表格中添加一行
3. 若 Story 依赖该 Skill，在 Story 的 `required_skills:` 中声明
