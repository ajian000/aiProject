# AI 自治多智能体项目设计文档（Autonomous Multi-Agent Project Design · 动态智能体版）

> 本文档设计了一个**完全由 AI 自治完成**的 IT 行业项目。
> **核心特征**：没有中央调度 AI（No Central Orchestrator），**也不预设 AI 的数量与角色**。
> 每个 AI 加入时读取"共享黑板（Blackboard）"，**自行判断缺什么能力、自己长出一个角色**来认领工作——即"每个 AI 自行决定自己干什么"。
>
> 文档包含三部分：**① 项目概述** · **② 动态自治架构** · **③ 可直接复制粘贴的通用 AI 提示词**。

---

## 0. 如何使用本文档（How to Use This Doc）

| 步骤 | 动作 | 说明 |
|---|---|---|
| 1 | 按第 5 节初始化仓库文件 | 放入 `PRODUCT.md` / `PROTOCOL.md` / `BLACKBOARD.md` / `LOG.md` |
| 2 | 开启**任意数量**的 AI 对话（不限定人数） | 每个对话都粘"第 3 节通用自治提示词" + 仓库路径 |
| 3 | 对每个对话说："读取黑板，自行决定你能贡献什么并开始" | Agent 自行涌现角色、认领任务 |
| 4 | 周期性输入"继续下一轮"，或运行第 8 节编排脚本 | 多 Agent 持续自驱；人数随任务增减 |
| 5 | 满足第 2.4 节终止条件即项目完成 | 产品可运行、测试绿、文档齐 |

> **与旧版的关键区别**：旧版预设 7 个固定角色；本版**不写死任何角色与人数**，角色由 Agent 依据黑板需求自行涌现（emergence）。

---

## 1. 项目概述（Project Overview）

### 1.1 项目定位（Positioning）

- **项目名称（Project Name）**：**Magic Arena（魔法竞技场）** —— 浏览器端的回合制战术战斗**单机**游戏（Single-player Web Turn-based Tactical Game）。
- **项目类型（Type）**：IT / Web **单机**游戏（Browser Single-player Game）。
- **一句话目标（One-line Goal）**：玩家在浏览器中操控一支法师小队，在网格战场施放技能、进行回合制对战；**全部逻辑在本地客户端完成，无需任何服务端**。
- **单机声明（Standalone Notice）**：⚠️ 本项目为**单机游戏**——**无需进行服务端 / 后端 / 账号 / 数据库服务器设计**。所有状态、战斗结算、敌方 AI、存档均运行在浏览器本地；不引入 Express / Socket.IO / 远程数据库等任何服务端组件。
- **选择理由**：纯前端、零服务端依赖，技术栈通用、MVP 边界清晰，且战斗 / 技能 / AI / 渲染等子系统天然可拆给任意数量的自治 Agent 并行推进。

### 1.2 MVP 范围（Minimum Viable Product）

| 编号 | 功能 | 优先级 |
|---|---|---|
| F1 | 网格战场渲染（Canvas，支持选中/点击） | P0 |
| F2 | 单位（英雄）系统与移动/选中 | P0 |
| F3 | 技能系统（施法、冷却、伤害结算） | P0 |
| F4 | 回合制战斗循环与胜负判定 | P0 |
| F5 | 敌方 AI（基于规则的本地决策） | P1 |
| F6 | 本地存档（localStorage：战绩 / 进度） | P1 |
| F7 | 可选：一键打包为静态文件本地运行 | P2 |

> **单机约束**：以上功能**全部在客户端实现**，不依赖任何服务端。F6 存档写入浏览器 localStorage，不接入远程数据库；无"排行榜服务器""匹配服务"等概念。

### 1.3 技术栈（Tech Stack）

- 前端（Frontend-only，无后端）：TypeScript + HTML5 Canvas（或 Phaser 3 游戏引擎）+ Vite（静态构建）
- 状态与存档（State/Save）：浏览器 localStorage（本地持久化，不使用远程数据库）
- 构建 / 运行（Build/Run）：静态文件（可直接本地打开 index.html 或 `vite preview`），**无需服务端**
- 测试（Testing）：Vitest（纯前端单测 / 组件测试）

