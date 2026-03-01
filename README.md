# Nautilus

基于 Claude Code 的螺旋迭代 AI Agent 协作开发框架。

将 Sprint 规划、并行实现、多维 QA 审查、进化记忆封装为可安装工具，在任意项目目录一键启用。

> 鹦鹉螺（Nautilus）：自然界最完美的对数螺旋，每个腔室保留历史、向外生长 —— 如同每轮 Sprint 积累的 evolution log。

## 快速安装

在你的项目根目录执行：

```bash
curl -fsSL https://raw.githubusercontent.com/ChenglinZhang777/nautilus/main/scripts/install.sh | bash
```

脚本会自动推断配置（项目名 = 当前目录名，用户名 = git config，语言 = 中文），确认后安装。

安装完成后，在当前目录打开 Claude Code：

```bash
claude
```

如需覆盖默认值，可通过环境变量指定（均为可选）：

```bash
LANGUAGE=English bash <(curl -fsSL https://raw.githubusercontent.com/ChenglinZhang777/nautilus/main/scripts/install.sh)
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PROJECT_NAME` | 项目名称 | 当前目录名 |
| `USER_NAME` | 用户名 | `git config user.name` |
| `LANGUAGE` | `Chinese` / `English` | `Chinese` |

## 安装内容

```
your-project/
  _bmad/            ← Agent personas、workflows、执行引擎
  .claude/
    commands/       ← 32 个 slash commands（/run、/bmad-* 全套）
  CLAUDE.md         ← Claude Code 操作规则（自动加载）
  docs/             ← 项目知识库（可随时添加文档）
  .gitignore
```

## 三种工作模式

| 模式 | 适用场景 | 说明 |
|------|---------|------|
| **Solo Mode** | 改动 < 半天，边界清晰 | 单会话直接执行，快速迭代 |
| **Sprint Mode** | 1-3 个 Feature | 规划 → 并行实现 → 多维 QA → 进化蒸馏 |
| **Parallel Sprint** | 3+ 个并行 Feature | Sprint Mode 扩展，多 Feature 并发 |

## 内置 Agent 团队

- **sm** — Scrum Master：Sprint 规划、Story 拆分
- **pm** — Product Manager：PRD 制定、需求澄清
- **architect** — 系统架构师：技术选型、架构设计
- **analyst** — 业务分析师：市场/技术研究
- **dev-frontend / dev-backend / dev-devops** — 开发者：Story 实现（TDD）
- **qa-security / qa-perf / qa-e2e / qa-coverage** — QA 工程师：多维审查
- **tech-writer** — 技术文档：进化日志蒸馏

## 框架更新

重新运行安装脚本即可，无需任何参数——脚本会自动从已有配置中读取项目名、用户名和语言：

```bash
curl -fsSL https://raw.githubusercontent.com/ChenglinZhang777/nautilus/main/scripts/install.sh | bash
```

更新内容：`_bmad/` 覆盖更新，`CLAUDE.md` 备份为 `.bak`，`.claude/commands/` 同步更新。

## .gitignore 规则

安装时自动添加：

```gitignore
# Nautilus runtime data
_bmad/_memory/
_bmad-output/
.env
```

如果想将规划产物（PRD、架构文档）纳入版本：

```gitignore
_bmad/_memory/
_bmad-output/sprint-*/
```

## 本地安装

```bash
git clone https://github.com/ChenglinZhang777/nautilus
cd your-project
bash /path/to/nautilus/scripts/install.sh
```
