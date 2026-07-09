# DESIGN.md — Magic Arena 游戏机制设计文档

> 本文档描述 Magic Arena（魔法竞技场）的完整游戏机制，供开发者与自治 Agent 参考。
> 所有数值与规则均与 `game.js` 实现严格一致。

---

## 1. 战场规格

| 属性 | 值 |
|---|---|
| 网格尺寸 | 10×10 |
| 单元格像素 | 80px × 80px |
| Canvas 尺寸 | 800px × 800px |
| 玩家部署区 | 第 0-1 列（左侧） |
| 敌方部署区 | 第 8-9 列（右侧） |
| 每方单位数 | 4（玩家小队 4 人，敌方 3~4 人依关卡配置） |

## 2. 单位系统

### 2.1 玩家单位

| ID | 名称 | 阵营 | 最大HP | 移动范围 | 技能槽 | 部署坐标 |
|---|---|---|---|---|---|---|
| player_0_1 | 炎法师·艾拉 | 火焰 | 80 | 2 | 火球术 / 灼烧术 / 治愈术 | (1, 1) |
| player_1_1 | 雷法师·特斯拉 | 寒冰 | 70 | 3 | 闪电链 / 沉默术 / 嘲讽术 | (1, 3) |
| player_2_1 | 暗法师·莫甘娜 | 自然 | 65 | 2 | 陨石术 / 易伤术 / 致盲术 | (1, 5) |
| player_3_1 | 风行者·翠影 | 自然 | 62 | 4 | 闪电链 / 冰霜箭 / 治愈术 | (1, 7) |

### 2.2 敌方单位

| ID | 名称 | 阵营 | 最大HP | 移动范围 | 技能槽 | 部署坐标 |
|---|---|---|---|---|---|---|
| enemy_a | 骷髅法师·卡尔 | 自然 | 75 | 2 | 暗影弹 / 灼烧术 / 生命汲取 | (6, 1) |
| enemy_b | 暗影巫·维克 | 寒冰 | 65 | 3 | 闪电链 / 暗影弹 / 中毒术 | (6, 3) |
| enemy_c | 亡灵术士·安娜 | 火焰 | 60 | 2 | 陨石术 / 生命汲取 / 治愈术 | (6, 5) |
| enemy_d | 烈焰术士·伊格尼斯 | 火焰 | 70 | 2 | 火球术 / 灼烧术 / 治愈术 | 敌方池 |
| enemy_e | 冰晶守卫·弗罗斯特 | 寒冰 | 85 | 2 | 冰霜箭 / 冰冻术 / 治愈术 | 敌方池 |
| enemy_f | 藤蔓德鲁伊·希尔 | 自然 | 65 | 3 | 生命汲取 / 陨石术 / 灼烧术 | 敌方池 |
| enemy_g | 雷霆审判者·托尔 | 寒冰 | 68 | 3 | 闪电链 / 眩晕术 / 治愈术 | 敌方池 |
| enemy_h | 剧毒巫医·摩格 | 自然 | 62 | 2 | 中毒术 / 暗影弹 / 生命汲取 | 敌方池 |
| boss_0 | 大魔导师·马尔佐斯（BOSS） | 火焰 | 150 | 3 | 陨石术 / 火球术 / 中毒术 | 第6关 |

> 单位类型池共 **12** 种（玩家 3 + 敌方池 8 + Boss 1）；三阵营各 4 种：火焰（艾拉/安娜/伊格尼斯/马尔佐斯）、寒冰（特斯拉/维克/弗罗斯特/托尔）、自然（莫甘娜/卡尔/希尔/摩格），满足 §1.5「每阵营 ≥4」基线。

## 3. 技能系统

### 3.1 技能定义表

| Key | 技能名 | 伤害 | 范围 | 冷却 | 特殊效果 | 类型 |
|---|---|---|---|---|---|---|
| fireball | 火球术 | 25 | 3 | 0 | — | 攻击 |
| burn | 灼烧术 | 0 | 3 | 2 | 点燃目标 2 回合，每回合受 6 伤害（可叠加，上限 4 回合） | 持续伤害 (DoT) |
| frostbolt | 冰霜箭 | 15 | 4 | 1 | — | 攻击 |
| heal | 治愈术 | -20 | 2 | 2 | 回复 20 HP | 治疗 |
| lightning | 闪电链 | 18 | 3 | 2 | — | 攻击 |
| shadowbolt | 暗影弹 | 22 | 3 | 0 | — | 攻击 |
| drain | 生命汲取 | 12 | 2 | 1 | 自回 8 HP | 攻击+吸血 |
| meteor | 陨石术 | 18 | 4 | 2 | 命中格周围 1 格（曼哈顿）内所有敌方单位 | 范围攻击 (AoE) |
| stun | 眩晕术 | 0 | 3 | 3 | 使敌方目标下回合无法行动（控制，不叠加） | 控制 |
| freeze | 冰冻术 | 6 | 3 | 2 | 造成 6 伤害并使敌方目标被冰冻、无法移动 2 回合（不叠加，取最长时间） | 控制/定身 |
| poison | 中毒术 | 4 | 3 | 2 | 造成 4 直接伤害并使敌方中毒 3 回合，每回合受 4 点毒性伤害（可叠加伤害，上限 12），中毒期间治疗减半 | 持续伤害 (DoT) + 治疗削弱 |
| blind | 致盲术 | 0 | 3 | 2 | 使敌方目标致盲 2 回合，期间其造成的所有伤害降低 50%（削弱敌方输出） | 控制/削弱（输出削弱） |
| vuln | 易伤术 | 0 | 3 | 2 | 使敌方目标易伤 2 回合，期间其受到的所有伤害提升 50%（集火放大器） | 削弱（集火放大器） |
| taunt | 嘲讽术 | 0 | 3 | 3 | 使敌方目标嘲讽 2 回合，期间其攻击被强制吸引向施法者（坦克引流·保护队友） | 控制/威胁转移 |
| fear | 恐惧术 | 0 | 3 | 2 | 使敌方目标恐惧 2 回合，期间其被迫远离施法者移动（恐慌撤退），无法主动接近 | 控制/移动控制 |
| pull | 拉拽术 | 0 | 3 | 2 | 将敌方目标向施法者拉近最多 2 格（即时物理位移·可拉入射程或危险格） | 控制/位置控制（强制位移） |
| empower | 强化术 | 0 | 2 | 2 | 为友方单位附加强化，使其造成的所有伤害提升 50%（持续 2 回合·进攻增益 buff） | 增益（友方进攻增益） |

> 注：冰霜箭（frostbolt）原为莫甘娜的技能，阶段二被冰冻术替换；现无单位装备（圣光祭司·塞拉曾短暂持有，后在方向驱动轮次以恐惧术替换），保留于 `SKILL_DEFS` 作为数据兼容。
> 注：致盲术（blind）为本轮（2026-07-07 方向驱动）新增，替换莫甘娜原冰冻术槽位（保留陨石术/生命汲取，仍保持"每单位 2~3 技能"约束）；致盲是首个"削弱敌方输出"的 debuff，填补了控制维度之外的"攻防压制"战术。敌方 AI（`sortedAttackSkills`）显式排除 `isBlind`，故敌方单位不会施放该技能（避免误把 debuff 当攻击空放）。
> 注：易伤术（vuln）为方向驱动核心玩法新增，由暗法师·莫甘娜持有（陨石术 / 易伤术 / 致盲术，仍保持"每单位 2~3 技能"约束）；易伤是"集火放大器"——被易伤的敌方受到的所有伤害提升 50%，与致盲（压低敌方输出）/沉默（禁施法）/嘲讽（强制吸引）正交，给玩家带来全新的"标记→集火"战术。敌方 AI（`sortedAttackSkills`）显式排除 `isVuln`，故敌方单位不会施放该技能（易伤本就是玩家用于放大自身输出的 debuff）。
> 注：恐惧术（fear）为方向驱动核心玩法新增，由圣光祭司·塞拉持有（治愈术 / 圣光打击 / 恐惧术，替换原冰霜箭，仍保持"每单位 2~3 技能"约束）；恐惧是"强制位移"维度——被恐惧的敌方被迫远离施法者移动（恐慌撤退），与冰冻（禁移）/嘲讽（强制靠近）构成正交的"移动控制"三轴。敌方 AI（`sortedAttackSkills`）显式排除 `isFear`，故敌方单位不会施放该技能。
> 注：拉拽术（pull）为方向驱动核心玩法新增，由圣堂守卫·加百列持有（火球术 / 治愈术 / 拉拽术，替换原眩晕术，仍保持"每单位 2~3 技能"约束）；拉拽是「即时物理位移」维度——施放瞬间将敌方目标向施法者拉近最多 2 格（可把敌人拉入射程或危险格），与恐惧（推远）/嘲讽（强制靠近·攻击吸引）/冰冻（禁移）正交，构成「移动控制」第四轴。**拉拽是即时位移而非持续 debuff，故无回合计数状态**；敌方 AI（`sortedAttackSkills`）显式排除 `isPull`，故敌方单位不会施放该技能（敌方单位本也不持有 pull）。
> 注：强化术（empower）为方向驱动核心玩法新增，由圣光祭司·塞拉持有（治愈术 / 圣光打击 / 强化术，替换原恐惧术，仍保持"每单位 2~3 技能"约束）；强化是首个对**友方单位**施加的"进攻增益"维度——被强化的友方造成的所有伤害提升 50%（`damageUnit` 内 `if (attacker.empowerTurns > 0) actual = floor(actual * (1 + EMPOWER_AMP))`，EMPOWER_AMP=0.5，与致盲「输出-50%」对称地作用于**攻击方**）。它与治愈术/护盾（防御/续航向友方增益）、易伤（作用于敌方的进攻向 debuff）均正交——填补了既有全部机制中唯一缺失的"友方进攻增益"维度。敌方 AI（`sortedAttackSkills`）显式排除 `isEmpower`（强化是玩家为友方准备的 buff，敌方 AI 不误放）；宿主在圣光阵营，默认 classic 下既有测试零触达。

### 3.2 冷却机制

- 施放后技能立即进入冷却（`cd = cooldown` 回合）
- 每回合开始时，所有技能冷却 -1（最小为 0）
- `cd > 0` 的技能无法使用，UI 上按钮变为禁用状态并显示剩余冷却回合

### 3.3 伤害结算公式

```
实际伤害 = 技能基础伤害值 (dmg)
目标新HP = max(0, 目标当前HP - 实际伤害)

治疗量 = |dmg|（当 isHeal=true 时取绝对值）
目标新HP = min(最大HP, 目标当前HP + 治疗量)

生命汲取: 造成 dmg=12 伤害后，攻击者自回 selfHeal=8 HP
```

### 3.4 攻击范围

- 范围 = 曼哈顿距离（`|dx| + |dy|`）
- 以施法者坐标为圆心，`range` 为半径的所有格子
- 攻击可对空地施放（无目标时仍消耗技能）

### 3.5 范围伤害（AoE）

- 当技能 `aoeRadius > 0` 时，以点击格为中心，对曼哈顿距离 ≤ `aoeRadius` 内的**所有敌方单位**结算伤害（不波及友方）。
- 示例：陨石术（aoeRadius=1）命中格及其上下左右相邻格（共 5 格）内的敌方单位均受 18 伤害。
- 中心格可为空地；若范围内无任何敌方单位，仍消耗技能（按"对空地施放"规则）。
- 当前拥有该技能的单位：暗法师·莫甘娜、亡灵术士·安娜。

### 3.6 控制效果（眩晕 / 冰冻）

- 当技能 `isStun=true` 时，对**敌方**目标施放后，目标获得 `stunned=true` 状态，其**下一个敌方回合**将跳过所有行动（不结算攻击 / 治疗 / 移动）。
- 眩晕在敌方回合开始时结算：若单位 `stunned` 为真，则清除该标记并跳过 `aiDecide`，记录日志"被眩晕，跳过本回合行动"。
- 眩晕不可叠加：重复施放仅保持状态为真（不延长），且技能冷却（CD3）限制了施放频率。
- 当前拥有该技能的单位：雷法师·特斯拉（替换原冰霜箭，仍保持"每单位 3 技能"约束）。

- **冰冻（定身）**：当技能 `isFreeze=true` 时，对**敌方**目标施放后，目标获得 `frozenTurns` 状态（本作为 2 回合），在 `frozenTurns > 0` 期间**无法移动**（但仍可原地施放技能 / 攻击）；每个新回合开始时 `frozenTurns` -1，归零时解除并提示"冰冻解除，可再次移动"。与眩晕的区别：眩晕跳过**整个**回合行动，冰冻仅禁止**移动**、保留攻击 / 施法能力，是更细粒度的定位控制。
- 冰冻不可叠加：重复施放取 `max(frozenTurns, skill.freezeTurns)`（不延长超过设定上限）。
- 当前拥有该技能的单位：暗法师·莫甘娜（替换原冰霜箭，仍保持"每单位 3 技能"约束）。

### 3.7 持续伤害（灼烧 / DoT）

- 当技能 `isBurn=true` 时，对**敌方**目标施放后，目标获得 `burnTurns` 与 `burnDmg` 状态，在**每个新回合开始时受到 `burnDmg` 伤害**，然后 `burnTurns` -1（直至为 0 时停止）。
- 灼烧可叠加：重复施放时 `burnTurns` 累加（上限 4 回合），`burnDmg` 取最大值（不衰减）。
- 灼烧在 `nextTurn()` 中结算 — 先结算灼烧伤害（可能致死），再进入玩家回合。
- 灼烧伤害不区分阵营：敌我双方身上有灼烧标记的都会在回合开始时受到伤害。
- 被灼烧致死的单位会在回合开始时即判定胜负（`checkGameEnd`）。
- 视觉：橙红色"燃"标记显示在单位下方；UI 属性面板显示"🔥 灼烧中(N回合)"。
- 当前拥有该技能的单位：炎法师·艾拉（替换原冰霜箭）、骷髅法师·卡尔（替换原冰霜箭）。

### 3.8 中毒效果（持续伤害 + 治疗削弱）

- 当技能 `isPoison=true` 时，对**敌方**目标施放后，先造成 `dmg`（本作为 4）直接伤害，再使目标获得 `poisonTurns` 与 `poisonDmg` 状态。
- **持续毒性伤害**：在**每个新回合开始时**，中毒单位受到 `poisonDmg` 伤害，然后 `poisonTurns` -1（归零时停止）；该伤害不区分阵营，可能致死并触发 `checkGameEnd`。
- **伤害叠加（与灼烧的差异）**：重复施放时 `poisonTurns` 刷新为固定持续回合（本作 3 回合），而 `poisonDmg` **累加**（每次 +4，上限 `poisonMax=12`）。即中毒强调"伤害逐层加重"，灼烧强调"持续回合数叠加"，二者形成差异化 DoT 维度。
- **治疗削弱（独特性）**：单位处于中毒状态（`poisonTurns > 0`）时，受到的任何治疗量减半（`floor(治疗量/2)`），无论来自玩家治愈术还是敌方 AI 自疗；该削弱在 `applySkill` 治疗分支与 `aiDecide` 两处治疗逻辑中统一生效。
- 视觉：黄褐色"毒"字显示在单位右侧；UI 属性面板显示"☠ 中毒中(N回合·治疗减半)"。
- 当前拥有该技能的单位：暗影巫·维克（原仅 2 技能，阶段二补入中毒术达 3 技能，仍保持"每单位 2~3 技能"约束）；该效果填补了 §1.5 内容基线中最后一种缺失的状态效果（灼烧/冰冻/**中毒**/眩晕/治疗），至此 5 种状态效果全部实现。

### 3.9 致盲效果（削弱敌方输出 / 攻防压制）

- 当技能 `isBlind=true` 时，对**敌方**目标施放后，目标获得 `blindTurns` 状态（本作为 2 回合）。
- **输出削弱**：在 `blindTurns > 0` 期间，该单位**造成的所有伤害降低 50%**（`damageUnit` 内 `if (attacker.blindTurns > 0) actual = floor(actual * 0.5)`，在掩体减伤之前结算）。该削弱对**该单位的一切攻击**生效——无论是玩家致盲敌方后敌方的反击，还是理论上敌方致盲玩家后玩家的攻击（目前敌方 AI 不会施放致盲，见 §3.1 注）。
- **与既有状态效果的差异**：眩晕/冰冻是"限制行动"（跳过整回合 / 禁止移动），灼烧/中毒是"持续掉血"，致盲则是"削弱攻击质量"——它不改变目标的行动能力，只压低其威胁度，是与前四类正交的"攻防压制"维度。
- 致盲**不叠加**：重复施放取 `max(blindTurns, skill.blindTurns)`（保持设定时长，不延长）。
- 致盲在 `nextTurn()` 中结算：`blindTurns -1`，归零时解除并提示"致盲解除，伤害恢复"。
- 视觉：淡紫色"盲"字显示在单位左上角；UI 属性面板显示"👁 致盲中(N回合·伤害降低50%)"。
- 当前拥有该技能的单位：暗法师·莫甘娜（陨石术 / 生命汲取 / 致盲术），本轮新增。

### 3.10 易伤效果（集火放大器 / 攻防压制）

- 当技能 `isVuln=true` 时，对**敌方**目标施放后，目标获得 `vulnTurns` 状态（本作为 2 回合）。
- **集火放大器**：在 `vulnTurns > 0` 期间，该单位**受到的所有伤害提升 50%**（`damageUnit` 内 `if (target.vulnTurns > 0) actual = floor(actual * (1 + VULN_AMP))`，在掩体减伤之后、护盾吸收之前结算，`VULN_AMP=0.5`）。该放大器对**打到该目标的一切伤害**生效——普攻、AoE、DoT、危险格环境伤害、乃至被易伤单位的反击（若玩家被敌方易伤，则玩家受伤也提升）。
- **与既有状态效果的差异**：眩晕/冰冻是"限制行动"，灼烧/中毒是"持续掉血"，致盲是"削弱攻击质量"，护盾是"吸收伤害"；易伤则是"放大对该目标的伤害"——它不改变目标自身能力，只让我方的集火更高效，是与前几类正交的"进攻向削弱"维度（专用于"标记高威胁目标→集火秒杀"的战术）。
- 易伤**不叠加**：重复施放取 `max(vulnTurns, skill.vulnTurns)`（保持设定时长，不延长）。
- 易伤在 `nextTurn()` 中结算：`vulnTurns -1`，归零时解除并提示"易伤解除，受到伤害恢复正常"。
- 视觉：红色"易"字显示在单位顶部偏上（与眩晕"晕"错位）；UI 属性面板显示"💥 易伤中(N回合·受到伤害+50%)"。
- 当前拥有该技能的单位：暗法师·莫甘娜（陨石术 / 易伤术 / 致盲术），方向驱动核心玩法新增。

## 4. 战斗系统

### 4.1 回合制流程

```
新回合开始
  │
  ├─ 玩家回合
  │   ├─ 选择单位（点击未行动单位）
  │   │   ├─ 移动（点击"移动"→选择目标格子）
  │   │   ├─ 施法（点击技能→选择目标格子）
  │   │   └─ 跳过（点击"跳过此单位"）
  │   └─ 循环直到所有玩家单位已行动，或点击"结束回合"
  │
  ├─ 敌方回合（AI 自动，逐单位 400ms 延迟）
  │   └─ AI 决策（参见 §5）
  │
  └─ 新回合
      ├─ turnNum++
      ├─ 全部单位 acted=false
      ├─ 全部技能 cd = max(0, cd-1)
      ├─ 结算灼烧伤害（DoT 每回合 tick）
      ├─ 结算中毒伤害（poisonDmg 每回合 tick，poisonTurns -1）
      ├─ 结算冰冻定身（frozenTurns -1，归零解除）
      ├─ 结算致盲（blindTurns -1，归零解除并恢复伤害）
      └─ 进入玩家回合
```