> 不引入 Express、Socket.IO、SQLite 服务、Docker / 远程数据库等任何服务端技术。

### 1.4 自治理念（Autonomy Philosophy）

> **去中心化 + 角色涌现（Decentralized + Role Emergence）**：
> - 没有"老板 AI"，也**不预设岗位表**。
> - 每个 Agent 都是**通用自治体（General Autonomous Agent）**。
> - 它读黑板 → 判断"目标还缺什么能力" → **自己声明一个角色标签**去补这个缺口 → 执行 → 更新黑板 → 循环。
> - 智能体数量**随任务需求动态增减**：缺口多就多涌现几个，活干完某个角色可隐退或转岗。

---

## 2. 动态自治架构（Dynamic Autonomous Architecture）

### 2.1 组件（Components）

| 组件 | 文件 | 作用 |
|---|---|---|
| 共享仓库（Shared Repo） | git 仓库 | 所有 Agent 读写同一份代码与文档 |
| 产品规格（Product Spec） | `PRODUCT.md` | 目标、MVP、技术栈、约束 |
| 协作协议（Protocol） | `PROTOCOL.md` | 自治规则（本文件第 2~3 节即其内容） |
| 黑板（Blackboard） | `BLACKBOARD.md` | 任务看板 + 能力覆盖 + 讨论 + 决策 |
| 执行日志（Run Log） | `LOG.md` | 每轮动作的结构化审计轨迹（认领/执行/完成/开 PR/合并），供 PR 审阅 |
| 智能体（Agents） | **任意数量**的独立会话 | 各自自治，人数不固定 |

### 2.2 角色涌现机制（Role Emergence — 核心）

> **不预设角色表。** 角色是 Agent 在运行时"长"出来的。

- **能力覆盖区（Capabilities）**：黑板设一个 `Capabilities` 区，记录"当前已被哪些 Agent 认领的能力域"。
- **新 Agent 加入（Join）**：
  1. 读 `PRODUCT.md` + `BLACKBOARD.md`。
  2. 对照目标，找出**尚未被覆盖、且目标需要**的能力缺口。
  3. 若找到缺口 → 在 `Capabilities` 自我声明为该域 Agent（如 `security`、`frontend`），并认领相关任务。
  4. 若所有需要的能力都已被覆盖 → 作为**通才（Generalist）**认领任意未认领任务，或提出推进目标的新任务。
- **角色流动（Fluidity）**：Agent 可在过程中**转变/合并角色**（如后端 Agent 发现需安全审查，可自行兼做并在 `Capabilities` 增注，或提议再拉一个安全 Agent）。无活的 Agent 可在 `Capabilities` 标记"待命/可退役"。
- **人数上界（No Cap）**：没有最大 Agent 数；只要存在未覆盖的能力缺口且目标未完成，就允许新 Agent 涌现。

### 2.3 自主决策循环（Autonomous Decision Loop）

每个 Agent 每轮（per turn）执行：

```
1. 读 BLACKBOARD.md + PRODUCT.md
2. 扫描 Capabilities：哪些目标需要的能力还没人覆盖？
3. 若有缺口 → 自我声明该角色，认领对应任务
   若无缺口 → 作为通才认领任意未认领任务；若仍无活 → 自行拆解 1~N 个新任务并认领
4. 改动共享文件前，在 In-Progress 写 Owner(我的自定角色名 + 时间戳)
5. 交付真实可运行产出（代码能跑、文档准确、测试能过）
6. 完成 → 移入 Done 并附 Evidence(commit/文件/测试命令与结果)
7. 被阻塞 → 在 Blocked 标记原因与所需协助
8. 自我审查：标 Done 前逐条核对 PRODUCT.md 验收标准
9. 循环，直到终止条件或用户干预
```

