---
name: evolution-analyzer
description: >
  自动扫描 Sprint 产物（Story 状态、阻塞日志、QA 报告、规划协商文件），
  提取关键信号，与历史 evolution-log 对比，生成结构化 evolution-log 草稿。
  在 tech-writer 蒸馏步骤前运行，替代手动数据收集工作。
user-invocable: true
argument-hint: "<sprint-N> [--mode=draft|final]"
allowed-tools: Read, Glob, Grep, Write, Edit
---

# /evolution-analyzer

自动分析 Sprint 产物并生成 evolution-log 草稿。

## 使用方式

```
/evolution-analyzer <sprint-N> [--mode=draft|final]
```

**参数：**
- `sprint-N`（必填）：Sprint 编号，如 `sprint-1`、`sprint-2`
- `--mode=draft`（默认）：输出草稿，路径为 `_bmad-output/sprint-{N}/evolution-draft.md`
- `--mode=final`：直接写入 `_bmad/_memory/evolution-log-R{N}.md`（跳过 tech-writer 审查）

---

## 执行步骤

### 步骤 0：解析参数

从 `$ARGUMENTS` 提取：
- `sprint_label`：如 `sprint-1`（用于定位 `_bmad-output/sprint-1/`）
- `round_n`：从 sprint_label 提取数字 N
- `mode`：`draft`（默认）或 `final`
- `output_path`：
  - draft → `_bmad-output/sprint-{N}/evolution-draft.md`
  - final → `_bmad/_memory/evolution-log-R{N}.md`

若无法解析 sprint_label，输出错误并停止：
```
❌ 参数错误：请指定 Sprint 编号，例如：/evolution-analyzer sprint-1
```

---

### 步骤 1：定位 Sprint 产物目录

检查以下路径是否存在：
- `_bmad-output/sprint-{N}/` — Sprint 过程产物根目录
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story 完成状态
- `_bmad-output/sprint-{N}/checkpoint.yaml` — Sprint 阶段记录（可选）

若 `sprint-{N}/` 目录不存在，输出警告：
```
⚠️ 未找到 _bmad-output/sprint-{N}/ 目录，将尝试仅读取 sprint-status.yaml 继续分析
```

---

### 步骤 2：读取历史 Evolution Log（TTL 传递）

查找最新的历史 evolution-log：
```
_bmad/_memory/evolution-log-R*.md
```

若找到（取轮次最大者）：
1. 读取文件
2. 提取 `tension_points` 列表，每条 TTL 递减 1：
   - `ttl_remaining` > 0 → 递减后写入新 log 的 `tension_points`，状态保持 `UNRESOLVED`
   - `ttl_remaining` = 0 → 标记为 `⚠️ TTL_EXPIRED`，必须在下轮 Sprint 前决策
3. 提取 `next_round_suggestions` 列表，记为 `prev_suggestions`（用于后续重叠检测）
4. 记录 `prev_round = N-1`

若不存在历史 log，`carried_tensions = []`，`prev_suggestions = []`。

---

### 步骤 3：提取 Story 完成状态

读取 `_bmad-output/implementation-artifacts/sprint-status.yaml`。

提取 `development_status` 字段中所有 Story 的状态：
```yaml
completed_stories: []   # status=done 的 Story
failed_stories: []      # status=failed 的 Story（若有）
```

统计：
- `story_count_total`
- `story_count_done`
- `story_count_partial`

---

### 步骤 4：提取阻塞日志

逐个读取已完成 Story 文件（`_bmad-output/implementation-artifacts/{story-key}.md`）。

在每个 Story 文件中搜索：
- `Dev Notes` 部分中的 `BLOCKED:` 关键词
- 格式：`BLOCKED: 等待 {agent} 提供 {信息}`

对每条 BLOCKED 记录，构建：
```yaml
- from: <story-key>        # 被阻塞方（用 Story key 标识）
  waiting_on: <agent>      # 依赖方
  issue: <issue-text>      # 阻塞内容
  root_cause: ""           # 待 tech-writer 填写
```

若无 BLOCKED 记录，`blocking_log = []`。

---

### 步骤 5：提取 QA 报告信号

查找 `_bmad-output/sprint-{N}/quality/` 目录下的所有 `-report.md` 文件。

对每个报告文件，提取：
- CRITICAL 问题数量和条目
- HIGH 问题数量和条目

构建 `qa_signals`：
```yaml
qa_signals:
  - dimension: security      # 来源文件名前缀
    critical: 2
    high: 3
    critical_items:
      - "SQL 注入漏洞于 /api/login"
```

若 `quality/` 目录不存在，`qa_signals = []`。

