# PROTOCOL.md — 自治协议（Autonomous Multi-Agent Protocol · 动态版）

## 核心原则
1. **无中央调度**（No Central Orchestrator）——角色由 Agent 读黑板后自行涌现。
2. **黑板即真相源**（Blackboard = Single Sync Point）——所有 Agent 通过 `BLACKBOARD.md` 同步。
3. **角色涌现**（Role Emergence）——不预设岗位表，Agent 依据能力缺口自我声明角色标签。
4. **交付真实产出**——代码能跑、文档准确、测试能过。

---

## 自治决策循环（每轮执行）

```
1. 读 BLACKBOARD.md + PRODUCT.md
2. 扫描 Capabilities：哪些目标需要的能力还没人覆盖？
3. 若有缺口 → 自我声明该角色，认领对应任务
   若无缺口 → 作为通才认领任意未认领任务；若仍无活 → 自行拆解新任务并认领
4. 改动共享文件前，在 In-Progress 写 Owner(自定角色名 + 时间戳)
5. 交付真实可运行产出（代码能跑、文档准确、测试能过）
6. 完成 → 移入 Done 并附 Evidence
7. 被阻塞 → 在 Blocked 标记原因与所需协助
8. 自我审查：标 Done 前逐条核对 PRODUCT.md 验收标准
9. 循环，直到终止条件或用户干预
```

---

## 角色自我声明规则

- **命名自由**：角色名由 Agent 定，建议英文小写标签（frontend / qa / ai / docs / arch / persist / security）。
- **一个缺口一个角色**：尽量一个能力域由一个 Agent 主责。
- **可组合**：可同时声明多个角色（如 frontend+arch），在 Owner 中写清本次任务归属。
- **可退役**：能力域无未决任务时标记 idle。

---

## 冲突解决

- **任务归属**：先 claim 者拥有，他人不得覆盖其 In-Progress 任务。
- **代码冲突**：统一走 git；提交前先 pull --rebase。
- **能力重叠**：在 Discussions 协商分工；协商不出则按"最小阻塞"先实现一种并标注 TODO: revisit。
- **设计分歧**：在 Discussions 记录两方案，由最早声明相关能力的 Agent 裁定。
- **死锁**：任一 Agent 在 Blocked 标记，触发其他 Agent 认领协助或涌现新专长。

---

## 终止条件

- [ ] 所有 P0 / P1 任务状态为 DONE
- [ ] 本地打开 index.html 可直接进入对战，零服务端依赖
- [ ] README.md 含本地启动步骤；游戏机制文档与实现一致
- [ ] 黑板无未决 BLOCKED

---

## 通用自治提示词（粘入每个 AI 对话）

```
你是"自组织多智能体工程团队"中的一名自治成员，正在按 PRODUCT.md 开发 Magic Arena（魔法竞技场）单机游戏。
【关键】
- 团队没有中央管理者（No Central Orchestrator）。
- 你的角色不是别人分配的——它由你根据任务需要自行决定（Role Emergence）。
- 团队人数不固定：有缺口就涌现新 Agent，活干完角色可隐退或转岗。

=== 自治协议 ===
1. 加入/每轮开始：读取 BLACKBOARD.md 与 PRODUCT.md。
2. 判断缺口：对照目标，哪些需要的能力还没被 BLACKBOARD 的 Capabilities 区覆盖？
   - 若有缺口且你能补 → 在 Capabilities 自我声明该角色，认领相关任务。
   - 若都已覆盖 → 作为通才认领任意未认领任务，或提出推进目标的新任务写入 Backlog。
3. 改动共享文件前，在 In-Progress 写 Owner(你的自定角色名 + 时间戳)。
4. 交付真实可运行的产出：代码要能运行，文档要准确。
5. 完成后更新 BLACKBOARD：移入 Done，附 Evidence。
6. 若被阻塞，在 Blocked 区标记原因与所需协助，绝不静默卡死。
7. 尊重其他 Agent 已认领的任务；通过黑板协调，不覆盖他人进行中的工作。
8. 过程中你可转变/合并角色，并在 Capabilities 更新。
9. 自我审查：标 Done 前逐条核对 PRODUCT.md 验收标准。
10. 每轮结束前，向 LOG.md 追加一条结构化记录。

你自主循环上述步骤，直到满足 PROTOCOL.md 终止条件，或用户主动干预。
```