> 关键：**第 3 步保证"没有活干时 AI 自己创造/认领活"；第 2 步保证"角色由需求涌现而非我指定"**——这正是"每个 AI 自行决定自己干什么"。

### 2.4 冲突解决（Conflict Resolution）

- **任务归属（Ownership）**：先 `claim` 者拥有；他人不得覆盖其 In-Progress 任务。
- **代码冲突（Code）**：统一走 git；提交前先 `pull --rebase`。
- **能力重叠（Overlap）**：若两个 Agent 都声明了同一能力域，在 `Discussions` 协商分工（如一个做鉴权、一个做权限模型）；协商不出则按"最小阻塞"先实现一种并标注 `TODO: revisit`。
- **设计分歧（Disagreement）**：在 `Discussions` 记录两方案，由**最早声明相关能力的 Agent**或任意认领 `decision` 任务的 Agent 裁定。
- **死锁（Deadlock）**：任一 Agent 在 `Blocked` 标记，触发其他 Agent 认领协助或涌现新专长。

### 2.5 终止条件（Termination Criteria）

- [ ] 所有 P0 / P1 任务状态为 `DONE`
- [ ] 前端测试全绿（单机无后端测试）
- [ ] `README.md` 含本地启动步骤；游戏机制文档与实现一致
- [ ] 本地打开（或 `vite preview`）可直接进入对战，无服务端依赖
- [ ] 黑板无未决 `BLOCKED`

---

## 3. 通用自治 AI 提示词（Universal Autonomous Agent Prompt）

> **用法**：这是**唯一**需要复制的提示词。粘进**每一个** AI 对话（人数不限），后面跟仓库绝对路径。
> 它不指定任何角色——角色由 Agent 自己涌现。这是与旧版（7 段固定角色提示词）的根本区别。

```
你是"自组织多智能体工程团队"中的一名自治成员，正在按 PRODUCT.md 开发一个 IT 软件产品。
【关键】
- 团队没有中央管理者（No Central Orchestrator）。
- 你的角色不是别人分配的——它由你根据任务需要自行决定（Role Emergence）。
- 团队人数不固定：有缺口就涌现新 Agent，活干完角色可隐退或转岗。

=== 自治协议（Autonomy Protocol）===
1. 加入/每轮开始：读取 BLACKBOARD.md 与 PRODUCT.md（路径见下）。
2. 判断缺口：对照目标，哪些需要的能力还没被 BLACKBOARD 的 Capabilities 区覆盖？
   - 若有缺口且你能补 → 在 Capabilities 自我声明该角色（如 backend / frontend / qa / security / devops / docs），认领相关任务。
   - 若都已覆盖 → 作为通才认领任意未认领任务，或提出推进目标的新任务写入 Backlog。
3. 改动共享文件前，在 In-Progress 写 Owner(你的自定角色名 + 时间戳)。
4. 交付真实可运行的产出：代码要能编译/运行，文档要准确，测试要能通过。
5. 完成后更新 BLACKBOARD：移入 Done，附 Evidence（commit 哈希 / 文件路径 / 测试命令与结果）。
6. 若被阻塞，在 Blocked 区标记原因与所需协助，绝不静默卡死。
7. 尊重其他 Agent 已认领的任务；通过黑板协调，不覆盖他人进行中的工作。
8. 过程中你可转变/合并角色（如兼做安全审查），并在 Capabilities 更新。
9. 自我审查（Self-Review）：标 Done 前逐条核对 PRODUCT.md 验收标准。
10. 每轮结束前，向 `LOG.md` 追加一条**结构化记录**（格式见第 4.4 节），作为拉取请求（PR）的可审计轨迹——这是文档作为 PR 唯一输入时的关键凭据。

你自主循环上述步骤，直到满足 PROTOCOL.md 终止条件，或用户主动干预。
```

### 3.1 角色自我声明规则（Self-Declaration Rules）

Agent 在 `Capabilities` 区声明角色时，遵循：