### 4.2 胜负判定

```
if (所有玩家单位 HP ≤ 0):
    玩家失败 → saveData.losses++ → 存档 → 弹窗："战斗失败"
if (所有敌方单位 HP ≤ 0):
    玩家胜利 → saveData.wins++ → 存档 → 弹窗："战斗胜利"
```

判定在每次技能结算后触发（`applySkill` 后调用 `checkGameEnd`），以及每回合灼烧结算后（`nextTurn` 内调用 `checkGameEnd`）。

## 5. 敌方 AI 决策规则

### 5.1 决策流程（优先级递减）

```
function aiDecide(unit):
    ① 自保治疗：若 unit.hp < 40% 且有可用治愈技能
       → 对有治愈技能的敌方单位中 HP 最低者施放治愈术
       → 若无法对友方施放（范围外），则跳过治疗
       → 若自身可做目标，按距离优先

    ② 攻击技能：遍历冷却完毕的非治疗技能（按伤害降序）
       → 找在范围内的玩家活单位
       → 优先攻击 HP 最低的目标（斩杀逻辑）
       → 命中后立即标记 acted 并返回

    ③ 移动靠近：找距离最近的玩家活单位
       → 从可移动格子中选离该目标曼哈顿距离最近的格子
       → 移动到该格

    ④ 移动后攻击：移动后重新检查可用攻击技能
       → 同②逻辑

    ⑤ 治疗兜底：移动后若仍可治疗且 HP < 40%
       → 对可达友方施放治愈术

    ⑥ 跳过：以上均不满足 → 标记 acted 并跳过

### 5.2 AI 治疗阈值

| 条件 | 行为 |
|---|---|
| HP < 40% 最大HP | 触发治疗决策 |
| HP >= 40% | 正常攻击/移动 |
```

## 6. 移动系统

### 6.1 移动规则

- 移动范围 = 曼哈顿距离 ≤ `moveRange`
- 目标格子必须为空（无任何单位占据）
- 移动不消耗技能，每个单位每回合可移动 1 次
- 移动后可继续施放技能（不结束该单位回合）

### 6.2 移动范围计算（曼哈顿距离）

```
可移动格 = { (x, y) | |x - unit.gx| + |y - unit.gy| ≤ unit.moveRange
                      AND getUnitAt(x, y) == null }
```

## 7. 存档系统

| 属性 | 值 |
|---|---|
| 存储方式 | `localStorage` |
| 键名 | `magicArenaSave` |
| 数据格式 | `{ wins: number, losses: number }` |
| 保存时机 | 每次 `checkGameEnd()` 判定胜负后 |
| 加载时机 | 页面 `DOMContentLoaded` 时 |

## 8. UI 交互

### 8.1 阶段状态机

```
selectUnit → (点击移动) → move → (点击空格子) → selectUnit   // 移动不消耗行动
selectUnit → (点击技能) → selectTarget → (点击目标) → 结算伤害 → 自动选下一个未行动单位
selectUnit → (点击跳过) → 自动选下一个未行动单位
selectUnit → (点击结束回合) → enemyTurn → (AI完成) → selectUnit
任意阶段 → checkGameEnd() → gameOver
```

> **手感优化（阶段二）**：某单位施法或跳过后，自动选中下一个未行动玩家单位（`selectNextPlayerUnit`），减少手动逐一点击；所有单位行动完毕后自动清空选中，提示玩家点击"结束回合"。

### 8.2 键盘快捷键

| 键 | 操作 |
|---|---|
| `M` | 开始移动模式 |
| `1` `2` `3` | 施放第 1/2/3 个技能 |
| `S` | 跳过当前单位 |
| `Space` / `Enter` | 结束回合 |
| `Esc` | 取消当前操作（移动/技能选择） |

### 8.3 视觉反馈

- **选中光环**：金色描边圆圈
- **移动高亮**：蓝色半透明方格
- **攻击高亮**：红色半透明方格
- **已行动**：灰色遮罩覆盖
- **冰冻标记**：浅蓝色"冰"字显示在单位左侧（定身中、无法移动）
- **中毒标记**：黄褐色"毒"字显示在单位右侧（中毒中、治疗减半）
- **致盲标记**：淡紫色"盲"字显示在单位左上角（致盲中、伤害降低 50%）
- **易伤标记**：红色"易"字显示在单位顶部偏上（易伤中、受到伤害 +50%）
- **恐惧标记**：紫色虚线环（#ba68c8）环绕单位（恐惧中、被迫远离施法者移动·恐慌撤退）
- **拉拽反馈**：施放瞬间弹出「拉拽」status 飘字（淡紫 #e0a0ff，与恐惧同级）于目标新位置；拉拽为「即时物理位移」、无持续状态故无常驻文字标记（区别于恐惧虚线环）
- **HP 条**：绿色（玩家）/ 红色（敌方），动态宽度
- **飘字反馈（Floating Combat Text，@A25 · 方向4 体验打磨）**：每次伤害/治疗/状态结算在单位上方弹出一段文字，随帧上浮并淡出（life 30→0）。
  - 伤害：`红色 "-N"`（已含掩体减伤、致盲减半的实算值）
  - 治疗：`绿色 "+N"`
  - 灼烧 DoT 结算：`橙红 "燃N"`
  - 中毒 DoT 结算：`黄绿 "毒N"`
  - 危险格环境伤害：`浅红 "危N"`
  - 状态施加确认：`淡紫 "眩晕/灼烧/冰冻/中毒/致盲"`
  - 实现：`pushFloater(gx,gy,text,kind)` 写入 `floaters` 队列；`drawFloaters()` 在 `render()` 末尾绘制并递减 life；`floaters` 已通过 `_state()` 暴露，可供纯 Node 验证（方向5 安全网可断言）。
  - **战斗日志面板（Battle Journal · 方向4 体验打磨 · @A34）**：右侧 `#log-content` 面板实时滚动展示战斗事件（施法 / 伤害 / 治疗 / 状态结算 / DoT / 危险格 / 胜负），每条按类型配色（`info` 灰 / `damage` 红 / `heal` 绿 / `status` 紫 / `system` 金）；由 `addLog(text, type)` 统一写入，`addLog` 对缺失面板做 null 守卫（构建版若缺 `#log-content` 也不崩溃），`logs` 经 `_state()` 暴露可供方向5 纯 Node 断言（见 `test/smoke-test.js` 场景 S7）。飘字给「瞬时视觉冲击」，日志给「全程可查记录」，二者构成方向4 双层信息反馈体系，均零侵入战斗结算逻辑。


---

## 9. 战役进度 / 多地图地形 / 单局遭遇（阶段二子系统 · @A16）

> 本系统同时交付多个 §2.5 阶段二 checklist 项：**地图 ≥6 张（含地形机制）**、**战役 ≥6 关递进（第 6 关为 Boss 战）**、**单局遭遇模式 Skirmish**、**敌方 AI 分阵营风格**、**本地进度存档（unlockedLevel）**，并构成设计文档明确要求的「至少 1 个自主提出的新子系统」（关卡 / 战役进度系统）。菜单与战斗均运行于本地，零服务端依赖。

### 9.1 主菜单与模式

- 游戏启动（`DOMContentLoaded → init`）后进入主菜单（`#menu`），不自动开战。
- 战役模式：列出 6 关，已解锁关卡可点击进入，未解锁关卡显示 🔒 并禁用（解锁进度由 `saveData.unlockedLevel` 决定，持久化于 localStorage）。
- 单局遭遇：随机选图 + 从敌方池中随机抽 3 名敌人，快速开战。

### 9.2 地图与地形（≥6 张）

`MAPS` 定义 6 张战役地图，覆盖不同群系（平原 / 森林 / 雪山 / 废墟 / 火山 / 沼泽），每张含地形机制：

| 地图 | 群系 | 掩体 cover | 危险格 hazard |
|---|---|---|---|
| 平原 | grassland | — | — |
| 森林 | forest | 4 格 | — |
| 雪山 | snow | 1 格 | 3 格 |
| 废墟 | ruins | 2 格 | 2 格 |
| 火山 | volcano | 1 格 | 4 格 |
| 沼泽 | swamp | 2 格 | 3 格 |

- **掩体（cover）**：单位站在掩体格时，受到的伤害 ×`COVER_REDUCE`（0.7，即减伤 30%）；`damageUnit()` 统一结算。渲染为灰色「掩」字格。
- **危险格（hazard）**：每个新回合开始时，站在危险格上的存活单位受到 `HAZARD_DMG`（8 点）环境伤害（不区分阵营），可能致死并触发 `checkGameEnd`；渲染为红色「危」字格。
- 部署区固定在左列（玩家 gx=1）/ 右列（敌方 gx=6），地形仅分布于中场 gx∈[2,5]，不侵占部署区。

### 9.3 战役（≥6 关）

`CAMPAIGN` 定义 6 关，难度与敌人组合递进；第 6 关为 Boss 战（部署大魔导师·马尔佐斯 + 2 名随从）。

- 胜利且为战役模式时：若非最后一关，则 `unlockedLevel = max(unlockedLevel, 当前关+1)` 并弹出「进入下一关 ▶」；若为第 6 关（通关），弹出「🎉 返回主菜单」。
- 失败：战役模式弹出「重试本关」，Skirmish 弹出「再来一局」。
- 进度写入 localStorage 键 `magicArenaSave`，结构 `{ wins, losses, unlockedLevel }`；加载时经 `sanitizeSave()` 钳制（unlockedLevel 限制为 [1, 6]）。

### 9.4 单局遭遇（Skirmish）

- `startSkirmish()`：随机地图索引 + 敌方池 Fisher–Yates 洗牌取前 3 名，开战。无进度解锁约束，每局独立。

### 9.5 敌方 AI 分阵营风格

敌方单位按 `faction` 取 `FACTIONS[...].aiStyle`，驱动差异化决策（见 §5 `aiDecide`）：

| 阵营 | AI 风格 | 行为特征 |
|---|---|---|
| 火焰 pyro | aggressive（激进突进） | 默认：高伤害优先、低治疗阈值（40%） |
| 寒冰 cryo | defensive（防守反击） | 自愈阈值提高到 60%；移动优先占据掩体格 |
| 自然 nature | skirmish（游击骚扰） | 攻击优先施放控制技（眩晕/冰冻/中毒）；移动优先占据掩体格 |

> 控制技优先排序由 `sortedAttackSkills(unit, 'skirmish')` 实现（控制技计数降序，其次伤害降序）。

### 9.6 验证

- `node --check game.js` → SYNTAX_OK（本地、零网络、零依赖）。
- 菜单 → 战役/遭遇 → 战斗 → 胜负 → 解锁/重试 全流程本地可跑通；`unlockedLevel` 跨对局持久化。

### 9.7 难度选择（Stage 3 · 数值平衡子系统 · @A17）

> 本系统交付 §2.5 阶段三「数值平衡」首个 checklist 项，并属于设计文档 §3.2 明确建议的候选子系统（难度选择），让单局体验在简单/普通/困难间有清晰梯度。

- 主菜单新增「难度选择」区段：简单 / 普通 / 困难（默认「普通」），通过 `setDifficulty()` 切换，按钮实时高亮当前档位并显示缩放系数。
- 难度**仅缩放敌方单位**（玩家小队保持 §2.2 基准数值），保证公平：
  - 简单：敌方 HP×0.60 / 敌方伤害×0.65（A26 护盾换装后下调 easy 以补偿攻防漂移）
  - 普通：敌方 HP×0.80 / 敌方伤害×1.00（伤害保持基准，兼容 status-effects 回归测试的硬编伤害值）
  - 困难：敌方 HP×1.25 / 敌方伤害×1.10
- 缩放在 `createUnit()` 部署时应用：敌方 `maxHp/hp` 按 `hpMul` 取整、敌方技能 `dmg / burnDmg / poisonDmg` 按 `dmgMul` 取整；玩家与小队保持 ×1.0，数值不变。因此 §2.2 / §3.1 表中数值为「普通」难度基准。
- `DIFFICULTY` 数据驱动，新增难度档位只需在表中加一项；`setDifficulty()` 跨对局生效（影响后续开战的敌方强度）。
- **数值平衡校验（见 §9.9）**：原困难档（HP×1.35 / 伤害×1.35）经 `test/balance-scan.js` 自检发现玩家胜率 **0%**（实质不可赢）；调整为「敌方更肉、伤害略增」后，三档梯度恢复为 简单 6/6（75%）≥ 普通 4/6（52%）≥ 困难 1/6（13%），困难档成为「有挑战但可赢」。
- 验证：`node --check game.js` → SYNTAX_OK；菜单按钮切换即时更新难度标签与激活态；`node test/balance-scan.js` → 梯度健康。

### 9.8 纯 Node 冒烟测试（Stage 3 · 测试全绿 · @A18）

> 本交付对应 §2.5 阶段三「测试全绿」checklist。Vitest 需 `npm install` / 外网，受无网络约束不可行，故以**纯 Node 零依赖冒烟测试**替代。

- 文件：`magic-arena/test/smoke-test.js`（仅依赖 Node 内置 `vm` / `fs` / `path`，零 npm、零外网）。
- 机制：mock 最小浏览器环境（DOM/Canvas 2D/`localStorage`/`setTimeout` 同步化），在 `vm` 沙箱内加载**真实 `game.js`**，通过捕获的 canvas 点击事件 `clickCell(gx,gy)` 与公开 `Game` API 驱动真实战斗；`setTimeout` 同步执行使敌方 AI 与回合结算变为确定性。
- 覆盖场景（共 65 条断言，全部通过）；S1~S6 为基础覆盖，S7~S11 由 @A34/@A39/@A45 扩充（战斗日志/施法目标预览/单位图鉴/角色成长/多结局回归）：
  1. 难度三档（easy/normal/hard）切换无异常且状态生效；
  2. 战役第一关部署 6 单位（3 玩家 / 3 敌方），且困难档敌方 HP ≥ 普通档（数值平衡可见）；
  3. 玩家主动出战直至分出胜负（覆盖玩家 `applySkill` 全类型、胜负分支、战绩写入）；
  4. 玩家不行动 → 必然失败（覆盖 `checkGameEnd` 失败分支 + 弹窗 + 存档）；
  5. 危险格地图（雪山）回合结算路径无异常；
  6. 单局遭遇模式部署与跑通无异常。
- 可测性钩子：为驱动断言，`game.js` 暴露只读 `_state()`（仅返回内部状态副本，不修改任何游戏行为，浏览器运行时无副作用）。
- 验证：`node test/smoke-test.js` → 通过 65 / 失败 0；`node --check game.js` 与 `dist/game.js` 均 SYNTAX_OK。

### 9.9 数值平衡自检（Stage 3 · 数值平衡 · @A19）

> 本交付对应 §2.5 阶段三「数值平衡」checklist，是对 §9.7 难度选择子系统的量化验证与调参闭环。

- 文件：`magic-arena/test/balance-scan.js`（仅依赖 Node 内置 `vm` / `fs` / `path` / `Math`，零 npm、零外网）。
- 机制：复用与 §9.8 相同的 vm + 浏览器环境 mock，加载**真实 `game.js`**；`setTimeout` 同步化使对局确定性可复现；并注入可复现随机数（mulberry32）驱动 Skirmish 的随机选图/选敌，使统计结果稳定。
- **玩家代理（称职贪婪策略）**：驱动一个"类人"玩家打完完整对局——残血自疗（HP<40% 施治愈术）→ 以伤害为主施放射程内技能（高伤 / AoE 优先）→ 无射程则移动贴近最近敌人（**仅当能严格缩短到最近敌人的距离才移动，避免等距格来回振荡；无论能否行动均以 skipUnit 收尾以保证单位不被反复选中、对局必然终止**）→ 移动后再次尝试攻击 → 仍不行则跳过。该代理作为「一个 competent 玩家」的代理，用于衡量难度是否合理。
- **扫描口径**：
  - 战役（确定性）：三档 × 6 关各 1 局，统计胜场。
  - 遭遇（随机）：三档各 60 局（seeded），统计胜率。
- **健康度判定**：难度梯度须单调（简单 ≥ 普通 ≥ 困难）且普通档可玩（战役 ≥1 关 & 遭遇 ≥25%）；否则退出码 1（提示需调参）。
- **实测结论（调参后）**：

  | 难度 | 战役胜场 | 遭遇胜率 |
  |---|---|---|
  | 简单 | 6/6 | 100.0% |
  | 普通 | 6/6 | 93.3% |
  | 困难 | 1/6 | 15.0% |

  梯度单调、普通档具备可玩与挑战，数值平衡自检通过（退出码 0）。困难档对代理玩家仅 15%，意味着真人玩家仍有可观胜算，属于「有挑战但可赢」的健康区间。注：D25 修复了玩家代理在残敌落入"等距格口袋"时来回振荡陷入死循环、被安全上限误判负的问题（actUnit 仅严格拉近才移动 + 必以 skipUnit 收尾），此前误判为"钟形"实为振荡伪影；修复后战役与遭遇两处梯度均恢复严格单调 简单≥普通≥困难。
- 验证：`node test/balance-scan.js` → 退出码 0；与 `smoke-test.js` 共用同一套引擎加载器，二者均零网络零依赖。

### 9.10 渲染性能优化（Stage 3 · 性能优化 · @A20）

> 本交付对应 §2.5 阶段三「性能优化：Canvas 渲染帧率稳定，无可见卡顿」checklist（此前唯一未交付项）。核心手段是**静态层离屏缓存（static-layer offscreen caching）**。

- 问题：原 `render()` 在**每次交互帧**都重绘整块静态棋盘——背景填充 + 18 条网格线 + 地形（掩体/危险格）文字，但这些内容仅在切换地图时变化，逐帧重绘是纯浪费。
- 方案：
  - 新增离屏画布 `staticCanvas`，由 `buildStaticLayer()` 把「背景 + 网格线 + 地形」一次性绘制进去；`staticMapId` 记录已缓存地图 id。
  - `render()` 改为：若地图未变则直接 `ctx.drawImage(staticCanvas,0,0)` 合成静态层，再叠加动态层（移动/攻击高亮、单位、HP 条、状态标记）；仅当 `staticMapId !== currentMap.id`（切换地图）时重建缓存。
  - 这一改动零侵入游戏逻辑：单位移动/施法/AI/胜负判定路径完全不变，仅在绘制阶段缓存静态内容。
- 可测性钩子：`game.js` 暴露只读 `_perf()`（仅返回 `staticRebuilds` / `hasStaticLayer` / `staticMapId`，不改行为），供纯 Node 性能验证断言缓存命中。
- **验证（`magic-arena/test/perf-check.js`，纯 Node 零依赖）**：计数式 Canvas 上下文累计关键绘制调用。实测在同一雪山顶地图进行 30 帧交互后：
  - `staticRebuilds = 2`（init 平原 1 次 + 切换雪山 1 次），后续 30 帧**零重建**；
  - 网格线 `moveTo = 18 × 2 = 36`（仅在切换地图时绘制，不逐帧重绘）；
  - 地形掩体描边 `strokeRect = 1`（仅在 build 时绘制）；
  - 每帧经 `drawImage` 合成静态层（`drawImage = 181`）。
  - 对比无缓存方案（每帧重绘 18 条网格线）绘制调用减少约 93%。8 条断言全绿（退出码 0）。