---

### 步骤 6：提取规划阶段张力点

读取 `_bmad-output/sprint-{N}/negotiation/` 目录下的以下文件（若存在）：
- `analyst-crossreview.md`
- `pm-crossreview.md`
- `architect-crossreview.md`

在每个文件中搜索 `UNRESOLVED` 关键词，提取其所在段落（前后各 3 行）。

构建 `new_tensions` 候选列表（去重）：
```yaml
- id: T-{auto_increment}
  description: <从 UNRESOLVED 上下文提取的张力描述>
  source: <来源文件（如 architect-crossreview）>
  status: UNRESOLVED
  ttl_remaining: 2   # 新张力点默认 TTL=2
```

---

### 步骤 7：生成 next_round_suggestions

基于以下信号自动推断改进建议：

| 信号 | 建议模板 |
|------|---------|
| `blocking_log` 有记录且 `waiting_on` 相同 agent 出现 ≥ 2 次 | "规划阶段提前锁定 {agent} 的 API 契约 / 输出格式" |
| QA CRITICAL > 0 | "在 Story 验收条件中加入 {dimension} 安全检查点" |
| `story_count_partial > 0` | "拆分过大 Story，建议单 Story 实现时间 < 2h" |
| 新 `tension_points` 数量 > 3 | "Batch B 交叉评审后增加 SM 早期仲裁环节" |
| `prev_suggestions` 重叠 > 50% | ⚠️ 停滞告警（见步骤 8） |

---

### 步骤 8：重叠检测与停滞告警

将步骤 7 生成的 `new_suggestions` 与 `prev_suggestions` 比较：
- 语义相似（关键词重叠 ≥ 50%）的建议视为"重复建议"
- 若重复比例 > 50%，设置 `stagnation_warning = true`

输出告警信息：
```
⚠️ 停滞告警：本轮建议与上轮重叠超过 50%
   重复建议：[列表]
   建议：在下轮 Sprint 启动前，对所有 TTL=0 张力点强制决策。
```

---

### 步骤 9：组装草稿

将所有提取的数据组装为 evolution-log 格式：

```markdown
---
# Evolution Log — Sprint {N}（自动分析草稿）
# ⚠️ 此草稿由 evolution-analyzer 自动生成，请 tech-writer 审查后确认或修正
# 生成时间：{current_datetime}
---

round: {N}
team_config: sprint-mode
teammate_count: {从 checkpoint.yaml 或默认 8}

completed_stories:
{completed_stories 列表}

blocking_log:
{blocking_log 列表，root_cause 字段标注 "# TODO: tech-writer 填写根因"}

tension_points:
{carried_tensions（TTL 递减后）+ new_tensions 合并去重}

qa_signals:
{qa_signals 列表}

next_round_suggestions:
{new_suggestions 列表}

{若 stagnation_warning}
stagnation_warning: true
stagnation_note: "本轮建议与上轮重叠 {overlap_pct}%，强制决策所有 TTL=0 张力点后再启动下轮团队"

next_team_config: sprint-mode   # tech-writer 可根据实际情况修改
```

---

### 步骤 10：写入文件

将草稿写入 `output_path`。

输出完成信息：

```
✅ evolution-log 草稿已生成
   路径：{output_path}
   统计：
     Stories：{done}/{total} 完成
     阻塞事件：{blocking_count} 条
     QA 信号：CRITICAL {crit_total} / HIGH {high_total}
     张力点：{tension_count} 条（{ttl_expired} 条 TTL 已归零）
     改进建议：{suggestion_count} 条
     {若 stagnation_warning}⚠️ 停滞告警已触发

{若 mode=draft}
下一步：将草稿路径交给 tech-writer 进行人工审查与修正：
  tech-writer prompt: "审查并修正 {output_path}，确认根因分析、张力点描述准确后，
                       保存至 _bmad/_memory/evolution-log-R{N}.md"
```

---

## 与 tech-writer 的分工

| 步骤 | 负责方 | 说明 |
|------|-------|------|
| 数据收集 | evolution-analyzer（自动） | 扫描所有 Sprint 产物 |
| 结构化整理 | evolution-analyzer（自动） | 按 evolution-log schema 填充 |
| 根因分析 | tech-writer（人工） | `blocking_log.root_cause` 需要判断 |
| 张力点决策 | tech-writer / 用户 | UNRESOLVED 项的处置建议 |
| 建议优先级 | tech-writer（人工） | 从生成建议中筛选最重要的 2-3 条 |
| 最终确认 | Orchestrator / 用户 | 写入 `_bmad/_memory/` 前确认 |