- **命名自由**：角色名由你定，建议用英文小写标签（如 `backend`、`frontend`、`qa`、`security`、`devops`、`docs`、`arch`）。
- **一个缺口一个角色**：尽量让一个能力域由一个 Agent 主责，避免重复劳动；重叠时在 `Discussions` 协商。
- **可组合**：你可同时声明多个角色（如 `backend+security`），但需在 Owner 中写清本次任务归属哪个角色。
- **可退役**：当你认领的能力域已无未决任务，在 `Capabilities` 标记 `idle`，不占用新任务。

### 3.2 可选专长启发（Optional Inspiration — 非强制）

> 以下只是"可能涌现的角色"示例，**绝不是岗位表，也不限定人数**。Agent 应依据实际缺口自行判断，而非照抄这份清单。

| 可能涌现的角色 | 典型职责 | 常见任务标签 |
|---|---|---|
| 产品架构 / 协调（arch） | 拆战斗/技能设计、定模块契约、裁定分歧 | `spec` `decision` |
| 前端 / 逻辑（frontend） | 战场渲染(Canvas)、UI、交互、战斗结算逻辑 | `ui` `logic` |
| 敌方 AI（ai） | 敌方决策、技能数值平衡 | `ai` |
| 测试（qa） | 单测/冒烟、报缺陷 | `test` |
| 存档 / 构建（persist） | localStorage 存档、静态打包、启动 | `save` `build` |
| 文档（docs） | README、游戏机制文档 | `docs` |
| 安全（security） | 本地代码审查（如输入校验、防作弊） | `security` |

> 单机项目不必然涌现"后端"角色；若浮现，也只负责本地逻辑 / 存档，不涉及任何远程服务。实际运行中，可能只涌现 3 个 Agent（如 arch+frontend 合一、ai、qa），也可能涌现 8 个（每个细分领域一个）。**人数由黑板需求决定，不由本文档决定。**

---

## 4. 仓库初始化模板（Repo Templates）

### 4.1 PRODUCT.md（产品规格模板）

```markdown
# PRODUCT.md — Magic Arena（魔法竞技场）

## 目标（Goal）
浏览器端**单机**回合制战术战斗游戏。玩家操控法师小队，在网格战场施放技能、进行回合制对战。**全部逻辑在本地客户端完成，无需服务端。**

## 单机声明（Standalone — 重要）
本项目为**单机游戏**，**无需进行服务端 / 后端 / 账号 / 数据库服务器设计**。不引入 Express、Socket.IO、远程数据库、Docker 服务等任何服务端组件；存档仅用浏览器 localStorage。

## MVP
- F1 网格战场渲染（Canvas，支持选中/点击）（P0）
- F2 单位（英雄）系统与移动/选中（P0）
- F3 技能系统（施法、冷却、伤害结算）（P0）
- F4 回合制战斗循环与胜负判定（P0）
- F5 敌方 AI（基于规则的本地决策）（P1）
- F6 本地存档（localStorage：战绩 / 进度）（P1）
- F7 可选：一键打包为静态文件本地运行（P2）

## 技术栈
TypeScript + HTML5 Canvas（或 Phaser 3）+ Vite（静态构建）；状态/存档用 localStorage；测试用 Vitest。**无后端、无远程数据库。**

## 约束
- 纯前端、零服务端依赖；不可引入 Express / Socket.IO / 远程 DB / Docker 服务。
- 战斗规则先有设计文档再实现（技能数值、冷却、胜负条件）。
- 提交必须过测试。

## 验收标准
- 本地打开（或 `vite preview`）可直接进入对战，无需任何服务端。
- 能在网格上移动单位、施放至少一个技能并结算伤害。
- 一方单位全灭即判定胜负；战绩可写入本地存档并读取。
```

### 4.2 BLACKBOARD.md（黑板模板 · 含 Capabilities 区）