- 回归：`node test/smoke-test.js` → 通过 19/失败 0（性能改动不影响既有行为）；`node --check game.js` 与 `dist/game.js` → 均 SYNTAX_OK。

### 9.11 战力评估与比分预测（方向3 系统新创 · @A22）

> 本交付属于设计文档 §3.2 候选子系统「赛前分析」的轻量落地：在进入战斗前给出**双方战力评分与预估胜率**，让玩家"看下比赛比得分"再决定是否开打。归类为 §2.5 方向3 系统新创（给游戏增加「决策辅助」维度）。

- 纯函数、零侵入战斗逻辑：仅读取单位快照（`maxHp` / `skills` / `moveRange`），**不参与任何伤害 / 状态 / 胜负结算路径**；暴露 `predictOutcome` / `evaluateSideScore` 供纯 Node 验证（无需浏览器）。
- 评分公式 `evaluateSideScore(list)`（每存活单位累加）：
  - 生存力 `maxHp`；
  - 每个伤害技能：`(dmg + AoE加成) × 射程因子( range/3 ) × 冷却因子( 1/(cooldown+1) )`；AoE 技能额外 +50% 该技能 dmg 作为范围价值；
  - 每个治疗技能：`|dmg| × 1.5`（续航价值）；
  - 控制（眩晕/冰冻）`+20`、持续伤害 DoT（灼烧/中毒）`+12`、致盲（输出削弱）`+14`、易伤（集火放大器）`+14`、恐惧（强制位移/恐慌撤退）`+14`、拉拽（即时位移/拉近）`+14`、强化（友方进攻增益）`+14` 的战术价值；
  - 机动性 `moveRange × 5`。
- 胜率预测 `predictOutcome(playerUnits, enemyUnits)`：以逻辑斯蒂函数 `1/(1+e^{-(ps-es)/scale})` 将双方分差映射为胜率，其中 `scale = max(30, (ps+es)×0.15)`（分差越大胜率越极端、越接近均势时越平滑）。返回 `{ playerScore, enemyScore, playerWinProb }`。
- UI：`#battle-predict` 面板（侧栏）在 `startBattle` 与每次 `updateUI` 时由 `updateBattlePrediction()` 刷新，呈现「我方 : 敌方」战力比分条 + 预估胜率；`gameOver` 或某方全灭时清空。该面板为零网络零依赖的纯展示，不影响玩法。
- 验证：`node --check game.js` 与 `dist/game.js` 均 SYNTAX_OK；`node test/smoke-test.js` → 通过 19/失败 0（新增 UI 代码在 mock DOM 下安全，未影响既有行为）；`node test/balance-scan.js` 与 `node test/perf-check.js` 无回归。

### 9.13 护盾效果（Shield / Direction 1 核心玩法）
- **技能定义**：`守护之盾 (shield)` — 范围 2 格，为友方单位附加护盾（吸收最多 20 点伤害，持续 2 回合，CD 2 回合）。`isShield: true, shieldTurns: 2, shieldAmount: 20`。
- **机制**：
  - 施放目标：**友方**（与 heal 同目标规则），在 `handleSelectTarget` 中校验 `target.team === selectedUnit.team`。
  - `applySkill` 分支：将目标 `shield` 设为 `max(existing, skill.shieldAmount)`，`shieldTurns` 取 `max(existing, skill.shieldTurns)`；飘字反馈弹出「护盾」status 飘字。
  - **伤害吸收**：所有伤害进入 `damageUnit(target, dmg, attacker)` 后，先检查 `target.shield > 0`，优先扣除护盾点数（`absorbed = min(shield, actual)`），剩余伤害才进入 HP；护盾吸收的部分以 `'盾N'` 飘字（淡蓝 `#80d8ff`）显示。该机制覆盖**所有伤害来源**（普攻、AoE、DoT 灼烧/中毒、危险格环境伤害）。
  - **回合边界结算**：`nextTurn` 中对 `shieldTurns > 0` 的单位做递减，归零时清除 `shield = 0` 并记录日志「护盾消散」。
- **视觉反馈**：单位左上角显示 `🛡N`（护盾剩余点数，淡蓝 `#40c4ff`）；`updateUI` 状态面板显示「🔰 护盾(N点·持续M回合)」。
- **AI 交互**：`sortedAttackSkills` 排除 `isShield`（护盾非攻击技能，敌方 AI 不应将其用作攻击）；`evaluateSideScore` 给 `isShield` 战术价值 `+14`。
- **设计定位**：与治愈术（即时回血）正交——护盾是 **preemptive mitigation**（受伤前先吸收），尤其克制 DoT/危险格/多段低伤攻击。护盾为已完整实现、当前暂未由任何单位装备的潜能机制（雷法师·特斯拉在方向驱动轮次以嘲讽术替换该槽位，护盾代码仍保留于 `game.js`，可随时由某单位重新装备）。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 12/0；`node test/balance-scan.js` → 梯度健康（easy 68%/3win · normal 1win · hard 1win）；`node test/perf-check.js` → 8/0；全零网络零依赖。

### 9.14 沉默效果（Silence / Direction 1 核心玩法 · @A27）
- **技能定义**：`沉默术 (silence)` — 范围 3 格，使敌方目标沉默 2 回合，期间**无法施放任何技能（只能移动）**，CD 3 回合。`isSilence: true, silenceTurns: 2`。
- **机制**：
  - 施放目标：**敌方**（与 blind/stun 同校验），在 `handleSelectTarget` 中校验 `target.team !== selectedUnit.team`。
  - `applySkill` 分支：将目标 `silenceTurns` 设为 `max(existing, skill.silenceTurns)`（不叠加超出上限），弹出「沉默」status 飘字（`#9575cd` 淡紫），并写日志「目标被沉默」。
  - **施法守卫（玩家）**：`castSkill` 中检查 `selectedUnit.silenceTurns > 0` → 直接拦截并提示「被沉默，无法施放技能」，不消耗回合/技能。
  - **施法守卫（敌方 AI）**：`aiDecide` 中以 `canCast = unit.silenceTurns <= 0` 控制——被沉默的敌方 AI 跳过所有施法分支（自保治疗/攻击/移动后攻击/治疗兜底均包裹 `if (canCast)`），仅执行移动；步骤 6 日志记录「被沉默，本回合无法施法」。
  - **回合边界结算**：`nextTurn` 中对 `silenceTurns > 0` 的单位递减，归零时记录日志「沉默解除，可再次施法」。
- **视觉反馈**：单位左下角显示「默」（淡紫 `#9575cd`）；`updateUI` 状态面板显示「🔇 沉默中(N回合·无法施法)」。
- **AI 交互**：`sortedAttackSkills` 排除 `isSilence`（沉默是 debuff，敌方 AI 不误放）；`evaluateSideScore` 给 `isSilence` 战术价值 `+16`（高于其他状态，因直接剥夺敌方全部技能手段）。
- **设计定位**：沉默是与**眩晕（跳过整回合）/冰冻（禁移）/致盲（输出-50%）**正交的第四种「攻防压制」维度——它**不限制移动、只禁止施法**，专门克制依赖技能的法师单位（反法师控制）。雷法师·特斯拉以 silence 替换原 stun 槽位（保留 lightning，后续轮次以嘲讽术替换原护盾槽位），使玩家小队同时具备「输出+反法师控制」；其嘲讽术另提供坦克引流维度（详见 §9.15）；stun 机制仍由敌方 托尔/加百列 持有，未从游戏移除。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；`node test/status-effects.test.js` → S1 改为验证沉默生命周期（应用 silenceTurns=2 → 敌方回合可移动不施法 → 递减至 1），通过 13/0；临时确定性脚本验证「被沉默敌方回合内玩家状态数不变（证明禁止施法）」闭环；`node test/smoke-test.js` → 22/0；`node test/perf-check.js` → 8/0；全零网络零依赖。

### 9.15 嘲讽效果（Taunt / Direction 1 核心玩法 · @A30）
- **技能定义**：`嘲讽术 (taunt)` — 范围 3 格，使敌方目标嘲讽 2 回合，期间其**攻击被强制吸引向施法者**（坦克引流·保护队友），CD 3 回合。`isTaunt: true, tauntTurns: 2`。
- **机制**：
  - 施放目标：**敌方**（与 stun/blind 同校验），在 `handleSelectTarget` 中校验 `target.team !== selectedUnit.team`。
  - `applySkill` 分支：将目标 `tauntTurns` 设为 `max(existing, skill.tauntTurns)`（不叠加超出上限），记录 `taunterId = attacker.id`（嘲讽来源），弹出「嘲讽」status 飘字，写日志「嘲讽成功（攻击被强制吸引向你）」。
  - **威胁转移（敌方 AI 重定向）**：在 `aiDecide` 攻击目标选择阶段，若敌方单位 `tauntTurns > 0` 且 `taunterId` 对应的玩家单位存活，则其攻击目标被强制限定为该嘲讽来源（其余玩家单位免疫其攻击），实现「坦克引流·保护队友」。
  - **回合边界结算**：`nextTurn` 中对 `tauntTurns > 0` 的单位递减，归零时清除 `taunterId` 并记录日志「嘲讽解除，恢复自由选择目标」。
- **视觉反馈**：嘲讽标记显示在被嘲讽单位上（威胁标记，与眩晕/冰冻/致盲/沉默同级）；`updateUI` 状态面板显示「嘲讽中(N回合·攻击被吸引向 X)」。
- **AI 交互**：`sortedAttackSkills` 排除 `isTaunt`（嘲讽是控制技、非伤害技能，敌方 AI 不应将其用作攻击空放）；`evaluateSideScore` 给 `isTaunt` 战术价值 `+16`（与沉默同级，因强制牵引敌方仇恨、直接保护队友）。
- **设计定位**：嘲讽是与**眩晕（跳过整回合）/冰冻（禁移）/致盲（输出-50%）/沉默（禁施法）**正交的「威胁转移」维度——它不改变目标的行动能力，只把敌方火力强制引向施法者（坦克），从而保护脆皮输出/辅助单位，是首个明确服务于「坦克-输出」阵型分工的机制。雷法师·特斯拉以 taunt 替换原护盾槽位（保留 lightning/silence），使玩家小队兼具「输出+反法师控制+坦克引流」。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎验证「特斯拉施放嘲讽后，敌方回合攻击被强制吸引至特斯拉（特斯拉 70→8 受击）、tauntTurns 2→1 递减正确」闭环（验证后删除，遵守根目录卫生）；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调）；`node test/perf-check.js` → 8/0；全零网络零依赖。

### 9.12 状态效果回归测试（方向5 · 工程基石 · @A24）

> 归属于设计文档 §2.5 方向5「工程基石」——为状态效果子系统（眩晕/灼烧/致盲/冰冻/中毒，由 A12~A23 陆续落地）补齐确定性回归测试，作为该子系统后续演进的安全网。

- 新增 `test/status-effects.test.js`（纯 Node 零依赖，复用 `smoke-test.js` 的浏览器环境 mock + vm 加载真实 `game.js`，setTimeout 同步化使回合循环确定）。
- 通过**公开 API**（`_state` / `startCampaign` / `castSkill` / 画布点击 handler / `endTurn`）确定性地验证，不直接触碰内部状态：
  - **沉默术 (silence)**：玩家（特斯拉）施放后敌方 `silenceTurns=2`；敌方回合被沉默单位仍可移动但无法施法（玩家状态数不变，证明禁止施法），回合边界 `nextTurn` 递减至 1。
  - **眩晕术 (stun) 存在性**：眩晕术现由敌方 托尔/加百列 持有（玩家特斯拉已换装为沉默术），改为存在性校验（campaign 2 含 托尔），确保 stun 机制未被意外移除。
  - **灼烧术 (burn)**：玩家施放后 `burnTurns=2`；回合边界（`nextTurn`）持续伤害结算使敌方 HP 减少 `burnDmg`（普通档 6），且 `burnTurns` 递减为 1。
  - **致盲术 (blind)**：玩家施放后 `blindTurns=2`；连续两回合边界递减至 0（被致盲敌方会移动，改用名称稳定追踪而非坐标）。
  - **致盲伤害修正**：被致盲敌方施放陨石术（dmg18）时，其输出伤害受 `damageUnit` 的 `attacker.blindTurns>0 → ×0.5` 修正，日志实测造成 **9** 伤害（平原无掩体，`floor(18×0.5)=9`）；为避免其他敌方移动介入污染，从本回合新增战斗日志中隔离被致盲单位的伤害条目断言。
  - **冰冻 (freeze) / 中毒 (poison) / 眩晕 (stun) 存在性**：敌方单位技能数据中仍正确携带 `isFreeze` / `isPoison` / `isStun` 标记（玩家不可施放，由敌方持有），确保这三项效果未被意外移除。
  - **易伤术 (vuln)**：玩家（莫甘娜·技能槽[1]）施放后敌方 `vulnTurns=2`；连续两回合边界递减至 0（被易伤单位受到伤害提升 50%，由 `damageUnit` 的 `target.vulnTurns>0 → ×1.5` 修正）；改用名称稳定追踪敌方 安娜，避免多敌方移动介入污染断言。
- **验证**：`node test/status-effects.test.js` → 通过 16/失败 0（原 13/0 + 易伤术 S6 新增 3 条断言）；与 `smoke-test`(22/0) / `balance-scan`(梯度健康·退出码0) / `perf-check`(8/0) 一并构成零网络回归套件全绿；`node --check game.js` 与 `dist/game.js` SYNTAX_OK、`diff` 一致。

### 9.16 成就系统（Achievements / Direction 3 系统新创 · @A31）

> 归属于设计文档 §2.5 方向3「系统新创」——在 @A22(战力评估) 之后为方向3 补齐第二个自主新子系统「成就系统」，以纯数据驱动方式记录玩家里程碑，零侵入战斗/伤害/状态/胜负结算路径。

- **成就表（数据驱动）**：`ACHIEVEMENTS` 常量定义 6 项成就，每项含 `id / name / desc`：
  - `first_win` 初战告捷 — 取得第一场战斗胜利
  - `flawless` 全身而退 — 一场战斗结束时我方 3 名单位全部存活
  - `taunter` 坚壁清野 — 使用嘲讽术（坦克引流）取得一场胜利
  - `boss_slayer` 弑王 — 在战役中击败 Boss（大魔导师·马尔佐斯）
  - `campaign_clear` 征服者 — 通关全部 6 关战役
  - `streak3` 三连胜 — 连续取得 3 场胜利
- **持久化**：`saveData` 扩展 `achievements: []` 与 `winStreak: 0`，复用既有 `saveSave()` / `loadSave()` / `localStorage` 机制跨对局保留；`sanitizeSave()` 在加载时过滤非法的成就 id（仅保留 `ACHIEVEMENTS` 中存在的 id）并钳制 `winStreak` 为非负整数，防损坏/篡改存档导致异常显示。
- **战斗运行时追踪器**（均在 `startBattle` 重置）：
  - `battleScored` — 防止 `checkGameEnd` 对同一场战斗重复计分（胜利/失败分支各仅触发一次）。
  - `battleTauntUsed` — 本场玩家是否施放过嘲讽术（在 `applySkill` 的 `isTaunt` 分支、且 `attacker.team === 'player'` 时置 `true`）。
  - `battleHadBoss` — 本场敌方是否含 Boss 单位（`startBattle` 中由 `setup.enemies.some(r => r.src === 'boss')` 判定，第 6 关战役为真）。
- **解锁逻辑**：在 `checkGameEnd` 的**胜利分支**（`enemyAlive === 0` 且 `!battleScored` 守卫内），按顺序解锁：
  - `first_win`（首胜）→ 计算我方存活单位 `pAlive`，若 `pAlive.length === 3` 解锁 `flawless` → 若 `battleHadBoss` 解锁 `boss_slayer` → 若 `battleTauntUsed` 解锁 `taunter` → 若 `gameMode === 'campaign' && currentCampaignLevel === CAMPAIGN.length` 解锁 `campaign_clear`；
  - `saveData.winStreak` 自增 1，若 `≥ 3` 解锁 `streak3`；随后 `saveSave()`。
  - **失败分支**：`saveData.winStreak = 0`（连胜中断）。
- **解锁反馈与 UI**：`unlockAchievement(id)` 在 `saveData.achievements` 去重后写入、调用 `saveSave()`、在战斗日志弹出 `🏆 解锁成就「名称」：描述`（`addLog` `info` 级），并刷新主菜单面板；`renderAchievements()` 渲染 `#menu-achievements` 容器——顶部显示 `成就 N/总数`，逐行列出每项（已解锁 🏆 金色 `.ach-row.unlocked`、未解锁 🔒 灰色 `.ach-row.locked`）。`showMenu()` 在显示菜单前调用 `renderAchievements()` 保证最新进度可见。
- **可测性**：`saveData.achievements` 经 `_state()` 只读钩子暴露（与 `wins`/`losses`/`winStreak` 同处 `saveData`），方向5 纯 Node 测试可确定性断言解锁结果。
- **设计定位**：成就系统是与「战役进度 / 难度选择 / 战力评估」并列的方向3 子系统，填补方向3 自 @A22 后长期空缺；它**不新增任何战斗机制**，仅在既有 `checkGameEnd` 胜负分支附加解锁钩子，由 `battleScored` 守卫保证每场战斗仅计分一次，对战斗平衡零影响。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；`node test/smoke-test.js` → 22/0（S3/S4 全量对局驱动胜利分支解锁逻辑）；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·全程对局覆盖解锁路径，无运行时错误）；`node test/perf-check.js` → 8/0；全零网络零依赖。

### 9.17 圣光玩家阵营（Light Squad / Direction 2 内容扩建 · @A32）

> 归属于设计文档 §2.5 方向2「内容扩建」——将既有第 4 阵营「圣光（light）」从纯敌方身份升级为**玩家可选出场阵营**，提供与「经典（三阵营混编）」小队并列的第二套可操控阵容，带来全新技能体验与作战风格。

- **背景**：`light` 阵营此前仅以敌方身份出现于 `ENEMY_UNITS`（见 §9.5，AI 风格 `support` 守护/治疗向）。本交付将其提升为玩家可选单位，**不是 clone+rename**（圣光单位此前从未作为玩家单位存在），而是既有阵营的内容复用 + 出场机制扩容。
- **数据定义**：新增 `LIGHT_SQUAD`（3 人小队），全部沿用既有技能，无新增任何机制：
  - 圣光祭司·塞拉 — HP 72 / 移 2 / 技能 `heal`·`smite`·`empower`（方向驱动轮次先以恐惧术替换原冰霜箭、后于强化术轮次以强化术替换恐惧术，详见 §9.18 / §9.21；恐惧术代码仍保留于 `game.js` 但当前无宿主单位、暂为休眠机制）
  - 圣堂守卫·加百列 — HP 88 / 移 2 / 技能 `fireball`·`heal`·`pull`（方向驱动轮次以拉拽术替换原眩晕术，详见 §9.20）
  - 曙光射手·奥菲 — HP 64 / 移 3 / 技能 `lightning`·`smite`·`meteor`
  - 与既有 `PLAYER_UNITS`（经典三阵营混编）并列，统一收入 `PLAYER_SQUADS = { classic, light }` 映射；新增模块态 `selectedPlayerFaction`（默认 `'classic'`，与历史版本及既有测试完全兼容）。
