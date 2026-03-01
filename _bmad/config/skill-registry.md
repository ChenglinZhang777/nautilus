# Skill Registry

Nautilus 项目 Skill 索引。Agent 在执行任务前应查阅此文件，优先复用已有 Skill。

---

## 项目内 Skill（`.claude/skills/`）

| Skill 名称 | 文件 | 用途 | 依赖 | 调用示例 |
|------------|------|------|------|----------|
| `fetch-config` | `.claude/skills/fetch-config.md` | 从 Obsidian vault 读取项目配置，写入 `.env` | Obsidian MCP | `/fetch-config nautilus` |
| `fetch-api-key` | `.claude/skills/fetch-api-key.md` | 浏览器自动化登录第三方服务（Anthropic/OpenAI/GitHub）创建 API Key，写回 Obsidian + `.env` | agent-browser | `/fetch-api-key anthropic` |
| `evolution-analyzer` | `.claude/skills/evolution-analyzer.md` | 自动扫描 Sprint 产物，提取阻塞事件/QA 信号/张力点，生成 evolution-log 草稿 | — | `/evolution-analyzer sprint-1` |

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

## 推荐外部 Skill（Claude Code 原生）

以下均为 Claude Code 生态的 Skill，可直接下载 `.md` 文件放入 `.claude/skills/` 使用。

### 开发流程类

| Skill 名称 | 来源仓库 | 用途 | 与 Nautilus 的关联 |
|------------|---------|------|-------------------|
| `retrospective` | [glebis/claude-skills](https://github.com/glebis/claude-skills) | 每个 Session 结束前捕获学习、更新 Skill 知识库，"上下文丢失前留存经验" | 可辅助 tech-writer 在 Sprint 结束时结构化收集经验 |
| `insight-extractor` | [glebis/claude-skills](https://github.com/glebis/claude-skills) | 解析 Claude Code 的 `/insights` 报告，提取行动项/学习/工作流改进/工具发现/自动化候选 6 类结构化输出 | 可将 Sprint 产物（QA 报告、blocking-log）转化为 evolution-log 素材 |
| `tdd` | [glebis/claude-skills](https://github.com/glebis/claude-skills) | 多 Agent TDD 编排，跨测试编写/实现/重构阶段强制上下文隔离 | 补强 dev-story workflow 中的 TDD 实践 |
| `webapp-testing` | [Anthropic 官方](https://github.com/anthropics/claude-code-skills) | 使用 Playwright 进行 UI 测试自动化 | qa-e2e 备选方案（不依赖 agent-browser） |
| `skill-creator` | [Anthropic 官方](https://github.com/anthropics/claude-code-skills) | 交互式问答方式创建新 Skill，自动生成规范 SKILL.md | 框架扩展时创建新 Skill 的辅助工具 |

### 工具依赖类（需先安装外部工具）

| Skill 名称 | 来源 | 用途 | 安装方式 |
|------------|------|------|---------|
| `agent-browser` | [00OO666/agent-browser-skill](https://github.com/00OO666/agent-browser-skill) | 浏览器自动化（导航/点击/填充/快照/session 持久化），Claude Code 原生设计，93% 减少上下文消耗 | `npm install -g agent-browser` → `agent-browser install` |

> **安全提示**：安装任何外部 Skill 前，请先审查源码。`agent-browser` 已经过验证，是 Claude Code 官方生态的一部分。

---

## ⚠️ 关于 clawhub.ai 的说明

**clawhub.ai 是 [OpenClaw](https://github.com/openclaw/openclaw) 的 Skill 仓库，与 Claude Code 是不同生态，不直接兼容。**

| 维度 | clawhub.ai（OpenClaw） | Claude Code Skills |
|------|----------------------|-------------------|
| Skill 格式 | SKILL.md + OpenClaw 配置 | `.md` 文件 in `.claude/skills/` |
| 运行环境 | OpenClaw Agent | Claude Code |
| 安装方式 | `clawhub search` CLI | 直接复制 `.md` 文件 |
| 直接兼容 | ❌ | — |

**不要将 clawhub.ai 上的 Skill 直接安装到 `.claude/skills/`**，它们无法在 Claude Code 中运行。如需参考其中的概念或逻辑（如 Capability Evolver 的 GEP 协议），需要重新适配为 Claude Code Skill 格式。

---

## 注册新 Skill

新增 Skill 时按以下步骤操作：

1. 将 `.md` 文件放入 `.claude/skills/` 目录
2. 在上方「项目内 Skill」表格中添加一行
3. 若 Story 依赖该 Skill，在 Story 的 `required_skills:` 中声明