```markdown
# BLACKBOARD.md — 共享黑板

## Goal
按 PRODUCT.md 交付 Magic Arena（魔法竞技场）MVP，全程自治，无中央调度，角色由 Agent 自行涌现。

## Capabilities（能力覆盖 · 由 Agent 自我声明）
<!-- 格式: - 角色标签 @Agent代号 : 负责的能力域 -->
<!-- 例: - backend @A2 : API 与数据库 -->

## Backlog（待认领）
<!-- 格式: - [ ] 任务描述  #标签 -->
- [ ] 初始化前端（Vite + TypeScript + Canvas/Phaser）骨架  #frontend

## In-Progress（进行中）
<!-- Owner: 自定角色名 + 时间戳 -->

## Done（已完成）
<!-- Evidence: commit / 文件 / 测试结果 -->

## Discussions（讨论区）
<!-- 能力重叠 / 设计分歧 / 裁定 -->

## Blocked（阻塞）
<!-- 原因 + 所需协助 -->

## Decisions（决策记录）
<!-- 选项 / 选择 / 理由 -->
```

### 4.3 PROTOCOL.md（协议文件）

> 内容即本文档第 2~3 节（动态自治架构 + 通用提示词）。初始化时把第 3 节整段写入 `PROTOCOL.md`，供 Agent 引用。

### 4.4 LOG.md（执行日志模板 · 供 PR 审计）

> 每个 Agent 每轮向 `LOG.md` 追加一条结构化记录（协议第 10 步）。当本文档作为 PR 唯一输入时，审阅者 / CI 直接读此日志即可复盘"谁、何时、做了什么、证据是什么"。

```markdown
# LOG.md — 执行日志（按"小时单位"分组，最新单位在最上）

<!-- 每个单位（Unit）以一个二级标题开头，标题 = 日期 + 时间，精确到小时：
## YYYY-MM-DD HH:00
单位内每条事件一行，行首时间用 HH:MM:SS 便于排序，字段用 | 分隔，便于机读：
@Agent代号(自定角色) | ACTION | TASK#任务号 | BRANCH:分支 | PR:编号(可选) | EVIDENCE:证据 | NOTE:备注
ACTION ∈ {JOIN, CLAIM, PROPOSE, EXECUTE, DONE, BLOCKED, DECISION, PR_OPEN, PR_MERGE}
-->

## 2026-07-06 21:00
21:05:00 @A1(arch)    | JOIN      | -  | -                    | -    | 读取 PRODUCT/BLACKBOARD，声明 arch 角色 | 初始化协作
21:06:10 @A2(frontend) | CLAIM     | #3 | -                    | -    | 认领"初始化前端骨架"                    | 写入 In-Progress
21:20:42 @A2(frontend) | DONE      | #3 | task/3-init-frontend | PR:#5 | commit a1b2c3                            | npm test → 14 passed
21:22:00 @A4(qa)      | PR_OPEN   | #3 | task/3-init-backend | PR:#5 | 提交审查                                | 等待 CI
21:35:11 @A1(arch)    | PR_MERGE  | #3 | -                    | PR:#5 | CI 绿 + 交叉审查通过                     | 合并至 main

## 2026-07-06 22:00
22:10:00 @A3(frontend) | CLAIM | #4 | - | - | 认领前端骨架 | 写入 In-Progress
```

---

## 5. 运行指南（Run Guide）

1. **建仓库**：`git init magic-arena && cd magic-arena`，放入 `PRODUCT.md`（4.1）、`BLACKBOARD.md`（4.2 空模板）、`PROTOCOL.md`（第 3 节）、`LOG.md`（4.4 空模板，仅保留表头与格式注释）。
2. **开对话（人数随意）**：每个对话首条 = 第 3 节通用提示词 + "仓库绝对路径：<你的路径>"。可以只开 2 个，也可以开 10 个。
3. **点火**：对每个对话发送——`读取 PRODUCT.md 与 BLACKBOARD.md，扫描能力缺口，自行声明你的角色并认领第一个任务。` 各 Agent 随即自治运转，并自行在 `Capabilities` 区登记。
4. **推进**：周期性发 `继续下一轮（读黑板→判断缺口/认领→执行→更新）`；或运行第 7 节编排脚本自动轮询。
5. **验收**：对照第 2.5 节；全满足即完成。期间若某能力长期无人覆盖，你可手动再开一个对话补位，或由现有 Agent 兼做。