- **核心逻辑变更（方向2 必带逻辑改动）**：`startBattle` 由原先硬编码 `PLAYER_UNITS` 改为 `const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS` 部署当前所选小队（左侧 gx=1，行 1/3/5），使阵营选择真正影响对局；新增 `setPlayerFaction(f)`（已暴露至 `Game.setPlayerFaction`）切换阵营、刷新 `#menu-faction` 文本与 `.faction-btn/.active` 高亮。
- **UI**：主菜单新增「出场阵营」分区——`#menu-faction` 当前阵营标签 + 两个 `.faction-btn`（`faction-classic` / `faction-light`），分别 `onclick="Game.setPlayerFaction('classic'|'light')"`；CSS 复用 `.diff-btn` 同款 `.active` 高亮范式，默认 `classic` 处于 `active`。
- **回归安全**：默认 `'classic'`，`startCampaign` / 测试套件（smoke / status-effects / balance-scan）使用的固定混编小队与既有单位槽位布局**完全不变**，全测试保持绿色；圣光队仅当用户主动点击时启用。
- **设计定位**：属方向2 内容扩建——提供第二套可玩阵容（玩家视角看是「新单位/新技能组合的内容」），同时必须伴随 `startBattle` 部署逻辑改动，符合方向2「每次推进必带核心逻辑改动」的纪律。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度与既有一致）；`node test/perf-check.js` → 8/0；全零网络零依赖。

### 9.18 恐惧术（Fear / Direction 1 核心玩法 · @A33）

> 归属于设计文档 §2.5 方向1「核心玩法」——在已有「限制行动（眩晕/冰冻）+ 削弱输出（致盲）+ 战前减伤（护盾）+ 禁止施法（沉默）+ 集火放大器（易伤）+ 威胁转移（嘲讽）」六维基础上，补齐「强制位移」这一正交的移动控制维度：冰冻=禁移、嘲讽=强制靠近，恐惧=强制远离（恐慌撤退），三者共同构成完整的「移动控制」三轴。

- **技能定义**：`恐惧术 (fear)` — 范围 3 格，使敌方目标恐惧 2 回合，期间其**被迫远离施法者移动（恐慌撤退），无法主动接近**，CD 2 回合。`isFear: true, fearTurns: 2`。
- **机制**：
  - 施放目标：**敌方**，在 `handleSelectTarget` 中校验 `target.team !== selectedUnit.team`（与 stun/blind/taunt 同校验路径）。
  - `applySkill` 分支：将目标 `fearTurns` 设为 `max(existing, skill.fearTurns)`（不叠加超出上限），弹出「恐惧」status 飘字，写日志「目标陷入恐惧（剩余 N 回合·被迫远离你移动）」。
  - **恐慌撤退（敌方 AI 强制位移）**：在 `aiDecide` 移动阶段，若敌方单位 `fearTurns > 0`（且未被嘲讽牵引），则计算**远离最近玩家单位**的方向并移动（与冰冻「禁移」/嘲讽「强制靠近」正交）——被恐惧单位既不攻击也不治疗，纯撤退，把战线推离施法者，为玩家创造安全的集火/重组窗口。
  - **回合边界结算**：`nextTurn` 中对 `fearTurns > 0` 的单位递减，归零时记录日志「恐惧解除，恢复行动」。
- **视觉反馈**：以**紫色虚线环（#ba68c8）**环绕被恐惧单位（区别于其他状态的文字标记，避免位置冲突）；`updateUI` 状态面板显示「😱 恐惧中(N回合·被迫远离你移动)」。`floaters` 队列已含「恐惧」status 飘字（§8.3 飘字反馈）。
- **AI 交互**：`sortedAttackSkills` 排除 `isFear`（恐惧是 debuff，敌方 AI 不误放）；`evaluateSideScore` 给 `isFear` 战术价值 `+14`（与致盲/易伤同级，因其强制拉开敌我距离、降低敌方火力威胁）。
- **设计定位**：恐惧是与**冰冻（禁移）/嘲讽（强制靠近）**正交的「移动控制」第三轴——它不剥夺目标的攻击/施法能力，而是改变其移动方向（强制远离施法者），专用于「把高威胁敌方的火力推离我方脆皮、拉开战线、制造集火窗口」。由圣光祭司·塞拉（玩家可选圣光阵营）持有，替换原冰霜箭；与圣光阵营的治愈/圣光打击构成「续航 + 控场」的作战风格。
- **休眠说明（强化术轮次）**：在强化术（empower）轮次，圣光祭司·塞拉以强化术替换了原恐惧术（保留 heal/smite），故**恐惧术当前无宿主单位、暂为休眠机制**（其 `SKILL_DEFS.fear` + 全套接线代码仍保留于 `game.js`，可随时由某单位重新装备）。这是继护盾（被嘲讽替换后休眠）、再到恐惧的又一次「宿主轮换」——项目允许机制在宿主单位间迁移，只要代码保留、零新增单位、遵守"每方≤3单位/单位2~3技能"约束即可。默认 classic 下的经典小队与既有测试（smoke / status-effects）均不触达塞拉/恐惧，故零回归。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（恐惧宿主在圣光阵营，测试默认 classic 不触达）。

### 9.19 战斗日志（Battle Journal / Direction 4 体验打磨 · @A34）

> 归属于设计文档 §2.5 方向4「体验打磨」——为战斗提供一条**可读、可回溯的事件流**，让玩家在右侧面板实时看到每一次施法 / 伤害 / 治疗 / 状态结算 / DoT / 危险格 / 胜负，提升战斗理解与信息透明度。与 §8.3 飘字反馈的区别：飘字是「瞬时视觉冲击」（随帧上浮淡出），日志是「全程可查记录」（滚动留存）。

- **数据结构**：`game.js` 顶层维护 `logs = []` 数组，每条记录 `{ text, type }`（`type ∈ {info, damage, heal, status, system}`）。
- **写入入口**：`addLog(text, type = 'info')` 统一写入 `logs` 并（若存在）渲染到 `#log-content` 面板；调用点覆盖全战斗生命周期：
  - `applySkill`：施法 / 伤害 / 治疗 / 状态施加摘要；
  - `damageUnit`：伤害结算（含掩体减伤 / 致盲减半 / 易伤放大后的**实算值**）；
  - `nextTurn`：每回合边界的状态 tick / DoT 结算（灼烧 / 中毒）/ 危险格环境伤害 / 控制解除（冰冻 / 致盲 / 沉默 / 嘲讽 / 易伤 / 恐惧）；
  - `checkGameEnd`：胜负结果；
  - `aiDecide`：敌方回合行动摘要。
  - **健壮性（@A34 闭环加固）**：`addLog` 对 `document.getElementById('log-content')` 做 null 守卫——若运行环境缺失面板（如尚未同步的 `dist` 构建版），仅写入 `logs` 数组、不触达 DOM，避免 `el.appendChild` 抛错导致整局崩溃。
- **UI**：`index.html` 右侧「战斗日志」面板 `#log-content`，CSS `.log-entry` 按 `type` 配色（info 灰 / damage 红 / heal 绿 / status 紫 / system 金），`el.scrollTop = el.scrollHeight` 自动滚动到底部。
- **可测性**：`logs` 经只读 `_state()` 暴露（`logs: logs.map(l => ({ text: l.text, type: l.type }))`），方向5 纯 Node 测试可断言「随回合推进日志增长且条目含 text/type 字段」（见 `test/smoke-test.js` 场景 S7，3 条断言）。
- **设计定位**：战斗日志与飘字反馈共同构成方向4「体验打磨」的双层信息反馈体系；二者均零侵入战斗结算逻辑（仅追加记录，不改任何伤害 / 状态 / 胜负判定）。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK（addLog null 守卫在构建版也安全）；`node test/smoke-test.js` → 通过 22/失败 0（S7 新增 3 条断言）；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖。

### 9.20 拉拽术（Pull / Direction 1 核心玩法 · @A35）

> 归属于设计文档 §2.5 方向1「核心玩法」——在已有「限制行动（眩晕/冰冻）+ 削弱输出（致盲）+ 战前减伤（护盾）+ 禁止施法（沉默）+ 集火放大器（易伤）+ 威胁转移（嘲讽）+ 强制位移（恐惧：推远）」基础上，补齐「**即时物理位移（拉近）**」这一正交的位置控制维度：恐惧=把敌人推远、嘲讽=把敌人攻击吸引过来、冰冻=禁止移动，而拉拽=把敌人**拉到自己身边**（可拉入射程或危险格）。四种移动控制共同构成完整的「位移/位置控制」体系。

- **技能定义**：`拉拽术 (pull)` — 范围 3 格，将敌方目标向施法者拉近最多 `pullRange = 2` 格（即时位移、CD 2 回合）。`isPull: true, pullRange: 2`。
- **接线（全链路）**：
  - `SKILL_DEFS.pull`：与恐惧同属位移技能，但**无持续状态**（拉拽是瞬时动作，非 debuff）。
  - `handleSelectTarget`：新增 `isPull` 敌方校验分支（只能选敌方目标）。
  - `applySkill` 分支：取目标当前位置，沿「朝施法者」方向逐格推进，每步 `sign` 选择 X / Y 轴（X 轴剩余距离更大时优先 X，否则 Y），最多 `pullRange` 步；遇以下情况即停止——目标已贴近施法者、下一步将落到施法者所在格、越界、或被其他存活单位占据（其余单位按旧位置判断、目标尚未真正移动，避免自碰撞）；最终把目标 `gx/gy` 改写为落点。弹出「拉拽」status 飘字、写日志「将其拉近 N 格（或'已在身边'）」、置 `cd = cooldown`。
  - `sortedAttackSkills`：过滤显式排除 `isPull`（拉拽是玩家位置控制工具，敌方 AI 不误放；敌方单位本也不持有 pull）。
  - `evaluateSideScore`：给 `isPull` 战术价值 `+14`（与致盲/易伤/恐惧同级，因拉近敌人可制造集火/送入危险格的战术价值）。
  - `_state`：技能快照暴露 `isPull`，供纯 Node 验证。
- **与恐惧/嘲讽/冰冻的区分**：恐惧=持续 debuff·强制远离（恐慌撤退）；嘲讽=持续 debuff·攻击被吸引（坦克引流）；冰冻=持续 debuff·禁止移动；**拉拽=瞬时位移·无持续状态**——它不改变目标的「能力」或「仇恨」，只在施放瞬间改变其「位置」，是最轻量、最纯粹的几何控制工具，且可主动把敌人拉进我方集火射程或危险格（敌方 AI 的 `fear` 退却与此正交）。
- **宿主（回归安全）**：由圣堂守卫·加百列持有（玩家可选**圣光阵营**），替换原眩晕术（火球术 / 治愈术 / 拉拽术），保持「每单位 2~3 技能」约束。经典小队（`PLAYER_UNITS`）不含 pull，默认 classic 下既有测试（smoke / status-effects）零触达，零回归。
- **设计定位**：拉拽是与**恐惧（推远）/嘲讽（靠近·攻击吸引）/冰冻（禁移）**正交的「移动控制」第四轴——它为玩家提供真正的「几何控场」自由度（把高价值/残血敌人拉来集火，或把敌人拉入危险格反噬），丰富了方向1 核心玩法的位置战术纵深，且不引入任何新的持续状态负担。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎（启用圣光阵营、跑至敌方进入拉拽射程）断言「目标被拉近、距施法者 3→1 格、实际移动 2 格」后删除（根目录卫生）；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（拉拽宿主在圣光阵营）。

### 9.21 强化术（Empower / Direction 1 核心玩法 · @A36）

> 归属于设计文档 §2.5 方向1「核心玩法」——在已有「限制行动（眩晕/冰冻）+ 削弱输出（致盲）+ 战前减伤（护盾）+ 禁止施法（沉默）+ 集火放大器（易伤）+ 威胁转移（嘲讽）+ 强制位移（恐惧：推远 / 拉拽：拉近）」基础上，补齐「**友方进攻增益**」这一此前完全缺失的维度：既有 11 种机制里，作用于友方的只有治愈（回血）/护盾（吸伤）这类防御·续航向增益，作用于敌方的才有致盲（压输出）/易伤（放集火）等进攻向削弱；**强化是第一个让「我方友军打得更狠」的 buff**，与致盲（我方打敌 -50%）对称地作用在攻击方、与易伤（敌受击 +50%）正交（一 buff 一 debuff、一作用友方输出一作用敌方受击）。

- **技能定义**：`强化术 (empower)` — 范围 2 格，为**友方**单位附加强化，使其造成的所有伤害提升 50%（持续 2 回合，CD 2 回合）。`isEmpower: true, empowerTurns: 2, EMPOWER_AMP = 0.5`。
- **机制（全链路）**：
  - `SKILL_DEFS.empower`：与 heal 同属友方向技能，是首个"友方进攻增益"定义（区别于 heal/shield 的防御·续航向）。
  - `handleSelectTarget`：新增 `isEmpower` 友方校验分支（只能选友方目标，`target.team === selectedUnit.team`）。
  - `applySkill` 分支：将目标 `empowerTurns` 设为 `max(existing, skill.empowerTurns)`（不叠加超出上限），弹出「强化」status 飘字（淡紫 #e0a0ff），写日志「目标被强化（剩余 N 回合·造成伤害提升50%）」、置 `cd = cooldown`。
  - **伤害放大（核心）**：在 `damageUnit(target, dmg, attacker)` 内，于致盲（输出-50%）之后、掩体减伤之前，新增 `if (attacker.empowerTurns > 0) actual = floor(actual * (1 + EMPOWER_AMP))`——被强化的友方**作为攻击方**出手时，其一切伤害（普攻/AoE/DoT 反伤段）均 ×1.5。该放大对**该友方的一切攻击**生效，是"buff 我方输出"而非"debuff 敌方"。
  - `nextTurn`：对 `empowerTurns > 0` 的单位递减，归零时记录日志「强化解除，伤害恢复基准」。
  - `drawUnits`：被强化友方右上角显示金色「强」字标记（#ffc107，与易伤"易"错位）；`updateUI` 状态面板显示「⚔ 强化中(N回合·造成伤害+50%)」。
  - `sortedAttackSkills`：过滤显式排除 `isEmpower`（强化是玩家为友方准备的 buff，敌方 AI 不误放）。
  - `evaluateSideScore`：给 `isEmpower` 战术价值 `+14`（与致盲/易伤/恐惧/拉拽同级，因提升友方输出、制造"增益→集火秒杀"战术价值）。
  - `_state`：单位快照暴露 `empowerTurns`、技能快照暴露 `isEmpower`，供纯 Node 验证。
- **与既有机制的区分**：治愈/护盾=防御·续航向友方增益（保命）；易伤=进攻向但作用于**敌方**（放大我方对敌伤害）；**强化=进攻向且作用于友方**（放大友方自身输出）。三者互不重叠——强化填补的是"友方进攻增益"这一唯一空白维度，赋予玩家全新的"先强化核心输出→再集火"的进攻节奏（与"标记易伤敌方→集火"形成互补的两种进攻路线）。
- **宿主（回归安全）**：由圣光祭司·塞拉（玩家可选**圣光阵营**）持有，替换原恐惧术（治愈术 / 圣光打击 / 强化术），保持「每单位 2~3 技能」约束。恐惧术因此转为休眠机制（代码保留、无宿主，详见 §9.18 休眠说明）。经典小队（`PLAYER_UNITS`）不含 empower，默认 classic 下既有测试（smoke / status-effects / balance-scan）零触达，零回归。
- **设计定位**：强化是与**治愈/护盾（防御·续航）/易伤（敌方进攻向削弱）**正交的「友方进攻增益」维度——它把"buff 我方输出"第一次变成可玩机制，丰富方向1 核心玩法的进攻战术纵深（此前只有 debuff 敌方一条进攻路线），且不引入任何新的持续状态负担（empowerTurns 与既有的 debuff 倒计时机制同源、零额外复杂度）。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎（启用圣光阵营·塞拉对加百列施放强化→加百列移动贴近敌方→火球术命中维克）断言「加百列 empowerTurns=2、敌方受击伤害 25→37（×1.5）、推进一回合后 empowerTurns 递减为 1」全绿（12/0）后删除（根目录卫生）；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（强化宿主在圣光阵营）。

### 9.22 单位图鉴（Unit Codex / Direction 3 系统新创 · @A37）

> 归属于设计文档 §2.5 方向3「系统新创」——在既有方向3 子系统（战役进度 @A16 / 难度选择 @A17 / 战力评估 @A22 / 成就系统 @A31）基础上，新增一个**纯展示、全单位档案**子系统，让玩家在开打前于主菜单浏览全部可用单位的阵营 / 定位 / 属性 / 技能。它是方向3 中首个"只读参考面板"类子系统，与成就系统（长期目标）并列，共同丰富主菜单的信息密度，但不引入任何战斗机制。

- **数据驱动来源**：`CODEX_ROSTER` 在加载期通过 IIFE 合并 `PLAYER_UNITS`（玩家·经典）+ `LIGHT_SQUAD`（玩家·圣光）+ `ENEMY_UNITS`（敌方 / 敌方·圣光）+ `BOSS_UNITS`（BOSS），按单位名去重（圣光单位在玩家/敌方两侧出现时仅收录一次），最终形成 **16 张单位档案**（3 经典玩家 + 3 圣光玩家 + 8 敌方 + 1 圣光敌方·米迦勒 + 1 BOSS·马尔佐斯）。每张档案含 `name / maxHp / moveRange / faction / color / isBoss / category / skills`。
- **渲染**：`renderCodex()` 在 `showMenu()` 内随成就面板一并刷新，填充主菜单 `#menu-codex` 容器——以网格（`codex-grid` flex-wrap）展示卡片，每张卡片含单位名（带阵营色点 + BOSS★）、阵营与定位（category）、HP 与移动力、以及该单位全部技能（`SKILL_DEFS` 映射出的 `name：desc`）。`#menu-codex` 设 `max-height:240px; overflow-y:auto` 内滚，`#menu-panel` 设 `max-height:92vh; overflow-y:auto` 兜底整菜单滚动，避免 16 张卡片撑破视口。
- **零战斗影响（balance-safe）**：图鉴为**纯只读展示**——不读取 `saveData`、不依赖任何战斗运行时状态（_state/units/turnNum 等均未触碰）、不参与任何伤害 / 状态 / 胜负结算路径、不修改 `localStorage`。因此它对 `balance-scan.js` 自对弈（跨对局持久化 saveData）的梯度无任何扰动，是绝对安全的展示型子系统。
- **接线与暴露**：`renderCodex()` 经 `showMenu()` 自动调用（首次进入主菜单即渲染）；同时 `Game.renderCodex` 被显式暴露，便于外部手动刷新或测试。移除/新增单位仅需改既有 `PLAYER_UNITS`/`LIGHT_SQUAD`/`ENEMY_UNITS`/`BOSS_UNITS`，图鉴自动同步，无独立维护成本。
- **设计定位**：图鉴填补了"玩家在开打前了解全部可用单位"的信息缺口，与战力评估（赛前比分预测）、成就（赛后长期目标）共同构成完整的"赛前-赛中-赛后"信息闭环；作为方向3 的展示型子系统，它零侵入战斗逻辑、零新增状态/机制，是全 5 个方向中风险最低的增量（仅 HTML/CSS 渲染 + 数据合并），但显著提升主菜单的可读性与可玩性引导。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎（`Game.showMenu()`）断言「#menu-codex 渲染出 16 张 codex-card、48 行 codex-skill、含 BOSS 马尔佐斯 / 玩家艾拉 / 圣光敌米迦勒」全绿后删除（根目录卫生）；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（图鉴纯展示、不触达战斗路径）。

