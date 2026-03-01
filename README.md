# Nautilus

基于 Claude Code 的螺旋迭代 AI Agent 协作开发框架。

将需求澄清、Sprint 规划、并行实现、多维 QA 审查、进化记忆封装为可安装工具，在任意项目目录一键启用。

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
    commands/       ← slash commands（/run、/bmad-* 全套）
    skills/         ← 项目内 Skill（evolution-analyzer、fetch-config 等）
  CLAUDE.md         ← Claude Code 操作规则（自动加载）
  docs/             ← 项目知识库（可随时添加文档）
  .gitignore
```

## 三种工作模式

| 模式 | 适用场景 | 说明 |
|------|---------|------|
| **Solo Mode** | 改动 < 半天，边界清晰 | 单会话直接执行，快速迭代 |
| **Sprint Mode** | 1-3 个 Feature | 澄清 → 三批次规划 → 并行实现 → 多维 QA → 进化蒸馏 |
| **Parallel Sprint** | 3+ 个并行 Feature | Sprint Mode 扩展，多 Feature 并发 |

## Sprint 核心流程

```
阶段 0：中断恢复检测（自动检测上次未完成的 Story 或 Sprint 阶段）
阶段 1：需求澄清（与用户确认边界，生成 clarification-record.md）
阶段 2：三批次规划协商
  Batch A — PM / Analyst / Architect 并行独立分析
  Batch B — 三方交叉评审，暴露张力点与盲区
  Batch C — SM 综合决策，输出 Story 列表
阶段 3：并行 Story 实现（按依赖分批，TDD）
阶段 4：并行多维 QA 审查（Security / E2E / Performance）
阶段 5：进化蒸馏（自动扫描 → tech-writer 定稿 evolution-log）
```

### 三批次规划

相比单次规划，三批次机制消除了多角色协作中的信息屏蔽和从众偏差：

- **Batch A**：PM / Analyst / Architect 同时独立分析，互不干扰
- **Batch B**：三方交叉阅读对方视角，标注张力点（RESOLVED / UNRESOLVED）
- **Batch C**：SM 在信息充分后综合决策，Story 分解携带多维约束

### 进化记忆

每轮 Sprint 结束后，evolution-log 蒸馏以下内容并写入 `_bmad/_memory/`：

- `next_round_suggestions`：带入下轮 Sprint 的约束前提
- `tension_points`：跨轮持续施压的未解决张力点（带 TTL，归零时强制决策）
- `blocking_log` / QA 信号：阻塞原因与审查发现

下轮 Sprint 启动时自动读入，形成"有记忆的 Agent 团队"。

### 断点续跑

任意阶段崩溃后重新执行 `/run`，框架自动检测并提供：

- **Story 级别**：读取 Git Checkpoint，回滚部分写入的代码到安全状态
- **Sprint 阶段级别**：读取 `checkpoint.yaml`，从中断阶段接续（幂等跳过已完成阶段）

## 内置 Agent 团队

| Agent | 角色 | 主要职责 |
|-------|------|---------|
| **sm** | Scrum Master | Sprint 规划、Story 分解、团队协调 |
| **pm** | Product Manager | 需求澄清、PRD 制定、用户价值分析 |
| **architect** | 系统架构师 | 技术选型、架构设计、风险评估 |
| **analyst** | 业务分析师 | 市场/技术研究、竞品分析 |
| **dev-frontend** | 前端开发 | Story 实现（TDD） |
| **dev-backend** | 后端开发 | Story 实现（TDD） |
| **dev-devops** | DevOps | 基础设施、CI/CD |
| **qa-security** | 安全工程师 | 安全审查、漏洞发现 |
| **qa-e2e** | E2E 测试工程师 | 关键流程端到端验证 |
| **qa-perf** | 性能工程师 | 性能分析与优化建议 |
| **qa-coverage** | 覆盖率工程师 | 测试覆盖率分析 |
| **tech-writer** | 技术文档 | 进化日志蒸馏与定稿 |

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