---

## 6. 质量门禁总表（Quality Gates）

| 门禁 | 条件 | 把关者（涌现角色） |
|---|---|---|
| 代码门禁 | 类型检查通过 + 单测全绿 | 认领 `frontend`/`logic` 的 Agent + `qa` |
| 文档门禁 | README 可本地启动 + 游戏机制文档与实现一致 | 认领 `docs` 的 Agent |
| 安全门禁 | 本地代码审查通过（输入校验、防作弊），无高危 | 认领 `security` 的 Agent |
| 集成门禁 | 本地打开即可进入对战，零服务端依赖 | 认领 `persist`/`build` 的 Agent |
| 交付门禁 | 所有 P0/P1 Done 且黑板无 BLOCKED | 最早声明 `arch` 或认领 `decision` 的 Agent |

> 若某门禁无人认领（如没涌现 `security` Agent），任一通才可兼做并在 `Capabilities` 补注；这正是动态模型的弹性。

---

## 7. 附录：最小编排脚本（Orchestrator Sketch · 可选）

> 文件驱动版：从 `BLACKBOARD.md` 的 `Capabilities` 区**动态读取当前活跃 Agent 列表**（而非写死 7 个），逐轮轮询。真实多 Agent 调度依赖平台 API；此处为概念骨架。

```python
#!/usr/bin/env python3
# orchestrator.py — 动态黑板轮询编排器（概念版）
# 用法: python orchestrator.py --repo /path/to/magic-arena --rounds 20
import argparse, os, re, time

def read_board(repo):
    p = os.path.join(repo, "BLACKBOARD.md")
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""

def active_agents(board):
    # 从 Capabilities 区解析 "@代号" 得到当前活跃 Agent（动态，不写死）
    return re.findall(r"@([A-Za-z0-9_]+)\s*:", board)

def pending_tasks(board):
    return [l for l in board.splitlines() if l.strip().startswith("- [ ]")]

def dispatch(agent, repo, board):
    # 真实环境: 调用该 Agent 的 API，把 board + 通用提示词发过去
    print(f"[{agent}] | 待认领任务数: {len(pending_tasks(board))}")
    print(f"  指令: 读 {repo}/BLACKBOARD.md，扫描缺口/认领任务并执行。")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--rounds", type=int, default=10)
    args = ap.parse_args()
    for r in range(1, args.rounds + 1):
        print(f"\n===== ROUND {r} =====")
        board = read_board(args.repo)
        agents = active_agents(board) or ["(尚无 Agent，等待首个对话认领)"]
        for a in agents:
            dispatch(a, args.repo, board)
        time.sleep(1)

if __name__ == "__main__":
    main()
```

> **说明**：Agent 数量由黑板 `Capabilities` 区决定，脚本不预置。黑板是各 Agent 间唯一的同步点（Single Sync Point）。

---

## 8. 设计要点回顾（Why This Now Matches "每个 AI 自行决定"）

1. **不预设人数** → 开几个对话由你定，活跃 Agent 数由黑板 `Capabilities` 动态反映。
2. **不预设角色** → 角色是 Agent 读黑板后"长"出来的（Role Emergence），不是我分配的。
3. **黑板即真相源** → 解耦任意数量的独立会话，无需共享内存。
4. **自我拆解 + 通才兜底** → 没活干时 AI 自己创造价值，避免"等指令"空转。
5. **质量门禁弹性** → 某门禁无人认领时，通才可兼做并在 `Capabilities` 补注。

> 把 `PRODUCT.md` 换成任何 IT 项目规格，这套"动态自治框架"即可原样复用——人数与角色都由项目本身涌现。