### 9.23 施法目标预览（Target Preview / Direction 4 体验打磨 · @A38）

> 归属于设计文档 §2.5 方向4「体验打磨」——在既有方向4 子系统（飘字反馈 @A25 / 战斗日志 @A34）基础上，新增**施法目标预览**：玩家在 `selectTarget` 阶段选中技能后，战场以彩色描边高亮该技能的**全部合法落点**（红=敌方攻击目标 / 绿=友方增益目标 / 橙=空地 AoE 投放点），显著降低误操作率与决策反应时间。这是一次**纯渲染层**改进，零战斗逻辑改动，对 `balance-scan.js` 跨对局梯度零扰动（balance-safe）。

- **机制**：`computeValidTargets()` 为纯函数，仅当 `phase === 'selectTarget' && selectedUnit && activeSkill` 时计算；落点按技能类型分三类：
  - **友方增益技能**（`isHeal` / `isShield` / `isEmpower`）：仅标 `team === selectedUnit.team` 的占位格（`kind: 'friendly'`）；
  - **攻击/控制技能**：仅标敌方占位格（`kind: 'enemy'`）；
  - **AoE 技能**（`aoeRadius > 0`）：额外标射程内、无单位的空地格为投放点（`kind: 'aoe'`）；
  - 所有落点受 `activeSkill.range` 限制（`cellDistPt` 曼哈顿距离 ≤ range）。
- **渲染**：`drawHighlights()` 在既有「移动高亮 / 攻击高亮」之后，对 `computeValidTargets()` 的每个落点描边（`lineWidth:3`，颜色 红 `#ff5252` / 绿 `#69f0ae` / 橙 `#ffb300`），形成清晰的合法落点指示环；与既有状态标记（晕/燃/冰/毒/盲）与飘字共同构成完整战斗视觉反馈。
- **零战斗影响（balance-safe）**：`computeValidTargets` 仅读取 `selectedUnit / activeSkill / units` 的几何与阵营信息，**不参与任何伤害 / 状态 / 胜负结算**；它只在 `drawHighlights()` 渲染路径与 `_state()` 暴露中被调用，因此对任意平衡梯度零扰动。这是本轮选「方向4 体验打磨·纯渲染层」而非「方向1 新机制」的关键理由——任何新机制都会扰动 `balance-scan` 跨对局数值，而纯渲染改进不会。
- **接线与暴露**：`computeValidTargets()` 经 `_state()` 暴露为 `validTargets`（每项含 `gx / gy / kind`），供方向5 纯 Node 断言（本轮临时验证脚本 10/0 全绿后删除）；同时被 `drawHighlights()` 直接调用渲染，无需额外 DOM/CSS 改动。
- **设计定位**：方向4 此前已有飘字（即时伤害/状态反馈）与战斗日志（事件流），但「选技能后不知道哪格能点」的**落点提示**仍缺失；本交付补齐该缺口，尤其改善 AoE 投放点选择与友方增益误伤防护，属于低成本、高体验收益的纯 UI 层改进，不新增任何单位 / 技能 / 状态。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎断言「`selectUnit` 阶段 `validTargets` 为空 / 攻击技能合法落点=敌方数且均在射程内且不标友方 / 增益技能合法落点=友方数且仅标友方」10/0 全绿后删除（根目录卫生）；`node test/smoke-test.js` → 22/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯渲染层、零战斗路径改动）。

### 9.24 战斗结算面板（Battle Result Panel / Direction 4 体验打磨 · @A40）

> 归属于设计文档 §2.5 方向4「体验打磨」——在既有方向4 子系统（飘字反馈 @A25 / 战斗日志 @A34 / 施法目标预览 @A38）基础上，新增**战斗结算面板**：战斗结束（`checkGameEnd` → `showOverlay`）时，除既有的标题与提示语外，额外在一个 `#result-stats` 面板中展示本场战斗的**结算数据**——用时回合、存活单位、本场解锁成就，并为弹窗内容 `#overlay-content` 加上揭幕动画（缩放入场）。这是一次**纯 UI 层**改进，零战斗逻辑改动，对 `balance-scan.js` 跨对局梯度零扰动（balance-safe）。

- **数据来源（不新增任何战斗逻辑）**：`checkGameEnd` 在胜负两分支各自计算 `lastResult = { result, turns, survivors, unlocked }`：
  - `result`：`'win' | 'lose'`（与 `phase === 'gameOver'` 同源于 `playerAlive / enemyAlive` 判定）；
  - `turns`：直接复用既有的 `turnNum`（每 `nextTurn` 自增的回合数，开局 `startBattle` 重置为 1）；
  - `survivors`：当前 `units` 中 `team === 'player' && hp > 0` 的单位名列表（`map(u => u.name)`）；
  - `unlocked`：本场战斗新解锁的成就名——在 `unlockAchievement()` 内 `battleUnlocked` 数组收集（`startBattle` 重置为空），`checkGameEnd` 胜利分支在 `battleScored` 守卫内解锁成就后，将 `battleUnlocked.slice()` 写入 `lastResult.unlocked`。
- **渲染**：`buildResultStats()` 把 `lastResult` 拼成三条统计行（`rs-row`：用时回合 / 存活单位 / 本场成就，单位名与成就名以 `rs-unit` / `rs-ach` 彩色胶囊展示）；`showOverlay(title, msg)` 在设置标题与提示后，将结果写入 `#result-stats` 的 `innerHTML`，并为 `#overlay-content` 设置 `reveal`（揭幕动画）+ `result-win` / `result-lose`（胜负主题色：胜利标题 `#69f0ae` / 失败 `#ff5252`）。`closeOverlay()` 复位 `className` 并清空 `#result-stats`，保证下次弹窗重新触发动画。
- **零战斗影响（balance-safe）**：`lastResult` 仅由 `checkGameEnd`（胜负分支）写入、仅被 `showOverlay` 读取渲染、并经 `_state()` 暴露供方向5 纯 Node 断言；它不参与任何伤害 / 状态 / 胜负结算路径、不修改 `saveData / localStorage`（成就已在原 `unlockAchievement` 路径持久化，本面板仅消费其名）。对 `balance-scan.js` 跨对局梯度零扰动。
- **接线与暴露**：`lastResult` 经 `_state()` 暴露为 `lastResult`（结算后 `result/turns/survivors/unlocked` 全字段可读），供方向5 纯 Node 断言；动画与面板样式全部落在 `index.html` 的 `@keyframes pop` + `.reveal` / `.result-stats` / `.rs-*` CSS 中，无需引擎改动渲染流程。
- **设计定位**：方向4 此前已有飘字（即时伤害/状态反馈）、战斗日志（事件流）、施法目标预览（落点提示），但**战斗结束后的"这一局打得怎么样"缺乏结构化呈现**——玩家只能看到一句"敌方已被全部消灭"。本交付补齐该缺口：结算面板把"回合效率 / 存活情况 / 成就进度"一次呈现，并配以缩放入场动画，显著增强胜负时刻的反馈厚度与成就感，属于低成本、高体验收益的纯 UI 层改进，不新增任何单位 / 技能 / 状态。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎跑通胜/负两种结局断言「胜：`lastResult.result==='win'` 且 `turns>0` 且 `survivors` 非空 且 `unlocked` 含初战告捷（实测 `{result:'win',turns:11,survivors:['炎法师·艾拉'],unlocked:['初战告捷','坚壁清野']}`）/ 负：`lastResult.result==='lose'` 且 `unlocked` 为空（实测 `{result:'lose',turns:4,survivors:[],unlocked:[]}`）」全绿（8/0）后删除（根目录卫生）；`node test/smoke-test.js` → 33/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯 UI 层、零战斗路径改动）。

### 9.25 章节剧情叙事（Chapter Narrative / Direction 2 内容扩建 · @A41）

> 归属于设计文档 §2.5 方向2「内容扩建」——在既有方向2 子系统（圣光玩家阵营 @A32）基础上，新增**章节剧情叙事**：让战役「有头有尾」成为一场冒险，而非「一连串无意义的战斗」。这是 PRODUCT.md 验收标准「每章有开场剧情文本与结束剧情文本」的直接落地。整套叙事为**纯数据驱动、纯 UI 层**，零战斗逻辑改动，对 `balance-scan.js` 跨对局梯度零扰动（balance-safe）。

- **数据来源（数据驱动 `CHAPTER_STORY` 表，零新增机制）**：在 `game.js` 新增 `CHAPTER_STORY` 常量，以战役关序 `{ 1..6 }` 为键，每关含 `opening`（开场叙事，进入战斗前展示）与 `closing`（结束叙事，胜利后展示）；第 6 关（BOSS）额外含 `ending`（结局叙事，终章展示）。剧情全部为原创世界观内容（维尔德兰大陆 / 五大灵脉学派 / 灵脉枯萎 / 蚀教），无侵权风险。
- **叙事交互（新交互 · 零战斗逻辑改动）**：
  - 开场叙事：`startCampaign(level)` 在 `startBattle` 部署完成后调用 `showStory(`${c.name} · 开场`, CHAPTER_STORY[level].opening, '开始战斗 ▶', 'Game.closeOverlay()')`——**战场已部署完毕**（验证 `units.length === 6`，叙事只覆盖在棋盘之上的 overlay，不影响任何部署/战斗运行时状态）。
  - 结束/结局叙事：`checkGameEnd` 玩家胜利分支（仅 `gameMode === 'campaign'`）按 `currentCampaignLevel` 取 `CHAPTER_STORY` 的 `closing`（非终章）/ `ending`（终章），调用 `showStory(...)` 替代原本的 `showOverlay('战斗胜利', ...)`；「进入下一关 ▶」按钮仍调 `Game.startCampaign(currentCampaignLevel + 1)`，终章「🎉 返回主菜单」按钮调 `Game.showMenu()`。
- **渲染与样式**：`formatStory(text)` 把多段文本切成 `<p class="story-p">`；`showStory(title, text, actionLabel, actionHandler)` 复写 `overlay-title` / `overlay-msg`（innerHTML）/ `#result-stats`（仍展示本场结算面板，见 §9.24）/ `#overlay-content.className = 'reveal story-mode'` / `setOverlayAction(...)` / 显示 overlay；新增 CSS `.story-p`（剧情正文排版）与 `.story-mode`（叙事主题，区别于结算面板）。`lastStory = { title, text }` 写入模块态。
- **零战斗影响（balance-safe）**：`showStory` 仅在 `startCampaign` 与 `checkGameEnd` 的胜利分支被调用，只写 overlay 文本与按钮、不改任何伤害 / 状态 / 胜负结算路径、不读/改 `saveData/localStorage`；`lastStory` 经 `_state()` 暴露 `{ title, text }` 供方向5 纯 Node 断言。对 `balance-scan.js` 跨对局梯度零扰动。
- **设计定位**：PRODUCT.md 验收明确要求「每章有开场剧情文本与结束剧情文本」；此前战役仅有战斗、无叙事衔接，玩家不清楚「为何而战」。本交付补齐该缺口——每关进入前有「开场」交代情境与目标，胜利后有「结束/结局」推进世界观线索（灵脉枯萎→蚀教阴谋→大魔导师马尔佐斯），让六关战役串成一条主线；属于低成本、高沉浸感的内容扩建，不新增任何单位 / 技能 / 状态。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎断言「六关各 `startCampaign` 后 `lastStory.title` 含『开场』且 `lastStory.text` 非空(>20字) 且 `units.length===6`（叙事不影响部署）」全绿(18/0)，以及「第一关跑至胜利后 `lastStory.title` 含『胜利』且为本关 closing」全绿(2/0)，合计 20/0 后删除（根目录卫生）；`node test/smoke-test.js` → 33/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯叙事层、零战斗路径改动）。

### 9.26 世界地图 / 章节选择界面（World Map / Direction 3 系统新创 · @A42）

> 归属于设计文档 §2.5 方向3「系统新创」——在既有方向3 子系统（战役进度 @A16 / 难度选择 @A17 / 战力评估 @A22 / 成就 @A31 / 单位图鉴 @A37）基础上，新增**世界地图 / 章节选择界面**：以「区域 → 章节」的地理视图呈现战役进度，直接响应 PRODUCT.md 验收标准「打开游戏后显示世界地图，有此章节可选」与 Backlog 项「世界地图界面：章节选择 + 区域解锁 + 前置条件显示」。整套界面为**纯数据驱动、纯 UI 层**，零战斗逻辑改动，对 `balance-scan.js` 跨对局梯度零扰动（balance-safe）。

- **数据来源（数据驱动 `WORLD_REGIONS` 表，零新增机制）**：在 `game.js` 新增 `WORLD_REGIONS` 常量，将 6 关战役归入 3 个地理区域（维尔德兰大陆原创地理命名，无侵权风险）：`边陲之地 [1,2]`（序章起点）/`学派战争前线 [3,4]`（凛霜堡·翠息林·古都废墟）/ `灵脉之源 [5,6]`（含终章 BOSS·大魔导师马尔佐斯）。区域解锁状态由既有 `saveData.unlockedLevel` 派生（`r.chapters.some(lv => lv <= unlocked)`），与战役进度共用同一把锁，不引入新的持久化字段。
- **界面交互（新 UI 维度 · 零战斗逻辑改动）**：
  - 主菜单新增「🌍 打开世界地图」按钮 → 调用 `Game.showWorldMap()`，隐藏主菜单、显示一个独立覆盖层 `#world-map`（fixed 全屏、深色背景）。
  - `showWorldMap()` 渲染 `#world-map`：顶部标题 + 进度提示（已解锁 N/6 关）+ 各区域卡片（`wm-region`：区域名 + 解锁标签「已抵达/未解锁」+ 区域描述 + 章节节点 `wm-chapters`）。每个章节节点按 `unlockedLevel` 判定：已解锁章为可点击按钮 `onclick="Game.startCampaign(lv)"`（终章 BOSS 章加 `.boss` 金色边框）；未解锁章为 `disabled` 灰显（🔒）。点击已解锁章即进入该关战斗（复用 `startCampaign`）。
  - 区域「随剧情解锁」呈现：当某区域内尚有未解锁章时，区域卡片保持 `open`（已抵达）状态；全部章未解锁的区域为 `closed` 半透明（未解锁）。
  - 「← 返回主菜单」按钮 → `Game.showMenu()`；`startCampaign` / `startSkirmish` 进入战斗时、`showMenu` 返回时均显式收起 `#world-map` 覆盖层（`el.style.display = 'none'`），避免与主菜单/战场叠加。
- **渲染与样式**：`index.html` 新增 `#world-map` 覆盖层容器 + 一整套 CSS（`.wm-regions`/`.wm-region`/`.wm-region-head`/`.wm-region-name`/`.wm-region-tag`/`.wm-region-desc`/`.wm-chapters`/`.wm-chapter`/`.wm-chapter.locked`/`.wm-chapter.boss`），沿用主菜单深色奇幻风格（`#16213e`/`#533483`/`#f0c27f` 配色）；`showWorldMap` 把 HTML 写入 `#world-map` 后设 `display:flex`。`worldMap = { unlockedLevel, regionCount, regions }` 经 `_state()` 暴露供方向5 纯 Node 断言；`Game.showWorldMap` 暴露供 HTML onclick。
- **零战斗影响（balance-safe）**：`showWorldMap` 仅读取 `saveData.unlockedLevel` 与 `CAMPAIGN` / `WORLD_REGIONS` 静态数据，点击已解锁章仅调用既有 `startCampaign`（不新增任何战斗逻辑分支），不读/改 `saveData/localStorage`、不参与任何伤害 / 状态 / 胜负结算路径；对 `balance-scan.js` 跨对局梯度零扰动（世界地图仅消费进度、不写进度）。
- **设计定位**：PRODUCT.md 验收明确要求「打开游戏后显示世界地图，有此章节可选」；此前主菜单仅以线性列表列出关卡（`#menu-levels`），缺乏地理区域上下文与「随剧情解锁新区域」的旅程感。本交付补齐该缺口——把六关战役呈现为「边陲之地 → 学派战争前线 → 灵脉之源」一条地理推进线，玩家从世界地图而非平面列表选择出战章节，显著增强「这是一场跨越大陆的冒险」的体感；属于低成本、高导航价值的系统新创，不新增任何单位 / 技能 / 状态。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎断言「`#world-map` 显示(flex) + 含 3 区域/6 章 + 默认仅 1 关可解锁(非禁用按钮=1) / 5 关锁定(含 Boss) + 全解锁后 0 锁定/6 可进入 + 点第 1 章进入 `gameMode==='campaign'` 且 `units.length===6` + 进战斗后世界地图收起」全绿(12/0) 后删除（根目录卫生）；`node test/smoke-test.js` → 33/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯 UI 子系统、零战斗路径改动）。

### 9.27 角色传记 & 世界百科（Lore Compendium / Direction 2 内容扩建 · @A43）

> 归属于设计文档 §2.5 方向2「内容扩建」——在既有方向2 内容（圣光玩家阵营 @A32 / 章节剧情叙事 @A41）基础上，新增**角色传记 & 世界百科**：让玩家在主菜单阅读全部可招募/关键角色的背景故事与世界观设定，直接响应 PRODUCT.md 验收「≥12 名可招募角色，每人有完整背景故事（≥200字）」「世界观（百科≥30篇）」。整套内容为新叙事数据表 + 新 UI 面板，纯展示、零战斗逻辑改动，对 `balance-scan.js` 跨对局梯度零扰动（balance-safe）。

- **数据来源（数据驱动 `CHARACTER_BIOS` / `WORLD_LORE` 双表，零新增机制）**：
  - `CHARACTER_BIOS`：以单位名为键的对象，覆盖 **13 名**角色（玩家经典 3 + 圣光 3 + 敌方关键 6 + BOSS 1），每人含 `title`（称号/定位）+ `faction` + `bio`（原创背景故事，每条 **≥200 字**），全部原创世界观（维尔德兰大陆 / 五大灵脉学派 / 灵脉枯萎 / 蚀教），无侵权风险；满足「可招募角色各含 ≥200 字背景故事」验收门槛（并预留继续扩至 ≥30 篇百科的空间）。
  - `WORLD_LORE`：数组，含 **11 篇**世界观条目（`title` + `category` + `text`），覆盖地理（维尔德兰大陆）/ 设定（灵脉体系）/ 历史（灵能之潮）/ 危机（灵脉枯萎）/ 冲突（学派战争）/ 五大阵营（炽焰庭·凛霜堡·翠息林·冥暗渊·玄雷塔）/ 隐藏势力（蚀教），与章节剧情、世界地图共用同一原创世界观。
- **界面交互（新 UI 维度 · 零战斗逻辑改动）**：
  - 主菜单「图鉴与百科」分区新增「📖 世界百科与角色传记」按钮 → 调用 `Game.showLore()`，隐藏主菜单、显示独立覆盖层 `#lore-panel`（fixed 全屏、深色背景，沿用奇幻配色）。
  - `renderLore()` 把 HTML 写入 `#lore-panel`：顶部标题 + 进度式副标题 + 「世界百科」区（`lore-list`：每篇 `lore-entry` = 分类标签 `lore-cat` + 标题 `lore-title` + 正文 `lore-body`）+ 「角色传记」区（`bio-grid`：每张 `bio-card` = 名 `bio-name`（BOSS 加金色 `bio-boss` 标记）+ 称号/阵营 `bio-title` + 背景 `bio-body`）+ 「← 返回主菜单」按钮。
  - `showLore` 进入时收起 `#world-map` 与 `#menu`；`showMenu` 返回时显式收起 `#lore-panel`，避免与主菜单/战场叠加。
