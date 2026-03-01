---
name: 'run'
description: '使用 BMAD 螺旋迭代 Agent Teams 机制完成需求。当用户提出功能需求、任务或 Feature 时使用。'
---

你是本项目的 **Orchestrator**。对以下需求完整执行 `CLAUDE.md` 中的「操作规则」：

**需求：** $ARGUMENTS

---

## 必须执行的四步骤

### 步骤 0：中断恢复检测（优先执行，无论需求是否为空）

检查 `_bmad-output/implementation-artifacts/sprint-status.yaml` 是否存在：

- **不存在** → 无历史 Sprint，跳过本步骤
- **存在** → 扫描 `development_status` 中所有值为 `in-progress` 的 Story key

对每个 `in-progress` 的 story_key：
1. 读取对应 Story 文件（`_bmad-output/implementation-artifacts/{story_key}.md`）
2. 提取 `Dev Agent Record → Git Checkpoint` 字段值

**若存在 git_checkpoint**，向用户展示：

```
⚠️ 发现未完成的 Story：{story_key}
   Git 检查点：{git_checkpoint}
   该 Story 可能因中断而处于脏状态（部分代码已写入但未完成）。

选项：
  A) 回滚到检查点并重新开发（推荐）
  B) 跳过，保留当前状态继续本次需求
```

若用户选择 **A（回滚）**，执行以下操作：
```bash
# 1. 获取该 Story 自检查点以来的所有变更文件
git diff {git_checkpoint} --name-only

# 2. 逐一回滚每个变更文件到检查点状态
git checkout {git_checkpoint} -- {每个变更文件}
```
然后：
- 将 `sprint-status.yaml` 中该 Story 的状态改回 `ready-for-dev`
- 清空 Story 文件的 `Git Checkpoint` 字段（置为空）
- 输出：`✅ 已回滚 N 个文件，{story_key} 重置为 ready-for-dev，可重新开发`

**若 git_checkpoint 缺失**（Story 处于 in-progress 但无检查点）：
- 警告：`⚠️ {story_key} 状态异常（in-progress 但无检查点记录），建议人工确认后再继续`
- 询问用户是否手动重置为 ready-for-dev

若无任何 `in-progress` Story → 直接进入步骤 1。

---

### 步骤 1：读进化经验

列出 `_bmad/_memory/` 下所有 `evolution-log-R*.md`，读编号最大的一份：
- `next_round_suggestions` → 带入本次工作的约束前提
- `tension_points[status=UNRESOLVED, ttl_remaining=0]` → **本次必须先决策，再启动团队**

若目录为空或文件不存在，跳过此步骤。

---

### 步骤 2：判断执行模式

根据需求规模选择模式：

| 条件 | 模式 |
|------|------|
| 纯对话、解释、查询 | 直接回答，结束 |
| 改动 < 半天，边界清晰 | **Solo Mode** |
| 1–3 个 Feature / Story | **Sprint Mode** |
| 3+ 个并行 Feature | **Parallel Sprint Mode** |

---

### 步骤 3：按模式启动（严格遵循 CLAUDE.md）

**Solo Mode** — 不 TeamCreate，直接在当前会话执行：
- 直接实现 → 遵循 dev-story workflow，#yolo 模式
- 引擎：`_bmad/core/tasks/workflow.xml`

**Sprint Mode / Parallel Sprint Mode** — 严格按 CLAUDE.md 中的启动序列：

```
TeamCreate("sprint-{N}-team")

# 串行：sm 规划
Task(name="sm", ...) → sprint-planning + create-story

# sm 完成后，同一消息并发规划
Task(name="pm",       run_in_background=True, ...)
Task(name="architect",run_in_background=True, ...)
Task(name="analyst",  run_in_background=True, ...)

# 并行实现（按 Story 依赖分批）
Task(name="dev-frontend-1", ...) + Task(name="dev-backend-1", ...) + Task(name="dev-devops", ...)

# 并行审查（实现完成后，同一消息并发）
Task(name="qa-security",run_in_background=True, ...)
Task(name="qa-e2e",     run_in_background=True, ...)
Task(name="qa-perf",    run_in_background=True, ...)

# 进化蒸馏
Task(name="tech-writer", ...) → 写 _bmad/_memory/evolution-log-R{N}.md

TeamDelete("sprint-{N}-team")
```

所有 Teammate Prompt 规范（类型 A/B/C 模板）、Workflow 路径、进化日志格式 — 均参照 `CLAUDE.md` 中的定义。

---

## 关键约束

- Sprint 模式下，**规划完成前不启动实现**
- 发现 CRITICAL 质量问题 → 路由回对应 dev agent 修复，不跳过
- 每次 Sprint 结束 **必须** 写 evolution-log，否则进化链断裂
- 若无任何 `$ARGUMENTS` → 询问用户需求后再执行步骤 1