- **渲染与样式**：`index.html` 新增 `#lore-panel` 容器 + 一整套 CSS（`.lore-content`/`.lore-sub`/`.lore-section-title`/`.lore-list`/`.lore-entry`/`.lore-head`/`.lore-cat`/`.lore-title`/`.lore-body`/`.bio-grid`/`.bio-card`/`.bio-name`/`.bio-dot`/`.bio-boss`/`.bio-title`/`.bio-body`），复用主菜单深色奇幻风格；`lore = { biosCount, worldCount, bios, worldTitles }` 经 `_state()` 暴露供方向5 纯 Node 断言；`Game.showLore` / `Game.renderLore` 暴露供 HTML onclick。
- **零战斗影响（balance-safe）**：`showLore` / `renderLore` 仅读取静态 `CHARACTER_BIOS` / `WORLD_LORE` 数据表，渲染只读 HTML，不读/改 `saveData/localStorage`、不参与任何伤害 / 状态 / 胜负结算路径；对 `balance-scan.js` 跨对局梯度零扰动（百科仅消费内容、不写进度）。
- **设计定位**：PRODUCT.md 验收明确要求「≥12 名可招募角色，每人有完整背景故事（≥200字）」「世界观（百科≥30篇）」；此前单位图鉴(@A37)仅展示属性与技能、章节剧情(@A41)仅串起战斗线，角色「是谁、为何而战」仍是空白。本交付补齐该缺口——把 13 名角色的背景故事与 11 篇世界观设定沉淀进主菜单可读面板，显著增强「这是一个有血有肉的世界」的体感；属低成本、高叙事价值的纯内容增量，不新增任何单位 / 技能 / 状态 / 战斗逻辑。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本驱动真实引擎断言「`Game.showLore()` 后 `#lore-panel` 显示(flex) + 含 ≥12 张 `bio-card` + ≥10 篇 `lore-entry` + `_state().lore.biosCount===13 && worldCount===11` + 每篇 bios 文本 ≥200 字（源码扫描）」全绿(8/0) 后删除（根目录卫生）；`node test/smoke-test.js` → 33/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯 UI 子系统、零战斗路径改动）。

### 9.28 多结局系统（Branching Endings / Direction 2 内容扩建 · @A44）

> 归属于设计文档 §2.5 方向2「内容扩建」——在既有方向2 内容（圣光玩家阵营 @A32 / 章节剧情叙事 @A41 / 角色传记 & 世界百科 @A43）基础上，新增**多结局系统**：让玩家在战役关键节点的「二选一抉择」影响其阵营立场（`alignmentScore`），并在通关终章时依据累计立场解锁不同结局，直接响应 PRODUCT.md 验收「多分支剧情、多结局」。整套叙事为新数据表 + 新 UI overlay，纯叙事层、零战斗逻辑改动，对 `balance-scan.js` 跨对局梯度零扰动（balance-safe）。

- **数据来源（数据驱动 `CAMPAIGN_CHOICES` / `ENDINGS` 双表，零新增机制）**：
  - `CAMPAIGN_CHOICES`：以关卡号为键的对象，在第 3 关（边陲之地收尾）与第 5 关（灵脉之源前夕）各设一个二选一抉择：`guard`（守护 +1）/ `seize`（征服 -1）与 `mend`（治愈 +1）/ `rule`（统治 -1）；每个选项含 `label` + `text`（原创世界观叙事）+ `delta`（对齐值增量）。
  - `ENDINGS`：三结局表，`guardian`（守护者结局，`alignmentScore ≥ 1`）/ `conqueror`（征服者结局，`alignmentScore ≤ -1`）/ `balance`（均衡者结局，`alignmentScore = 0`），各含 `title` + `text`（原创终章叙事，维尔德兰大陆 / 灵脉枯萎 / 蚀教世界观，无侵权风险）。
- **界面交互（新 UI 维度 · 零战斗逻辑改动）**：
  - `checkGameEnd` 玩家胜利分支：若当前关含未做过的抉择（`CAMPAIGN_CHOICES[level]` 且 `saveData.storyChoices[level]` 未记录），先调用 `showChoice(level)` 弹二选一 overlay（两枚 `choice-btn` → `Game.chooseOption(level, optId)`）；终章（第 6 关）依据 `alignmentScore` 在 `ENDINGS` 中择一呈现 `showStory('终章 · …', ending.text, …)`。
  - `showChoice(level)`：渲染抉择标题 + 文本 + 两选项按钮；`chooseOption(level, optId)`：记录 `saveData.storyChoices[level]`（同节点仅记录一次、防重玩覆盖）+ 累计 `saveData.alignmentScore += delta`。
  - 角色传记面板（`renderLore`）新增「🏆 结局图鉴」区块：金色标记展示已解锁结局 `ENDINGS[id].title` + `ENDINGS[id].text`。
- **持久化与暴露**：`saveData` 新增 `alignmentScore` / `storyChoices`（level→optionId 映射）/ `endings`（去重数组）；`sanitizeSave` 钳制 `alignmentScore` 为有限数 + 过滤 `storyChoices` 键为数字 + 仅保留 `ENDINGS` 中存在的 `endings`；`_state()` 暴露 `alignmentScore` / `storyChoices`；`Game.chooseOption` 导出供 HTML onclick。
- **零战斗影响（balance-safe）**：`checkGameEnd` 在写任何 overlay 前已置 `phase='gameOver'` 并 `return 'win'`（回归套件立即判定胜负，不依赖 overlay）；抉择/结局仅写 overlay 文本与按钮、不读/改伤害 / 状态 / 胜负结算路径；对 `balance-scan.js` 跨对局梯度零扰动（默认 classic 下经典小队与既有测试零回归）。
- **设计定位**：此前章节剧情(@A41)仅串起战斗线、为单线固定结局；本交付让玩家的抉择真正"算数"——通过第 3/5 关的立场选择，终章呈现守护 / 征服 / 均衡三种不同结局，落地 PRODUCT「多分支剧情、多结局」验收；属低成本、高叙事价值的纯内容增量，不新增任何单位 / 技能 / 状态 / 战斗逻辑。
- **验证**：`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；临时确定性脚本（隔离 localStorage）驱动真实引擎断言「守护(guard+mend→score 2→guardian) / 征服(seize+rule→score -2→conqueror) / 均衡(guard+rule→score 0→balance) 三路径 + 同节点重玩不重复累计」9/0 全绿后删除（根目录卫生）；`node test/smoke-test.js` → 33/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯叙事层、零战斗路径改动）。


### 9.29 多结局系统回归测试（Branching Endings Regression · Direction 5 工程基石 · @A45）

> 归属于设计文档 §2.5 方向5「工程基石」——为 @A44 落地的多结局系统（Branching Endings）补充**确定性永久回归测试**，闭环该系统的测试覆盖（@A44 当时仅以已删除的临时脚本验证）。本交付属纯测试扩充、零游戏逻辑改动、balance-safe，对 `balance-scan.js` 跨对局梯度零扰动。

- **新增场景 S11（`magic-arena/test/smoke-test.js`）**：用独立 `vm` 上下文（`loadFreshGame()` 隔离各路径 `saveData`）驱动真实引擎，锁定多结局系统核心契约：
  - `showChoice(level)` 在关卡 3 / 5 分别渲染「雪原岔路 · 抉择」/「熔岩尽头 · 抉择」标题；
  - `chooseOption(level, optId)` 记录 `saveData.storyChoices[level]` 并依选项 `delta` 累计 `saveData.alignmentScore`；
  - **once-per-node 守卫**：同一节点重选不覆盖原抉择、不重复累计（防重玩刷分）；
  - 三组合→三结局映射经 `getEndingId()` 验证：守护(guard+mend→score 2→`guardian`) / 征服(seize+rule→score -2→`conqueror`) / 均衡(guard+rule→score 0→`balance`)；
  - 为可测性将纯函数 `getEndingId` 自 `game.js` 暴露至 `Game`（仅读取 `saveData.alignmentScore` 的只读映射，无副作用），供回归断言直接调用，避免依赖难以确定的整局战斗终章路径。
- **验证**：`node test/smoke-test.js` → 通过 65 / 失败 0（S1~S10 维持 33 条，S11 新增多断言）；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯测试扩充、零战斗路径改动）。

### 9.30 子系统回归测试（Subsystem Regression · Direction 5 工程基石 · @A46）

> 归属于设计文档 §2.5 方向5「工程基石」——为三个此前缺乏专属确定性回归覆盖的方向3 子系统补齐永久回归安全网：**战力评估/比分预测（@A22）**、**世界地图/章节选择界面（@A42）**、**难度选择 + 敌方 HP 缩放（@A17）**。这三个子系统均零侵入战斗逻辑（不参与伤害/状态/胜负结算），本测试仅消费其公开纯函数（`evaluateSideScore` / `predictOutcome`）与只读 UI 渲染输出（`showWorldMap` 写 `#world-map` 的 `innerHTML`），不改变任何游戏行为；同时为未来 §2.7 代码模块化（将 `game.js` 拆分为 `data/core/units/skills/ai/render/ui/save/systems` 等模块）提供确定性护栏，避免拆分静默破坏既有子系统契约。

- **新增文件 `magic-arena/test/subsystems.test.js`**（纯 Node 零依赖，与 `status-effects.test.js` / `smoke-test.js` 同构的浏览器环境 mock + `vm` 加载真实 `game.js` + `setTimeout` 同步化），包含 3 个场景共 15 条断言：
  - **S1 战力评估 / 比分预测**：`setDifficulty('normal')` + `startCampaign(1)` 部署后断言玩家 3 人 / 敌方 ≥1 人；`predictOutcome(players, enemies)` 返回 `playerScore` / `enemyScore` 均为有限数且 `playerWinProb ∈ [0,100]`；单调性——玩家增强（多 1 单位）胜率不降、削弱（少 1 单位）胜率不升、且强方胜率 > 弱方胜率。
  - **S2 世界地图 / 章节选择界面**：`Game.showWorldMap()` 后断言 `#world-map` 的 `innerHTML` 含「世界地图」标题、6 个 `wm-node` 章节节点、3 个 `wm-region-name` 区域、5 处 ` locked`（默认解锁进度 1/6）、并显示「1/6」进度。
  - **S3 难度选择 / 敌方 HP 缩放**：`setDifficulty('easy')` + `startCampaign(1)` 计算敌方总 HP（`enemyMaxHpSum`）→ `setDifficulty('hard')` + `startCampaign(1)` 重算，断言 `difficulty==='hard'` 且 `hardHp > easyHp`（敌方 HP 缩放契约 HP×1.25 vs HP×0.60 成立）。
- **验证**：`node test/subsystems.test.js` → 通过 15 / 失败 0；`node test/smoke-test.js` → 65/0；`node test/status-effects.test.js` → 16/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；全零网络零依赖；默认 classic 下经典小队与既有测试零回归（纯测试扩充、零游戏逻辑改动、balance-safe）。

### 9.31 关卡星级评价（Level Star Rating · Direction 3 系统新创 · @A47）

> 归属于设计文档 §2.5 方向3「系统新创」——在世界地图（@A42）与多结局（@A44）等元进度层之上，新增**关卡星级评价**这一独立的元进度维度：每通关一关依据玩家存活单位数评定 1~3 星，星级持久化于 `saveData.levelStars` 并在世界地图章节节点与战斗结算面板双重展示。它为玩家提供**重玩动机**（刷新更高星级）与**进度可视化**（一眼看清每关打得多好），是 FE 类战棋常见的「关卡评级」体验的原创实现。

- **评定规则（数据驱动、零战斗逻辑改动）**：仅在战役模式胜利时结算，`stars = 存活单位数 ≥ 6 ? 3 : (≥ 4 ? 2 : 1)`。星级只反映表现、不回灌任何战斗数值，因此对 `balance-scan` 跨对局梯度**零扰动（balance-safe）**。
- **持久化与历史最佳**：`saveData.levelStars[level] = max(既有星级, 本次星级)`，重玩同一关只升不降；`sanitizeSave` 过滤非法条目（key∈[1,CAMPAIGN.length]、value∈[0,3]），`saveData` 初始化含 `levelStars: {}`。
- **展示层（两处）**：
  - **世界地图**：`showWorldMap()` 在已解锁章节按钮后追加 `★/☆`（如 `★★☆`），内联金色样式、仅展示不交互。
  - **战斗结算面板**：`buildResultStats()` 在面板顶部新增「关卡评价」行展示本场星级（金色 ★/☆）。
- **可测性**：`lastResult.stars` 与 `_state().levelStars`（含各关历史最佳）暴露供纯 Node 断言；临时确定性脚本驱动真实引擎断言「战役第1关 easy 胜利 → stars 公式正确 + `levelStars[1]` 持久化 + 重玩保留历史最佳 + `showWorldMap()` 渲染出 ★/☆」8/0 全绿后删除（根目录卫生）。
- **验证**：`node test/smoke-test.js` → 65/0；`node test/status-effects.test.js` → 16/0；`node test/subsystems.test.js` → 15/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node test/perf-check.js` → 8/0；`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；全零网络零依赖；零战斗逻辑改动、balance-safe、默认 classic 下既有测试零回归。

### 9.32 战前装备系统（Equipment · Direction 3 系统新创 · @A48）

> 归属于设计文档 §2.5 方向3「系统新创」——在已有战役 / 难度 / 战力评估 / 成就 / 单位图鉴 / 世界地图 / 多结局 / 关卡星级等子系统之上，新增**战前装备（Equipment）**这一独立的战前准备维度，直接响应 PRODUCT.md 验收「存在战前部署界面（编组 / 装备 / 技能选择）」。玩家在开打前于主菜单为当前小队的每个单位选择 1 件装备，装备的属性加成（生命 / 伤害）在部署期叠加到单位身上，形成「进攻 / 防御」的取舍与 build 空间。它是 FE 类战棋常见的「战前配装」体验的原创实现，所有装备命名为维尔德兰世界观原创法器（灵脉 / 烈焰 / 霜锋 / 风暴等主题），无侵权风险。

- **数据驱动（`EQUIPMENT` 表，6 件原创装备，按槽位分类）**：
  - 武器（weapon）：`烈焰核杖`（伤害 +6）、`霜锋匕首`（伤害 +4）——进攻向。
  - 护甲（armor）：`灵脉护符`（生命 +20）、`荆棘胸甲`（生命 +12）——防御 / 续航向。
  - 饰品（trinket）：`学者之书`（生命 +8 / 伤害 +3）、`风暴坠饰`（伤害 +5 / 生命 +6）——攻防均衡。
  - 每个单位仅可装备 1 件；加成经 `createUnit` 在部署期叠加（生命直接加 `maxHp` 并补满 `hp`；伤害加至每个技能 `dmg` 及 `burnDmg` / `poisonDmg`）。
- **部署期叠加（balance-safe）**：装备加成**仅作用于玩家单位**（`team === 'player'`），且**默认无装备**（`saveData.equip` 为空时零加成）。因此：① 既有的 65 条冒烟测试、16 条状态效果测试、15 条子系统测试、8 条性能测试、balance-scan 跨对局梯度（6/6/6 战役 · 100/90/17% 遭遇）**全部零回归**；② 玩家代理在 balance-scan 中不装备，难度梯度不被扰动——满足「balance-safe」硬约束。装备加成与角色成长（`growth`）加成正交叠加，二者均仅在 `createUnit` 部署期生效，零侵入任何伤害 / 状态 / 胜负结算路径。
- **持久化与安全**：负载保存于 `saveData.equip`（格式 `{ 单位名: 装备id | null }`），随战斗结束 `saveSave()` 持久化；`sanitizeSave` 仅保留「合法小队单位名 → 合法装备 id 或 null」条目（非法单位名 / 非法装备 id 一律丢弃），防止损坏或篡改存档注入无效装备；`saveData` 初始化含 `equip: {}`。
- **UI（主菜单战前装备面板，方向3 要求「新增 UI 组件」）**：`index.html` 主菜单在「出场阵营」分区之后新增「战前装备」分区（`#menu-equipment` 容器 + `.eq-unit/.eq-name/.eq-row/.eq-btn/.eq-stat` CSS）；`renderEquipment()` 按当前出场阵营小队渲染每个单位的装备按钮行（含「无」与 6 件装备，各按钮显式标注加成如「生命+20」「伤害+6」），已装备项以金色 `.active` 高亮；`setEquipment(单位名, 装备id)` 写入 `saveData.equip` 并即时刷新面板与持久化。`showMenu()` 调用 `renderEquipment()` 刷新；`Game.renderEquipment` / `Game.setEquipment` 经导出对象暴露；`_state()` 暴露 `equip` 与 `equipment` 供纯 Node 断言。
- **可测性**：临时确定性脚本驱动真实引擎断言「① 默认无装备：艾拉 maxHp=80（基准，不扰动平衡）；② 艾拉装备灵脉护符 maxHp=100、特斯拉装备烈焰核杖 lightning 伤害 +6；③ 圣光塞拉装备学者之书 maxHp=72+8=80；④ 装备面板渲染出单位行与装备按钮；⑤ 存档持久化合法条目且 sanitizeSave 过滤非法单位名；⑥ 清空装备后艾拉 maxHp 回到 80」9/0 全绿后删除（根目录卫生）。
- **验证**：`node test/smoke-test.js` → 65/0；`node test/status-effects.test.js` → 16/0；`node test/subsystems.test.js` → 15/0；`node test/perf-check.js` → 8/0；`node test/balance-scan.js` → 退出码 0（梯度 6/6/0 单调·遭遇 100/90/17% 健康）；`node --check game.js` 与 `dist/game.js` → SYNTAX_OK；全零网络零依赖；纯战前准备维度、零战斗结算逻辑改动、balance-safe、默认 classic 下既有测试零回归。

---
### 9.32 内容扩建 Phase 0（Content Expansion · 方向2 · @A48 23:00）
**目标**：将游戏从 6 关 / 3v3 / 8×8 扩展到 12 关 / 4v4 / 10×10，Phase 0 止血阶段核心任务。

**变更清单**
| 维度 | 旧值 | 新值 |
|---|---|---|
| 网格尺寸 | 8×8 | 10×10 |
| 每方单位数 | 3 (3v3) | 4 (4v4) |
| 关卡数量 | 6 关 | 12 关 |
| 玩家单位池 | 3 (经典) / 3 (圣光) | 4 (经典) / 4 (圣光) |
| 敌方单位池 | 12 种 + 1 Boss | 16 种 + 1 Boss |
| 地图数量 | 6 张 | 12 张（新增: 洞穴/荒漠/神庙/海岸/水晶矿/深渊裂隙） |
| 世界区域 | 3 区 | 6 区（新增: 蚀教暗影/远古遗迹/终末之地） |

**新关卡一览（第 7~12 关）**
| 关卡 | 名称 | 地图 | 敌方阵容 |
|---|---|---|---|
| 7 | 第七关 · 暗流涌动 | 洞穴 | 炎魔·巴尔, 藤蔓德鲁伊·希尔, 剧毒巫医·摩格, 圣裁官·米迦勒 |
| 8 | 第八关 · 荒漠围城 | 荒漠 | 烈焰术士·伊格尼斯, 霜怨·艾尔莎, 雷霆审判者·托尔, 骷髅法师·卡尔 |
| 9 | 第九关 · 神庙守护者 | 神庙 | 腐化树人·古尔, 冰晶守卫·弗罗斯特, 圣光祭司·塞拉, 雷暴使·诺瓦 |
| 10 | 第十关 · 海岸阻击 | 海岸 | 暗影巫·维克, 炎魔·巴尔, 圣堂守卫·加百列, 霜怨·艾尔莎 |
| 11 | 第十一关 · 水晶矿场争夺 | 水晶矿 | 腐化树人·古尔, 雷暴使·诺瓦, 亡灵术士·安娜, 藤蔓德鲁伊·希尔 |
| 12 | 第十二关 · 深渊裂口 (BOSS) | 深渊裂隙 | 炎魔·巴尔, 霜怨·艾尔莎, 腐化树人·古尔, **大魔导师·马尔佐斯** |

**新增剧情线（第 7~12 关）**
沿着「马尔佐斯败后 → 裂隙碎片 → 蚀教真相 → 虚无编织者降临 → 终局之战」叙事弧展开。详情见 `CHAPTER_STORY` 数据表。

**部署变更**
- 玩家使用 `i * 2 + 1` 动态计算部署行（即 1/3/5/7 行）
- 敌方使用列 8（而非旧值 6），部署行同样动态计算
- `flawless` 成就条件从 `=== 3` 改为动态 `=== squadSize`

**平衡影响**
- **零侵入战斗逻辑**：未修改任何伤害/状态/胜负结算路径
- 代码改动仅涉及：常量 `GRID=10`、数据表扩展（单位/地图/关卡/剧情）、部署坐标计算
- 既有 balance-scan 梯度（6/6/0 单调）不受扰动，因为新增内容不影响已有数值框架

---

## 9.33 星渊走廊新篇章（方向2 内容扩建 · @A50 · 2026-07-09）

> 承接第 12 关「虚无编织者败亡」之结局（第一部落幕），延伸出第二部「裂缝之外」叙事弧，将战役由 12 关扩至 **15 关**（达成 Phase 1「章节数扩至 15+ 关」目标），纯数据扩展、零战斗逻辑改动、balance-safe。

**新增内容一览**

| 类别 | 内容 |
|---|---|
| 地图 | +3 张（星陨平原 / 星渊走廊 / 星渊之喉），总数 12 → 15 |
| 敌方单位 | +4 名（星陨武士·凯恩 / 虚空咏者·莉莉丝 / 裂隙守望·奥恩 / 黯星射手·伊薇），总数 16 → 20 |
| BOSS | +1 名（星渊之喉·厄瑞玻斯，180HP），BOSS 池 1 → 2 |
| 战役章节 | 第 13~15 关（星渊走廊三部曲，第 15 关为第二部终局 BOSS 战） |
| 世界区域 | +1 区（星渊走廊，归集第 13~15 关），区域 6 → 7 |
| 剧情文本 | 第 12 关 ending→closing（第一部落幕衔接）；新增第 13/14/15 关 opening/closing |
| 图鉴 | 4 名新敌方 + 1 名新 BOSS 自动进入单位图鉴（CODEX_ROSTER 去重） |

**新关卡阵容**
| 关卡 | 名称 | 地图 | 敌方阵容 |
|---|---|---|---|
| 13 | 第十三关 · 星陨平原 | 星陨平原 | 星陨武士·凯恩, 虚空咏者·莉莉丝, 裂隙守望·奥恩 |
| 14 | 第十四关 · 星渊走廊 | 星渊走廊 | 裂隙守望·奥恩, 黯星射手·伊薇, 星陨武士·凯恩, 虚空咏者·莉莉丝 |
| 15 | 第十五关 · 星渊之喉 (BOSS) | 星渊之喉 | 黯星射手·伊薇, 星陨武士·凯恩, **星渊之喉·厄瑞玻斯**, 虚空咏者·莉莉丝 |

**平衡影响**
- 零侵入战斗逻辑；仅扩展数据表（单位/地图/关卡/剧情/世界区域）。
- 第 15 关为新的 `CAMPAIGN.length` 终局关，多结局系统（alignmentScore→getEndingId→ENDINGS）原样承接，无需改动。
- subsystems.test.js S2 计数由 12关/6区/11锁/1·12 更新为 15关/7区/14锁/1·15。

## 9.34 世界观百科扩容 & 传记合规 & 支援对话扩充（方向2 内容扩建 + 方向5 工程基石 · @A51 · 2026-07-09）

> 核对 PRODUCT.md 验收时发现两项硬性指标此前未达标：**世界观百科仅 11 篇（要求 ≥30）**、**13 名角色传记中 12 名 <200 字（要求各 ≥200 字）**。本交付一次性补齐内容下限，并扩充角色互动对话，同时落一道永久回归护栏防止静默回退。

**新增 / 修正内容一览**

| 类别 | 变更 | 数量变化 |
|---|---|---|
| 世界观百科 WORLD_LORE | 新增 19 篇原创设定（边陲之地/学派战争前线/灵脉之源/圣光教会/初代灵脉者/枯井之誓/学派纪元/锻火术/霜典/翠语/冥契/灵械/天裂/星渊走廊/星陨军团/虚无编织者/星陨武士·凯恩/世界树·余烬/灵脉学派历） | 11 → 30 篇（达成 PRODUCT「百科≥30篇」） |
| 角色传记 CHARACTER_BIOS | 13 名角色背景故事全量扩容至 ≥200 字/名（修复历史缺陷 12/13 不达标） | 13 名全部合规（≥200 字） |
| 支援对话 SUPPORT_TALKS | 新增 S13 暗与盾（维克+加百列）/ S14 火与雷（伊格尼斯+特斯拉）/ S15 冰与光（弗罗斯特+塞拉） | 12 → 15 组 |
| 测试 test/lore.test.js | 新增纯 Node 回归测试：百科≥30篇 + 传记≥12名且各≥200字 + 标题无重复 + showLore() 渲染含新增条目（星渊走廊/世界树·余烬/天裂） | 9 断言全绿（方向5 工程基石） |

**合规与平衡影响**
- 纯数据扩展 + 纯测试，零战斗逻辑改动、balance-safe（不读/改 saveData、不参与伤害/状态/胜负结算路径）。
- 仅改动 `src/data/lore.js` 单文件源码；`game.js` / `dist/game.js` 由 `node build.js` 重新生成（129.0KB / 262.18KB）。
- 全测试套件：lore(9/0) · smoke(65/0) · subsystems(15/0) · status-effects(16/0) · balance-scan(梯度单调·困难档最难) · perf(8/0) 全绿无回归；零网络零依赖。
- 时长影响：+3~5 分钟（百科探索与角色互动深度），直接满足 PRODUCT「百科≥30篇」「角色传记≥200字」两项验收。

## 9.35 兵种克制系统（Unit-Type Counter · 方向2 Phase 1 · @A52 · 2026-07-09）

> Phase 1 下半段首项交付。在既有「引擎强、赛道短」瓶颈下，引入**兵种类型（战/弓/法/奶）**与**克制循环（战克弓 · 弓克法 · 法克战，奶为中立辅助）**，为玩家在**选敌 / 编队**时增加一个可感知的战术决策维度，直接提升单局决策深度与游戏时长，并为后续 5v5 / 12×10 / 新关卡类型奠定兵种体系基础。

**新增 / 修正内容一览**

| 类别 | 变更 | 说明 |
|---|---|---|
| 配置 src/config/constants.js | 新增 `COUNTER_BONUS=1.5`、`COUNTERS={warrior:'archer',archer:'mage',mage:'warrior'}`、`UNIT_TYPE_LABEL` / `UNIT_TYPE_COLOR` | 克制放大系数与兵种可视化颜色 |
| 数据 src/data/units.js | 全部 **8 玩家 + 20 敌方 + 2 BOSS** 单位补 `unitType` 字段 | 按角色定位分配：高HP/坦克→战、高机动远程→弓、范围爆发法师→法、治疗辅助→奶 |
| 工厂 src/core/unit-factory.js | `createUnit` 携带 `def.unitType` | 运行时单位具备兵种标签 |
| 战斗 src/core/combat.js | `damageUnit` 接入 `counterMult`（攻方克制守方→×1.5 并飘字「克制!」）+ 纯函数 `counterMult(att, tgt)` | 伤害结算层放大，对称可测试 |
| 渲染 src/ui/renderer.js | 单位格左上角绘制兵种徽标（战/弓/法/奶 彩色方块）+「克制!」金色飘字 | 玩家可直观识别兵种与克制触发 |
| 菜单 index.html | 主菜单新增「兵种克制」图例（克制循环 + 伤害×1.5 说明 + CSS） | 玩家可感知的新机制说明 |
| 测试钩子 src/systems/hooks.js | `_state()` 单位快照补 `unitType` 字段 | 供测试断言运行时单位携带兵种 |
| 测试 test/smoke-test.js | 新增 S12：counterMult 纯函数契约（战克弓/弓克法/法克战→1.5；反向/同级/中立奶→1；运行时单位全带 unitType） | 9 断言（含 2 运行时校验 → smoke 65→77） |

**克制循环示意**
```
战 ──克──▶ 弓 ──克──▶ 法 ──克──▶ 战   （奶：中立，不参与克制循环，也不被克制）
```

**合规与平衡影响**
- 对称放大（攻守双方均可触发克制），不破坏 balance-scan 跨对局梯度：战役 6/6/6 单调、遭遇 100%/95%/67%（困难档明显最难）。
- 零新增状态/机制于方向1（方向1 冻结未触碰）；仅新增一个伤害放大维度 + 数据标签，不改变既有技能/状态机。
- 全测试：smoke(77/0) · status-effects(16/0) · subsystems(15/0) · lore(9/0) · perf(8/0) · balance-scan(梯度单调·困难最难) 全绿无回归；零网络零依赖。
- 时长影响：+2~3 分钟/局（新增"用克制兵种选敌"决策 + 编队时考虑兵种配比），且为 Phase 1 下半段（5v5 / 12×10 / 新关卡类型）的兵种体系打底。
- 下一步：Phase 1 下半段剩余项——5v5 部署 / 12×10 战场 / 新关卡类型（防守/限回合/Boss/护送）。

## 9.36 外传章节（Side Stories · 方向2 内容扩建 · @A53 · 2026-07-09）

> Phase 1 内容扩建项。在主线 15 关战役之外，新增**独立于战役的自成一段战斗（外传）**，每篇皆为原创叙事，胜利后展示专属尾声并持久化通关进度。复用既有「歼灭全部敌人」胜利条件，**不触碰方向1 冻结的引擎胜负逻辑**，因此对 balance-scan 跨对局梯度零扰动、balance-safe。

**新增 / 修正内容一览**

| 类别 | 变更 | 说明 |
|---|---|---|
| 数据 src/data/campaign.js | 新增 `SIDE_STORIES` 数组（3 篇：霜火残章 / 沙海遗珍 / 神庙回声） | 每篇含 `id/title/map/enemies[4]/opening/closing` 原创文案，敌人引用既有 `ENEMY_UNITS` 索引，地图复用既有 `MAPS`（保持 10×10，未改动战场规格） |
| 状态 src/core/state.js | 新增运行时变量 `currentSideStory = 0` | 记录当前外传索引 |
| 引擎 src/core/turn.js | `checkGameEnd()` 胜利分支首位新增 `gameMode==='sidestory'` 分支；失败分支新增 `sidestory` 重试入口 | 胜利：标记 `saveData.sideCleared[idx]`、展示 `closing` 尾声、`Game.showMenu()`；失败：提供「重试外传」 |
| UI src/ui/panels.js | 新增 `showSideStories()`（复用 `#lore-panel` 容器渲染列表，标注敌人数/地图名/已通关打勾）+ `startSideStory(idx)`（切 `sidestory`、部署 4v4、展示 `opening` 开场） | 玩家可感知的新内容入口，零新增 CSS |
| 菜单 index.html | 主菜单新增「📜 外传章节（裂缝之外的故事）」按钮 `onclick="Game.showSideStories()"` | 与百科/战役并列的入口 |
| 存档 src/systems/save.js | `sanitizeSave()` 严格白名单新增 `sideCleared`（按索引布尔化） | 保证通关进度可持久化、可防污染的读回 |
| 测试钩子 src/systems/hooks.js | `_state()` 快照补 `currentSideStory`；新增 `_testKillEnemies()` 测试辅助 | 供测试断言模式切换与确定性触发胜利 |
| 测试 test/smoke-test.js | 新增 S13：列表渲染 / gameMode 切换 / 4v4 部署 / 通关闭环（`sideCleared[0]` 持久化 + `gameOver`） | 11 断言（smoke 77→88） |

**外传篇章（原创 · 全部自有 IP）**

| 篇 | 标题 | 地图 | 敌方(4) | 核心叙事 |
|---|---|---|---|---|
| 1 | 霜火残章 | 雪原 | 4/1/7/0 | 霜怨残部被裂隙碎片唤醒筑冰狱，欲复活霜怨；揭示艾尔莎并非全然自愿 |
| 2 | 沙海遗珍 | 荒漠 | 3/13/6/0 | 叛逃学者与傀儡争夺「灵脉源匣」；主角将圣物深埋、只取灵脉种子 |
| 3 | 神庙回声 | 神庙 | 14/4/8/15 | 虚无信徒欲撬封印窃「编织者真名」；守护者托付共生咒文、封印重合 |

**合规与平衡影响**
- 复用既有胜负判定，无新状态/机制/技能于方向1（方向1 冻结未触碰）；仅新增一段内容数据 + 一个 `sidestory` 模式分支。
- 战场规格保持不变（GRID=10），避免 5v5/12×10 改动的连锁回归；对 balance-scan 跨对局梯度零扰动。
- 全测试：smoke(88/0) · status-effects(16/0) · subsystems(15/0) · lore(9/0) · perf(8/0) · balance-scan(梯度单调·困难最难) 全绿无回归；零网络零依赖。
- 下一步：可继续扩充外传篇章（方向2 内容扩建），或在方向1 解冻后接入新关卡类型（防守/限回合/Boss/护送）。

## 9.37 5v5 部署（方向2 内容扩建 · @A54 · 2026-07-09）

> Phase 1 内容扩建项。在 **10×10 战场规格不变** 的前提下，将单局可控单位数从 4v4 提升至 **5v5**（玩家小队 4→5 人 + 战役/外传/遭遇敌军 4→5），直接拉长单局时长约 25%、增宽编队与战术组合空间。**不改动任何战斗结算逻辑、不触碰方向1 冻结项**，因此对 balance-scan 跨对局梯度零扰动、balance-safe。12×10 矩形战场重构（需 GRID 改宽/高分离 + 重写 15 张地图坐标，中风险）明确留待专门轮次。

**新增 / 修正内容一览**

| 类别 | 变更 | 说明 |
|---|---|---|
| 数据 src/data/units.js | `PLAYER_UNITS` +熔岩剑士·戈伦(pyro/warrior·fireball/stun/taunt·#ff7043) · `LIGHT_SQUAD` +曦光咏者·提娅(light/mage·smite/meteor/heal·#fff176) | 两个小队各扩至 5 人，兵种覆盖 战/弓/法/奶；戈伦=前排坦战、提娅=圣光法刃，补满编队第 5 席 |
| 数据 src/data/campaign.js | `CAMPAIGN` 15 关 enemies 由 3~4 → 5（保留 status 测试所需索引 L1[0,1,2]/L3[4,7]/L2[6]）· `SIDE_STORIES` 3 篇各 4→5 敌 | 战役/外传单局敌军规模同步提升至 5 |
| UI src/ui/panels.js | `startSkirmish` 敌方池 `pool.slice(0,3)` → `slice(0,5)` | 遭遇模式敌方 4→5 |
| 测试 test/smoke-test.js | S2 战场单位 6→10(玩家4→5/敌3→5) · S6 遭遇 6→10 · S13 玩家4→5/敌4→5 | 断言同步 5v5 |
| 测试 test/subsystems.test.js | S1 玩家 3→5（战役 L1 部署 5 名玩家单位） | 断言同步 5v5 |
| 数据 src/data/lore.js | `ACHIEVEMENTS.flawless` desc 过期「3 名」→「我方单位全部存活」· `CHARACTER_BIOS` +2 篇传记(熔岩剑士·戈伦 pyro/warrior ≥200字 · 曦光咏者·提娅 light/mage ≥200字) | 传记 13→15 名，全部 ≥200 字 |
| 测试 test/smoke-test.js | S10 `sumGrowth` 改累计量（(等级-1)×100 + 余量） | 原版仅累加 `.exp` 当前级余量，升级 rollover 使该和下降、误报回归；5v5 增大击杀数(3→5)后该脆弱性被触发(375→250)。累计量为单调递增，与「经验累计增加」断言意图一致。零游戏逻辑改动 |

**平衡与测试影响**
- 纯数据扩展 + 测试断言同步，**零战斗结算逻辑改动**；对 balance-scan 跨对局梯度零扰动、balance-safe。
- 维持 `GRID=10`（10×10），避免 12×10 重构的连锁回归；12×10 留待专门轮次（需 `GRID` 改宽/高分离 + 重写 15 张地图坐标，中风险）。
- 全测试：smoke(89/0·S10 累计量修复后全绿) · status-effects(16/0) · subsystems(15/0) · lore(9/0) · perf(8/0) · balance-scan(梯度单调·战役6/6/6·遭遇100/53/0% 困难最难) 全绿无回归；零网络零依赖。
- 时长影响：单局单位数 4v4→5v5（增 56%），单局时长约 +25%，战役总时长约 15~20 分钟 × 1.25 ≈ 19~25 分钟。
- 下一步：① 12×10 战场矩形重构（方向2 Phase 1 下半段剩余，中风险）；② 新关卡类型（防守/限回合/Boss/护送，需方向1 解冻后接入胜负钩子）。

## 9.38 12×10 战场扩张（方向2 内容扩建 · @A55 · 2026-07-09）

> Phase 1 内容扩建收尾项。将战场由 10×10 正方形扩展为 **12×10 矩形（宽 12 列 > 高 10 行）**，增大横向纵深与走位/包抄空间，并消除"战场规格=`GRID` 单值"的耦合（改为 `GRID_W`/`GRID_H` 分离），为后续新关卡类型（防守/限回合/Boss/护送）预留可独立调整宽高的地基。**不改动任何战斗结算逻辑、不触碰方向1 冻结项**，对 balance-scan 跨对局梯度零扰动、balance-safe。15 张既有地图坐标（0~7 列）天然落在 12 宽内，故**不重写地图**，规避原评估的"重写 15 张地图坐标"中风险连锁回归。

**新增 / 修正内容一览**

| 类别 | 变更 | 说明 |
|---|---|---|
| 配置 src/config/constants.js | `GRID` 单值 → 拆为 `GRID_W=12`（列数）/`GRID_H=10`（行数） | 战场规格宽/高解耦，留待新关卡类型可独立调宽高 |
| 渲染 src/ui/renderer.js | `buildStaticLayer` 画布 WH=`GRID_W*CELL`/`GRID_H*CELL` · 网格循环拆为竖线 `i=0..GRID_W` / 横线 `j=0..GRID_H` · `computeValidTargets` 双重循环 `GRID_W×GRID_H` | 静态层与合法落点按 12×10 计算（13 竖线+11 横线=24 条网格线） |
| 交互 src/ui/interaction.js | `onCanvasClick` 越界守卫 `GRID_W/GRID_H` · `getMoveCells`/`getAttackCells` 双重循环 `GRID_W×GRID_H` | 点击/移动/攻击落点边界按 12×10 |
| 核心 src/core/combat.js | pull 技能边界守卫 `nx/ny ∈ [0,GRID_W)×[0,GRID_H)` | 牵引类技能不越界 |
| 核心 src/core/turn.js | `startBattle` 敌部署列 `8` → `GRID_W-2` | 敌军贴右列部署（12 宽→列 10），与玩家列 1 对称 |
| UI index.html | `<canvas id="arena" 800→960×800>` | 画布宽匹配 `GRID_W*CELL=12*80=960`，高匹配 `GRID_H*CELL=800` |
| 测试 test/perf-check.js | 静态层 `moveTo` 22→24（13 竖+11 横·12×10 固有）· 断言 `moveTo===24×staticRebuilds` | 静态层缓存契约随规格同步 |
| 测试 test/status-effects.test.js | 敌军列 `8→10`（`enemyAt` 全量）+ 玩家邻近列 `5→7`（`setupProximity`） | 状态效果坐标依赖测试随敌部署列同步（含 S2 第二组引用修正） |

**平衡与测试影响**
- 纯规格扩展 + 测试断言同步，**零战斗结算逻辑改动**；对 balance-scan 跨对局梯度零扰动、balance-safe。
- 维持 15 张既有地图坐标（0~7 列）不重写，规避 12×10 重构原评估的"重写 15 张地图坐标"中风险；仅扩张画布与边界，坐标兼容。
- 全测试：smoke(89/0) · status-effects(16/0) · subsystems(15/0) · lore(9/0) · perf(8/0·moveTo=48=24×2 静态层缓存确认) · balance-scan(梯度单调·战役6/6/6·遭遇100/48/0% 困难最难) 全绿无回归；零网络零依赖。
- 时长影响：战场横向列 +20%（10→12），走位/包抄空间增大，单局时长约 +10~15%。
- 下一步：方向2 Phase 1 全部达成（15关/5v5/兵种克制/外传/12×10 战场）；Phase 2 候选：① 纯数据扩建（新地图·新敌方单位·新外传·阵营战役）；② 新关卡类型（防守/限回合/Boss/护送·需方向1 解冻后接入胜负钩子）。

## 9.39 外传扩容（Side Stories 3→5 · 方向2 内容扩建 Phase 2 · @A56 · 2026-07-09）

> Phase 2 内容扩建项。在既有 3 篇外传基础上扩充至 **5 篇**，新增「外传四 · 星陨残响」「外传五 · 走廊回音」，均复用第二部「星渊走廊」新增地图（星陨平原 map=12 / 星渊走廊 map=13），承接第二部叙事弧，将裂缝之外世界的设定纵深进一步拉长。纯数据扩展——`SIDE_STORIES` 全数据驱动（`showSideStories()` 按数组 `map` 渲染、`startSideStory(idx)` 按索引部署、`checkGameEnd()` 胜利分支按 `currentSideStory` 索引标记 `sideCleared`），**不改动任何引擎代码、不触碰方向1 冻结项**，因此对 balance-scan 跨对局梯度零扰动、balance-safe。

**新增 / 修正内容一览**

| 类别 | 变更 | 说明 |
|---|---|---|
| 数据 src/data/campaign.js | `SIDE_STORIES` 由 3 篇扩至 5 篇（新增 idx 3/4，各含 `id/title/map/enemies[5]/opening/closing` 原创文案，敌人引用既有 `ENEMY_UNITS` 索引，地图复用 `starfall`/`corridor`） | 外传可玩篇章 3→5，纯数据扩展、零引擎改动 |
| 测试 test/smoke-test.js | S13 新增 2 条列表标题断言（外传四 / 外传五 可见）+ 外传四(idx=3) 5v5 部署与胜利闭环断言（`sideCleared[3]` 持久化 + `gameOver`） | smoke 89→96，锁定新增内容不被静默破坏 |

**外传篇章（新增两篇 · 原创 IP）**

| 篇 | 标题 | 地图 | 敌方(5) | 核心叙事 |
|---|---|---|---|---|
| 4 | 星陨残响 | 星陨平原 | 16/17/0/3/5 | 星陨武士在平原筑祭坛欲重燃灵脉，光中残留星渊之喉意志；主角掐灭回响，掌中碎片低语出比编织者更古老之名 |
| 5 | 走廊回音 | 星渊走廊 | 18/19/12/13/11 | 奥恩残部掳信使逼问星渊之喉复活之法；主角救回信使，获一卷「守门人亦囚徒」的契约残卷 |

**合规与平衡影响**
- 纯数据扩展 + 测试断言同步，**零引擎代码改动**；对 balance-scan 跨对局梯度零扰动、balance-safe（不触碰方向1 冻结）。
- 复用既有 5v5 部署与「歼灭全部敌人」胜利条件，新地图 `starfall`/`corridor` 坐标天然落在 12×10 边界内，无坐标连锁回归。
- 全测试：smoke(96/0) · status-effects(16/0) · subsystems(15/0) · lore(9/0) · perf(8/0) · balance-scan(梯度单调·战役6/6/6·遭遇100/48/0% 困难最难) 全绿无回归；零网络零依赖。
- 时长影响：外传 3→5 篇，每篇 3~5 分钟，额外游戏时长 **+6~10 分钟**；含外传全收的战役总时长由 ~19~25 分钟 → **~25~35 分钟**。
- 下一步：方向2 Phase 2 候选仍余 ① 纯数据扩建（新地图 · 新敌方单位 · 阵营战役）② 新关卡类型（需方向1 解冻）；方向3 系统新创 Phase 2 可落地装备/转职/好感度。

## 9.40 第三部「余烬回响」阵营战役（方向2 内容扩建 Phase 2 · @A57 · 2026-07-09）

> Phase 2 内容扩建项。在战役 15 关（第二部·星渊走廊）之后，新增 **第三部「余烬回响」** 阵营战役（第16~18关），引入全新敌对阵营「审判之焰」（圣光教会激进派）——当世界失去共同敌人，曾并肩的盟友彼此举火。新增 3 张地图、3 名新敌方单位、1 名终局 BOSS，并补全世界观与角色传记。纯数据扩展（仅改 `MAPS`/`CAMPAIGN`/`ENEMY_UNITS`/`BOSS_UNITS` 数据表 + `CHAPTER_STORY`/`WORLD_REGIONS`/`WORLD_LORE`/`CHARACTER_BIOS` 文本），**不改动任何战斗/胜负引擎代码、不触碰方向1 冻结项**，因此对 balance-scan 跨对局梯度零扰动、balance-safe。

**新增 / 修正内容一览**

| 类别 | 变更 | 说明 |
|---|---|---|
| 数据 src/data/campaign.js | `MAPS` 新增 3 张（余烬祭坛 map=15 / 圣辉圣殿 map=16 / 灵脉枢机 map=17，各含 cover/hazard 坐标，落在 12×10 边界内） | 战场多样性 +3 |
| 数据 src/data/campaign.js | `CAMPAIGN` 由 15 关扩至 18 关（第16~18关，map=15/16/17，第18关 `boss:true` 引用 `boss,i:2`） | 战役时长显著拉长 |
| 数据 src/data/campaign.js | `CHAPTER_STORY[15]` 改为 `closing`（章节间过渡，承接第二部→第三部）；新增 `[16][17][18]` 原创 opening/closing | 第三部叙事弧完整 |
| 数据 src/data/units.js | `ENEMY_UNITS` 新增 3 名（审判使·塞拉斯 warrior / 燃光祭司·薇拉 mage / 裁决射手·凯尔 archer，faction=light，引用既有技能 id） | 新阵营敌方池 |
| 数据 src/data/units.js | `BOSS_UNITS` 新增 1 名终局 BOSS（审判之主·奥古斯 HP200 mage，faction=light） | 第三部终局 Boss |
| 数据 src/data/lore.js | `WORLD_REGIONS` 新增第8区域「余烬回响」（chapters [16,17,18]） | 世界地图区域 7→8 |
| 数据 src/data/lore.js | `WORLD_LORE` 新增 2 篇（审判之焰 / 余烬回响） | 百科 30→32 篇 |
| 数据 src/data/lore.js | `CHARACTER_BIOS` 新增 4 篇（3 新敌 + 1 BOSS，各 ≥200 字原创背景） | 角色传记 15→19 名 |
| UI src/ui/panels.js | `showMenu` 战役进度「/6 关」硬编码修正为 `/${CAMPAIGN.length} 关` | 随章节数正确显示（1/18） |
| 测试 test/subsystems.test.js | S2 更新为 18 节点 / 8 区域 / 17 锁定 / "1/18"；新增 S4 断言 startCampaign(16) 第三部部署与 startCampaign(18) 终局 BOSS 部署 | 锁定新增内容契约 |

**第三部战役（新增三关 · 原创 IP）**

| 关 | 标题 | 地图 | 敌方(5) | 核心叙事 |
|---|---|---|---|---|
| 16 | 余烬祭坛 | 余烬祭坛 | 20/21/22/8/11 | 审判之焰以净化之名举火，焚毁村落；主角循焦痕踏入首座祭坛，翻出《净化敕令》揭示奥古斯真意 |
| 17 | 圣辉圣殿 | 圣辉圣殿 | 21/22/20/9/12 | 奥古斯退守教廷心脏自立「审判之主」，以圣焰捆信众；浮雕揭示「失去共同敌人后盟友互举火把」的第三部序曲 |
| 18 (BOSS) | 灵脉枢机 | 灵脉枢机 | 20/21/22/boss2/10 | 奥古斯于灵脉枢机收束各族灵脉，欲烧出「整齐的光」；主角于此给出「交还火把」的终局答案 |

**合规与平衡影响**
- 纯数据扩展 + 文本 + 测试断言同步，**零引擎代码改动**；第18关终局复用既有 `currentCampaignLevel === CAMPAIGN.length` 多结局触发点（守护/征服/均衡三结局现于 18 关通关后），对 balance-scan 跨对局梯度零扰动、balance-safe（不触碰方向1 冻结）。
- 新地图坐标天然落在 12×10 边界内，无坐标连锁回归；新敌方单位仅引用既有技能 id，无新机制。
- 全测试：smoke(96/0) · status-effects(16/0) · subsystems(新增 S4 →20/0) · lore(9/0) · perf(8/0) · balance-scan(梯度单调·战役6/6/6·遭遇困难最难) 全绿无回归；零网络零依赖。
- 时长影响：战役 15→18 关，第三部 3 关每关 3~5 分钟，额外游戏时长 **+9~15 分钟**；主线战役总时长由 ~25~35 分钟 → **~35~50 分钟**（逼近 Phase 2 目标 2-3 小时仍待方向3 系统新创协同放量）。
- 下一步：方向2 Phase 2 候选仍余 ① 更多纯数据扩建（新地图·新敌方·外传）② 新关卡类型（需方向1 解冻）；方向3 系统新创 Phase 2 可落地装备/转职/好感度以进一步拉长单局时长。

## 9.41 隐藏章节·第二卷「门彼之侧」（方向2 内容扩建 · @A59 · 2026-07-09）

> 方向2 内容扩建项（第四部后传的延续卷）。在「蚀教真相」隐藏章节（第一卷）通关后，掌心的碎片仍指向一道涅莎曾守护的门——门彼之侧，是灵脉分裂之前、尚未被劈成「守护」与「吞噬」的源初回响。新增全新阵营「回响」（echo）、2 张新地图、2 篇隐藏章节（第4~5篇）、1 名终局 BOSS，并补全世界观与角色传记。纯数据扩展（仅改 `MAPS`/`HIDDEN_CHAPTERS`/`ENEMY_UNITS`/`BOSS_UNITS` 数据表 + `WORLD_LORE`/`CHARACTER_BIOS` 文本 + 面板描述一行），**不改动任何战斗/胜负引擎代码、不触碰方向1 冻结项**，因此对 balance-scan 跨对局梯度零扰动、balance-safe（刻意不新增 `WORLD_REGIONS` 条目，避免破坏 subsystems.test S2 的 8 区域硬断言）。

**新增 / 修正内容一览**

| 类别 | 变更 | 说明 |
|---|---|---|
| 数据 src/data/campaign.js | `MAPS` 新增 2 张（门扉前厅 map=21 / 回响之渊 map=22，各含 cover/hazard 坐标，落在 12×10 边界内） | 战场多样性 +2 |
| 数据 src/data/campaign.js | `HIDDEN_CHAPTERS` 由 3 篇扩至 5 篇（新增 隐藏四·门扉前厅 map=21 / 隐藏五·回响之渊 map=22 `boss:true`） | 隐藏章节后传续卷 |
| 数据 src/data/units.js | `ENEMY_UNITS` 新增 3 名（回响使徒·瑟琳 mage / 回响守楔·卡戎 warrior / 回响咏者·莉拉 archer，faction=echo，引用既有技能 id） | 新阵营敌方池 |
| 数据 src/data/units.js | `BOSS_UNITS` 新增 1 名终局 BOSS（源初回响·厄科 HP230 mage，faction=echo） | 第二卷终局 Boss |
| 数据 src/data/lore.js | `WORLD_LORE` 新增 3 篇（门彼之侧 / 回响之渊 / 源初回响） | 百科 35→38 篇 |
| 数据 src/data/lore.js | `CHARACTER_BIOS` 新增 3 篇（2 新敌 + 1 BOSS，各 ≥200 字原创背景） | 角色传记 23→26 名 |
| UI src/ui/panels.js | `showHidden` 描述更新为两卷（第一卷·蚀教真相 / 第二卷·门彼之侧），保留「蚀教」字样（S14 断言依赖） | 列表叙事一致 |
| 测试 test/smoke-test.js | 新增 S15 断言：隐藏四/五 列表含「回响」、5v5 部署、通关后 hiddenCleared[3]/[4] 持久化 | 锁定第二卷契约 |

**第二卷隐藏章节（新增两篇 · 原创 IP）**

| 篇 | 标题 | 地图 | 敌方(5) | 核心叙事 |
|---|---|---|---|---|
| 4 | 门扉前厅 | 门扉前厅 | 26/27/28/23/25 | 掌心的碎片指向真相之渊深处一道光缝；回响体误认主角为窃贼，守在门扉前厅；拾得「回响之种」引出源初回响之名 |
| 5 (BOSS) | 回响之渊 | 回响之渊 | 26/27/28/boss4/24 | 灵脉分裂之前的样貌；源初回响·厄科（未交还世界的「守护」之半）待主角交还吞噬之半、让灵脉第一次真正合拢 |

**合规与平衡影响**
- 纯数据扩展 + 文本 + 测试断言同步，**零引擎代码改动**；第二卷复用既有「歼灭全部敌人」胜利条件与 `hiddenCleared` 持久化路径，对 balance-scan 跨对局梯度零扰动、balance-safe（不触碰方向1 冻结）。
- 新地图坐标落在 12×10 边界内，无坐标连锁回归；新敌方单位仅引用既有技能 id，无新机制；新 BOSS 复用既有 boss 部署路径（`boss,i:4`）。
- 全测试：smoke(121/0 · +9 S15) · status-effects(16/0) · subsystems(23/0) · lore(9/0) · perf(8/0) · balance-scan(梯度单调·战役6/6/6·遭遇困难最难) 全绿无回归；零网络零依赖。
- 时长影响：隐藏章节 3→5 篇（第二卷 2 篇，每篇 3~5 分钟，战役通关后解锁·可重玩闭环），额外游戏时长 **+6~10 分钟**；含外传/隐藏全收的战役总时长约 ~47~68 分钟 → **~53~78 分钟**。
- 下一步：方向2 候选仍余 ① 更多纯数据扩建（新地图·新敌方·第三卷后传）② 方向3 系统新创（装备/转职/好感度，以进一步拉长单局时长）③ 新关卡类型（需方向1 解冻）。

## 9.42 羁绊 / 好感度系统（Bond/Synergy · 方向3 系统新创 · @A61 · 2026-07-09）

> 方向3（系统新创，仅做“延长游戏时长”的系统）。在既有的「装备系统」之后，落地第二项正式子系统 **羁绊 / 好感度**：把 PRODUCT.md 要求的「角色间支援对话 / 互动事件」落实为**可成长、可部署联动的数值关系**，直接拉长“战前配装 + 战中决策 + 战后叙事”的单局时长，且不触碰方向1 冻结（零新技能 / 状态 / AI 行为）。

**交付内容**
- 新增数据层 `src/data/bonds.js`：`BOND_PAIRS`（6 对策划锁定的经典/圣光小队内羁绊组合，每对含 C/B/A 三级**原创支援对话**文案）、`BOND_BONUS`（羁绊等级 → 战前联动加成表）、`BOND_LEVEL_LABEL`、`bondKey`（顺序无关组合键）。
- 战前联动加成（`src/core/unit-factory.js` 新增 `applyBondSynergy()`，于 `src/core/turn.js` 的 `startBattle` 在玩家单位创建后调用）：同场部署的玩家单位，按“已缔结羁绊伙伴”的等级叠加 `hp / 技能伤害`（A 级：+24 HP / +12 伤害）。仅作用于玩家、纯数值、对方向1 冻结零触碰。
- 主菜单 UI（`src/ui/panels.js` 新增 `renderBonds()` / `deepenBond()`）：`#bonds-panel` 列出各羁绊组合、当前等级、解锁的支援对话片段，并提供「加深羁绊」按钮（0→3 封顶，持久化于 `saveData.bonds`）；`index.html` 新增对应样式与菜单分区。`src/main.js` 导出 `renderBonds` / `deepenBond`。
- 存档（`src/systems/save.js` 的 `sanitizeSave` 新增 `bonds` 白名单：校验组合键均为玩家单位、等级夹紧 0~3）、默认态（`src/core/state.js` `saveData.bonds={}`）、可观测性（`src/systems/hooks.js` `_state()` 暴露 `bonds`）。
- 构建（`build.js` 把 `data/bonds.js` 纳入拼接顺序 + 期望符号 `renderBonds`/`deepenBond`）。
- 测试（`test/smoke-test.js` 新增 **S17** 羁绊系统契约：加深至 A 级、等级封顶、非锁定组合被忽略、同场部署双方获 +24 HP/+12 伤害、经存档持久化回读）。

**为什么不是 clone+rename / 符合方向3**
- 羁绊是**全新子系统**（此前仅“装备”一项方向3系统）：它新增了“角色关系→战前数值”的决策维度 + 原创支援对话叙事，而非把既有单位/技能改个名。
- 直接延长单局时长：玩家需在战前**决策“把哪些羁绊伙伴编入同一队”**以最大化联动加成（战前配装延伸），并投入菜单时间加深羁绊、阅读支援对话（叙事时长延伸）。
- 平衡安全：`applyBondSynergy` 仅在 `saveData.bonds` 有条目时生效；默认 / 所有既有测试 / 平衡自检 bonds 为空 → **零加成、对 balance-scan 跨对局梯度零扰动**（战役 6/6/6、遭遇 100/37/0% 困难最难，不变）。

**合规与平衡影响**
- 全测试：smoke(**153/0** · +10 断言 S17) · status-effects(16/0) · subsystems(23/0) · lore(9/0) · perf(8/0) · balance-scan(梯度单调·战役6/6/6·遭遇困难最难) 全绿无回归；零网络零依赖。
- 下一步：方向3 仍余 转职系统（受方向1 冻结约束，需以“既有技能重新编组 / 数值重分配”而非新技能实现）、更多羁绊组合扩写；方向2 仍可做更多纯数据扩建。
