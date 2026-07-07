# BLACKBOARD.md — 共享黑板

## Status（项目状态）
- **开发模式：方向驱动（Direction-Driven）** — 项目不设硬指标、无终点。5 个开发方向（§2.5 设计文档）：核心玩法／内容扩建／系统新创／体验打磨／工程基石。每次调用必须在至少一个方向上产生推进。
- **最后推进**：2026-07-07 14:00 — 方向4 体验打磨：新增**飘字反馈（Floating Combat Text）**——伤害/治疗/状态结算/DoT/危险格在单位上方弹出文字并逐帧上浮淡出（`pushFloater` + `drawFloaters` + `floaters` 状态队列，`_state()` 已暴露）；与既有状态标记（晕/燃/冰/毒/盲）共同构成完整战斗视觉反馈；零网络零依赖，冒烟/状态/平衡/性能套件全绿无回归。

## Goal
按 PRODUCT.md 推进游戏开发，每次调用在至少一个开发方向上（§2.5）产生推进。角色由 Agent 自行涌现。项目不设终点，只有用户 `freeze` 才停。

## Capabilities（能力覆盖 · 由 Agent 自我声明）
- ~~standby @A21 : 待命期治理~~ **（已废弃 — 见 D20）**
- frontend+arch @A1 : 前端游戏骨架 + 产品架构协调 + 基础设施文件（已完成基础设施交付，idle）
- docs+qa+ui @A7 : 文档（README/游戏机制）+ QA审查 + UI打磨优化（已完成本轮交付，idle）
- coordinator+devops @A8 : 黑板状态同步 + 终止条件审核 + 静态打包脚本（已完成，idle）
- security @A9 : 输入校验与存档完整性审查（已完成本轮交付，idle）
- content @A10 : 阶段二拓展（新机制/新内容设计）+ 文档与实现一致性维护（本轮交付后 idle）
- generalist @A11 : 阶段二手感优化 / 通才兜底（本轮交付后 idle）
- control @A12 : 阶段二拓展（控制技能机制 / 新战术维度）+ 实现与文档一致性（本轮交付后 idle）
- status @A13 : 阶段二拓展（持续伤害 DoT 机制 / 新状态效果）+ 实现与文档一致性（本轮交付后 idle）
- freeze @A14 : 阶段二拓展（定身控制机制 / 新状态效果"冰冻"）+ 实现与文档一致性（本轮交付后 idle）
- poison @A15 : 阶段二拓展（中毒/治疗削弱机制 / 新状态效果"中毒"）+ 实现与文档一致性（本轮交付后 idle）
- campaign+content @A16 : 阶段二子系统（战役进度 + 多地图地形 + 单局遭遇）+ 单位池扩展（≥12单位/三阵营各≥4）+ 阵营差异化AI + localStorage进度；实现与文档一致性（本轮交付后 idle）
- balance+systems @A17 : 阶段三打磨（数值平衡子系统 · 难度选择）+ 菜单难度 UI + createUnit 敌方缩放；实现与文档一致性（本轮交付后 idle）
- qa @A18 : 阶段三"测试全绿"——纯 Node 零依赖冒烟测试（无浏览器/Vitest/网络），驱动真实引擎跑通战役/危险格地图/遭遇/胜/负全路径；为可测性加只读 _state() 钩子
- balance @A19 : 阶段三"数值平衡"——纯 Node 自对弈平衡自检（vm 加载真实引擎 + 称职玩家代理驱动战役/遭遇），量化三档难度胜率梯度并据此调参（DIFFICULTY 由 1.35×1.35 修正为 HP×1.25/伤害×1.10），交付 §2.5 阶段三"数值平衡"checklist；DESIGN §9.7/§9.9 同步
- perf @A20 : 阶段三"性能优化"——静态层离屏缓存（背景+网格线+地形绘制一次/地图，逐帧 drawImage 合成 + 动态层），交付 §2.5 阶段三"性能优化"checklist；为可测性加只读 _perf() 钩子；DESIGN §9.10 同步
- analysis @A22 : 方向3 系统新创（战力评估/比分预测）——evaluateSideScore/predictOutcome/updateBattlePrediction 纯函数 + 侧栏 #battle-predict 实时刷新；零侵入战斗逻辑，DESIGN §9.11 同步
- status2 @A23 : 核心玩法拓展（致盲状态效果 · 削弱敌方输出）+ 实现与文档一致性（idle）
- qa2 @A24 : 方向5 工程基石（状态效果回归测试 · 为 A12~A23 状态机制补齐确定性安全网）+ 实现与文档一致性（idle）
- polish @A25 : 方向4 体验打磨（视觉反馈 · 飘字反馈 floating combat text）+ 实现与文档一致性（idle）

## Backlog（待认领 · 方向参考）
<!-- 方向标签：方向1:核心玩法 / 方向2:内容扩建 / 方向3:系统新创 / 方向4:体验打磨 / 方向5:工程基石 -->
- [ ] 新增一个状态效果（如恐惧/致盲/嘲讽）  #方向1:核心玩法
- [ ] 新增一个阵营（如暗影/圣光）含 4 单位 + 8 技能  #方向2:内容扩建
- [ ] 装备系统：单位可携带装备改变属性/技能  #方向3:系统新创
- [ ] 主菜单/UI 视觉升级（动画过渡、选中反馈）  #方向4:体验打磨
- [ ] Vitest 单元测试搭建（需先确认网络可用）  #方向5:工程基石
- [ ] 以上仅为启发性建议。Agent 应自行判断当前游戏最缺什么，提出新任务。

## In-Progress（进行中）
（当前无进行中任务，下一轮由 Agent 涌现后认领）

## Done（已完成）
- ✅ PRODUCT.md 已创建 — 产品规格与验收标准  @A1(frontend+arch) 2026-07-06
- ✅ BLACKBOARD.md 已创建 — 共享黑板含 Capabilities + 12 项 Backlog  @A1(frontend+arch) 2026-07-06
- ✅ PROTOCOL.md 已创建 — 自治协议（角色涌现 + 决策循环）  @A1(frontend+arch) 2026-07-06
- ✅ index.html + game.js 已创建 — 可直接打开运行的 MVP 游戏骨架  @A1(frontend+arch) 2026-07-06
- ✅ F1 网格战场渲染（Canvas 8×8，选中/点击交互）  Evidence: game.js drawGrid/drawUnits/onCanvasClick  2026-07-06
- ✅ F2 单位系统与移动/选中（每方3法师，移动范围高亮）  Evidence: game.js createUnit/handleSelectUnit/handleMove/getMoveCells  2026-07-06
- ✅ F3 技能系统（6技能定义，施法、冷却、伤害结算）  Evidence: game.js SKILL_DEFS/applySkill/castSkill  2026-07-06
- ✅ F4 回合制战斗循环与胜负判定（玩家回合→敌方AI→新回合→胜负弹窗）  Evidence: game.js endTurn/nextTurn/checkGameEnd  2026-07-06
- ✅ F5 敌方 AI（基于规则：自保治疗+攻击低HP+移动靠近+攻击/治疗兜底）  Evidence: game.js executeEnemyTurn/aiDecide  2026-07-06
- ✅ F6 本地存档（localStorage：W/L 战绩持久化）  Evidence: game.js loadSave/saveSave  2026-07-06
- ✅ README.md 文档（游戏概述/快速开始/操作/单位技能表/项目结构）  @A7(docs+qa+ui) 2026-07-06
- ✅ DESIGN.md 游戏机制文档（战场/单位/技能数值/战斗流程/AI规则/存档/UI）  @A7(docs+qa+ui) 2026-07-06
- ✅ README.md 补充 F7 build.js 启动方式  @A8(coordinator+devops) 2026-07-06
- ✅ game.js 边界修复：空地取消选中 / 取消施法不消耗技能 / 无行动提示优化  @A8(coordinator+devops) 2026-07-06
- ✅ F7 静态打包脚本 build.js（Node 零依赖，dist/ 7 文件 42.59KB）  @A8(coordinator+devops) 2026-07-06
- ✅ 黑板状态与 LOG 对齐（A7/A8 任务全部归档）  @A8(coordinator+devops) 2026-07-06
- ✅ 终止条件审核：P0/P1 全 DONE · README 完备 · DESIGN 与实现一致 · 黑板无 BLOCKED  @A8(coordinator+devops) 2026-07-06
- ✅ 输入校验与防作弊审查（本地代码审查 + loadSave 存档格式校验/钳制）  @A9(security) 2026-07-06
- ✅ EXPAND 范围伤害(AoE)机制落地 + 新技能"陨石术"(dmg18/range4/CD2/aoeRadius1)  @A10(content) 2026-07-07 — 复用 SKILL_DEFS 闲置的 aoeRadius 字段；莫甘娜(meteor↔shadowbolt)、安娜(meteor↔fireball)换装，保持每方3单位/每单位3技能  Evidence: game.js applySkill(SKILL_DEFS.meteor)/handleSelectTarget/aiDecide + DESIGN §3.5
- ✅ IMPROVE 手感优化：单位施法/跳过后自动选中下一个未行动玩家单位（selectNextPlayerUnit），减少手动点击  @A11(generalist) 2026-07-07 — Evidence: game.js handleSelectTarget/skipUnit + DESIGN §8.1；node --check game.js → SYNTAX_OK
- ✅ EXPAND 控制技能"眩晕术"(stun, range3/CD3, isStun) 落地：雷法师·特斯拉以 stun 替换 frostbolt；敌方单位被眩晕时跳过其下个回合行动；含视觉"晕"标记与 UI 状态提示  @A12(control) 2026-07-07 — 复用既有 SKILL_DEFS 结构与 getUnitAt 校验，遵守"每方≤3单位/单位2~3技能"约束  Evidence: game.js SKILL_DEFS.stun/handleSelectTarget/applySkill/executeEnemyTurn/drawUnits/updateUI + DESIGN §3.6；node --check game.js → SYNTAX_OK
- ✅ EXPAND 持续伤害 DoT"灼烧术"(burn, range3/CD2/isBurn) 落地：炎法师·艾拉以 burn 替换 frostbolt、骷髅法师·卡尔以 burn 替换 frostbolt；敌方单位被点燃后在每个回合开始时受到 6 点燃烧伤害（可叠加，上限 4 回合）；含视觉"燃"标记与 UI 灼烧提示  @A13(status) 2026-07-07 — 复用 SKILL_DEFS 既有结构（新增 isBurn/burnTurns/burnDmg 字段），遵守"每方≤3单位/单位2~3技能"约束  Evidence: game.js SKILL_DEFS.burn/handleSelectTarget/applySkill/nextTurn/drawUnits/updateUI + DESIGN §3.7；node --check game.js → SYNTAX_OK
- ✅ EXPAND 定身控制"冰冻术"(freeze, dmg6/range3/CD2/isFreeze) 落地：暗法师·莫甘娜以 freeze 替换原冰霜箭；敌方单位被冰冻后在 frozenTurns(2) 回合内无法移动（仍可原地施放/攻击），回合边界递减、归零解除；与眩晕(跳过整回合)形成差异化定位控制；含视觉"冰"标记与 UI 冰冻提示  @A14(freeze) 2026-07-07 — 复用 SKILL_DEFS 既有结构（新增 isFreeze/freezeTurns 字段与单位 frozenTurns 状态），遵守"每方≤3单位/单位2~3技能"约束  Evidence: game.js SKILL_DEFS.freeze/createUnit/handleSelectTarget/applySkill/startMove/nextTurn/drawUnits/updateUI/aiDecide + DESIGN §3.6；node --check game.js 与 dist/game.js → SYNTAX_OK
- ✅ EXPAND 持续伤害+治疗削弱"中毒术"(poison, dmg4/range3/CD2/isPoison) 落地：暗影巫·维克以 poison 补入技能槽（2→3 技能，不突破约束）；造成 4 直接伤害并使敌方中毒（poisonTurns=3），每回合受 poisonDmg 毒性伤害（伤害可叠加、上限 poisonMax=12），中毒期间治疗减半（applySkill 治疗分支 + aiDecide 两处统一生效）；含视觉"毒"标记与 UI 中毒提示  @A15(poison) 2026-07-07 — 复用 SKILL_DEFS 既有结构（新增 isPoison/poisonTurns/poisonDmg/poisonMax 字段与单位中毒状态），遵守"每方≤3单位/单位2~3技能"约束  Evidence: game.js SKILL_DEFS.poison/ENEMY_UNITS(维克)/createUnit/handleSelectTarget/applySkill(heal减半+isPoison)/nextTurn(中毒tick)/drawUnits/updateUI/aiDecide(heal减半×2) + DESIGN §3.1/§3.8/§4.1/§8.3；node --check game.js 与 dist/game.js → SYNTAX_OK
- ✅ SYSTEM 战役进度子系统落地（阶段二"至少1个新子系统"要求）：主菜单(#menu) + 模式选择（战役/单局遭遇）+ FACTIONS(三阵营差异化AI风格) + MAPS(6张含掩体/危险格地形) + CAMPAIGN(6关递进·第6关Boss) + BOSS_UNITS(马尔佐斯) + 单位池扩展至12种(三阵营各4) + localStorage进度(unlockedLevel) + 地形减伤(damageUnit×0.7)与危险格回合结算(nextTurn)  @A16(campaign+content) 2026-07-07 — 直接交付 §2.5 阶段二多项 checklist：地图≥6/战役≥6含Boss/单局遭遇/敌方AI分阵营风格/本地进度存档；零网络零依赖，node --check game.js → SYNTAX_OK  Evidence: game.js FACTIONS/MAPS/CAMPAIGN/BOSS_UNITS/startBattle/showMenu/startCampaign/startSkirmish/retry/damageUnit/coverAt/hazardAt/nextTurn(危险格)/aiDecide(分阵营) + index.html(#menu/#overlay-action) + DESIGN §9；node --check game.js 与 build.js → SYNTAX_OK

- ✅ SYSTEM 难度选择子系统落地（阶段三"数值平衡"）：主菜单 简单/普通/困难 三档，仅缩放敌方 HP×{0.8/1.0/1.35} 与伤害×{0.8/1.0/1.35}；DIFFICULTY 数据驱动 + createUnit 部署时缩放 + setDifficulty 菜单切换；玩家小队保持 §2.2 基准不变  @A17(balance+systems) 2026-07-07 — Evidence: game.js DIFFICULTY/setDifficulty/createUnit(敌方缩放) + index.html(#menu 难度行+CSS) + DESIGN §9.7；node --check game.js → SYNTAX_OK；构成 §2.5 阶段三"数值平衡"首个交付项
- ✅ TEST 纯 Node 零依赖冒烟测试落地（阶段三"测试全绿"）：新增 magic-arena/test/smoke-test.js（仅用 Node 内置 vm/fs/path，零 npm/零网络），mock DOM/Canvas/localStorage/setTimeout 后在 vm 内加载真实 game.js，驱动 6 个场景（难度三档/战役部署/玩家主动出战至分胜负/失败分支/危险格地图回合结算/遭遇模式）共 19 条断言全绿；为可测性给 game.js 加只读 _state() 钩子（不改动任何游戏行为）  @A18(qa) 2026-07-07 — Evidence: node test/smoke-test.js → 通过 19/失败 0；node --check game.js 与 dist/game.js → 均 SYNTAX_OK；构成 §2.5 阶段三"测试全绿"交付项（Vitest 需网络，以纯 Node 自检替代）
- ✅ SYSTEM+BALANCE 数值平衡自检与调参（阶段三"数值平衡"）：新建 magic-arena/test/balance-scan.js（vm 加载真实引擎 + 称职玩家代理自对弈，战役 6 关确定性 + 遭遇每档 60 局 seeded 随机），量化三档难度胜率梯度；发现原困难档（HP×1.35/伤害×1.35）玩家胜率 **0%**（实质不可赢）→ 调 DIFFICULTY 为 简单 HP×0.70/伤害×0.75、普通 ×1.0、困难 HP×1.25/伤害×1.10，梯度恢复 简单 6/6(75%) ≥ 普通 4/6(52%) ≥ 困难 1/6(13%)，困难转为「有挑战但可赢」  @A19(balance) 2026-07-07 — Evidence: node test/balance-scan.js → 退出码 0（梯度健康）；node test/smoke-test.js → 通过 19/失败 0；node --check game.js 与 dist/game.js → 均 SYNTAX_OK；DESIGN §9.7/§9.9 同步；构成 §2.5 阶段三"数值平衡"交付项
- ✅ PERF 渲染性能优化（阶段三"性能优化"）：静态层离屏缓存——`buildStaticLayer()` 把「背景+网格线(18条)+地形(掩体/危险格)」绘制进离屏画布 `staticCanvas`，`render()` 在地图不变时直接 `drawImage` 合成 + 叠加动态层（高亮/单位/HP条/状态标记），仅切换地图时重建缓存（由 `staticMapId` 判定）；零侵入游戏逻辑（移动/施法/AI/胜负路径不变）；为可测性加只读 `_perf()` 钩子（返回 staticRebuilds/hasStaticLayer/staticMapId）  @A20(perf) 2026-07-07 — Evidence: node test/perf-check.js → 通过 8/失败 0（同一雪山顶地图 30 帧交互后 staticRebuilds=2、moveTo=36(=18×重建次数)、strokeRect=1、drawImage=181，网格/地形不逐帧重绘，绘制调用较无缓存减少约 93%）；node test/smoke-test.js → 通过 19/失败 0（行为无回归）；node --check game.js 与 dist/game.js → 均 SYNTAX_OK；DESIGN §9.10 同步；交付阶段三"性能优化"项
- ✅ SYSTEM 战力评估与比分预测（方向3 系统新创）：新增纯函数 `evaluateSideScore(units)`（生存力+技能攻防价值+控制/DoT战术价值+机动性评分）与 `predictOutcome(playerUnits, enemyUnits)`（逻辑斯蒂胜率映射），侧栏 `#battle-predict` 面板在布阵与每回合 `updateUI` 时刷新「我方:敌方」战力比分条与预估胜率；零侵入战斗逻辑（不参与任何伤害/状态/胜负结算），暴露 `predictOutcome/evaluateSideScore/updateBattlePrediction` 供纯 Node 验证  @A22(analysis) 2026-07-07 — Evidence: node --check game.js 与 dist/game.js → 均 SYNTAX_OK；node test/smoke-test.js → 通过 19/失败 0（mock DOM 下新增 UI 代码安全、无行为回归）；DESIGN §9.11 同步；构成 §2.5 方向3「赛前分析 / 决策辅助」维度新子系统（直接回应"看下比赛比得分"）
- ✅ EXPAND 致盲状态效果「致盲术」(blind, dmg0/range3/CD2/isBlind) 落地（方向1 核心玩法）：使敌方目标致盲 2 回合，期间其造成的所有伤害降低 50%（首个"削弱敌方输出"的 debuff，与眩晕/冰冻"限制行动"、灼烧/中毒"持续掉血"正交的"攻防压制"维度）；复用 SKILL_DEFS 结构与 `damageUnit(attacker)` 参数化减伤 + `nextTurn` 致盲结算 + 视觉"盲"标记 + UI 提示 + `_state` 暴露 `blindTurns/isBlind` + `evaluateSideScore` 加 `+14` 战术价值；`sortedAttackSkills` 显式排除 `isBlind` 使敌方 AI 不误放；暗法师·莫甘娜以 blind 替换原冰冻术（保留陨石术/生命汲取），遵守"每方≤3单位/单位2~3技能"约束  @A23(status2) 2026-07-07 — Evidence: node --check game.js 与 dist/game.js → 均 SYNTAX_OK；node test/smoke-test.js → 通过 19/失败 0；node test/balance-scan.js → 退出码 0（梯度 易4/普3/难0·遭遇 62/60/23% 健康）；node test/perf-check.js → 通过 8/失败 0；DESIGN §3.1/§3.9/§4.1/§8.3/§9.11 同步；零网络零依赖
- ✅ TEST 状态效果回归测试落地（方向5 工程基石）：新增 `magic-arena/test/status-effects.test.js`（纯 Node 零依赖，复用 smoke-test 的浏览器环境 mock + vm 加载真实 game.js，setTimeout 同步化），通过公开 API（`_state`/`startCampaign`/`castSkill`/画布点击/`endTurn`）确定性验证 A12~A23 落地的状态机制——眩晕(应用+敌方跳过行动+标记消费)、灼烧(应用+回合边界 DoT 结算 `burnDmg`+计数递减)、致盲(应用+2 回合生命周期 + 输出伤害 ×0.5 修正，日志实测陨石术 18→9)、冰冻/中毒(敌方技能数据仍正确接线 `isFreeze`/`isPoison`)；共 12 条断言全绿  @A24(qa2) 2026-07-07 — Evidence: node test/status-effects.test.js → 通过 12/失败 0；与 smoke(19/0)/balance-scan(梯度健康)/perf-check(8/0) 一并构成零网络回归套件全绿（game.js 未改动，dist 与源码一致）；DESIGN §9.12 同步；零网络零依赖
- ✅ POLISH 飘字反馈（Floating Combat Text，方向4 体验打磨）：新增 `pushFloater(gx,gy,text,kind)` + `floaters` 状态队列 + `drawFloaters()`（在 `render()` 末尾绘制，随帧上浮并淡出 life 30→0）；覆盖伤害(`-N` 红)、治疗(`+N` 绿)、灼烧 DoT(`燃N` 橙)、中毒 DoT(`毒N` 黄绿)、危险格(`危N` 浅红)、状态施加确认(`眩晕/灼烧/冰冻/中毒/致盲` 淡紫)；`floaters` 经 `_state()` 暴露供纯 Node 验证；与既有状态标记（晕/燃/冰/毒/盲）共同构成完整战斗视觉反馈  @A25(polish) 2026-07-07 — Evidence: 临时验证脚本驱动真实引擎跑通战役 → `floaters` 实时生成(max 12)、`kind` 含 damage 与 status 均命中；node --check game.js 与 dist/game.js → SYNTAX_OK；smoke(19/0)/status-effects(12/0)/balance-scan(退出码0)/perf-check(8/0) 全绿无回归；DESIGN §8.3 同步；零网络零依赖

## Discussions（讨论区）
- D1: 初始版本采用纯 HTML+JS（无构建工具），后续 Agent 可升级为 TypeScript + Vite 构建链。
- D2: 战场 8×8 网格，每方 3 个法师，每人 2~3 技能。
- D3: 敌方 AI 初始版本仅攻击不治疗，已由 A7 补全治疗逻辑。
- D4: 本轮 A8 审核——LOG.md 显示 A7 任务 22:46 DONE，但黑板 In-Progress 未清理；现统一回填 Done 状态。
- D7: 本轮 A10 引入 AoE 机制，复用 SKILL_DEFS 既有 aoeRadius 字段（此前恒为 0）；莫甘娜以 meteor 替换 shadowbolt、安娜以 meteor 替换 fireball，避免突破"每方≤3单位 / 单位2~3技能"约束。
- D9: 本轮 A12 引入控制技能"眩晕术"，复用 SKILL_DEFS 既有结构（新增 isStun 字段与单位 stunned 状态）；特斯拉以 stun 替换 frostbolt，避免突破"每方≤3单位 / 单位2~3技能"约束。
- D10: 本轮 A13 引入持续伤害(DoT)技能"灼烧术"，复用 SKILL_DEFS 既有结构（新增 isBurn/burnTurns/burnDmg 字段与单位燃烧状态）；艾拉与卡尔各以 burn 替换 frostbolt，避免突破约束；灼烧可叠加（上限4回合），在 turn boundary 通过 nextTurn 统一结算。
- D11: 本轮 A14 引入定身控制技能"冰冻术"，复用 SKILL_DEFS 既有结构（新增 isFreeze/freezeTurns 字段与单位 frozenTurns 状态）；莫甘娜以 freeze 替换 frostbolt，避免突破"每方≤3单位/单位2~3技能"约束。冰冻=禁止移动但保留攻击/施法（与眩晕"跳过整回合"形成细粒度差异化控制）；冰冻不叠加（取 max）。状态基线(§1.5)的 5 种状态效果已覆盖 灼烧/冰冻/眩晕/治疗，仅"中毒"待补。
- D12: 本轮 A15 引入中毒机制"中毒术"，复用 SKILL_DEFS 既有结构（新增 isPoison/poisonTurns/poisonDmg/poisonMax 字段与单位中毒状态）；暗影巫·维克以 poison 补入技能槽（2→3 技能，不突破约束）。中毒 = 持续毒性伤害（伤害可叠加、上限12）+ 治疗减半 debuff，与灼烧（持续回合叠加）形成差异化 DoT。至此 §1.5 状态基线 5 种效果（灼烧/冰冻/中毒/眩晕/治疗）全部实现。
- D13: 本轮 A16 落地"战役进度"子系统（阶段二要求的自主新子系统）：以数据驱动 FACTIONS/MAPS/CAMPAIGN/BOSS_UNITS 实现主菜单+战役/遭遇模式；掩体减伤(damageUnit×0.7)与危险格回合结算(nextTurn)落地 §1.5 地形机制；单位池由6扩至12（三阵营各4）满足内容基线；敌方AI按阵营取 aiStyle（aggressive/defensive/skirmish）实现差异化；进度 unlockedLevel 持久化于 localStorage。不突破"每方≤3单位/单位2~3技能"约束。

## Blocked（阻塞）

## Decisions（决策记录）
| 编号 | 选项 | 选择 | 理由 |
|---|---|---|---|
| D1 | 构建方式：纯HTML直接运行 vs Vite+TS | 纯HTML直接运行 | 首轮无网络限制下无法 npm install，纯 HTML 可零依赖打开 |
| D2 | 战场规格 | 8×8 网格 / 每方 3 单位 | 平衡战术深度与 UI 可读性 |
| D3 | 敌方AI治疗阈值 | HP < 40 时触发治疗 | 太低无效，太高影响对抗节奏 |
| D4 | F7 打包方案 | Node.js 本地脚本拷贝到 dist/ | 遵循无网络约束，避免引入外部工具链 |
| D5 | 终止条件现状 | P0/P1 全 Done，本地可跑通；剩余 P2/P3 不阻塞交付 | 设计文档第 2.5 节验收标准已满足 |
| D6 | 防作弊策略 | 单机游戏不引入防作弊（无服务端），仅对本地存档做格式校验与钳制 | 篡改本地战绩属用户自主管辖，校验防止崩溃/异常显示 |
| D7 | 阶段二拓展方向 | 落地闲置的 AoE 字段 + 新技能"陨石术"，通过替换既有单位技能实现（不新增单位） | 复用已有 aoeRadius 字段零新依赖；遵守 PRODUCT "每方≤3单位/单位2~3技能"约束 |
| D8 | 阶段二手感优化 | 单位施法/跳过后自动选中下一个未行动单位（selectNextPlayerUnit），不自动结束回合；全部行动完才清空 | 减少手动重复点击、提升流畅度，同时保留玩家对"结束回合"的主动控制（不突破回合制边界） |
| D9 | 阶段二拓展方向（控制） | 引入"眩晕术"控制技能（替换特斯拉原冰霜箭），通过 `stunned` 状态使敌方下回合跳过行动 | 增加战术维度（先手控制/打断敌方治疗），复用既有字段零新依赖；遵守 PRODUCT "每方≤3单位/单位2~3技能"约束；眩晕不可叠加且受 CD3 限制 |
| D10 | 阶段二拓展方向（DoT） | 引入"灼烧术"持续伤害技能（艾拉与卡尔各替换原冰霜箭），通过 `burnTurns/burnDmg` 在回合边界结算燃烧伤害 | 增加持续压力维度，符合 §1.5 内容基线"灼烧"状态效果要求；复用 SKILL_DEFS 既有结构零新依赖；遵守 PRODUCT 约束；可叠加（上限 4 回合）限制总伤害 |
| D11 | 阶段二拓展方向（定身控制） | 引入"冰冻术"定身控制技能（莫甘娜替换原冰霜箭），通过 `frozenTurns` 禁止目标移动但保留攻击/施法 | 与眩晕（跳过整回合）形成细粒度差异化控制；填补 §1.5 状态基线"冰冻"；复用既有结构零新依赖；遵守 PRODUCT 约束；冰冻不叠加（取 max） |
| D12 | 阶段二拓展方向（中毒/治疗削弱） | 引入"中毒术"持续伤害+治疗削弱技能（维克补入技能槽，2→3 技能），通过 `poisonTurns/poisonDmg` 造成可叠加毒性伤害并使目标治疗减半 | 与灼烧（持续回合叠加）形成差异化 DoT；中毒期间治疗减半为独特 debuff；填补 §1.5 状态基线"中毒"，至此 5 种状态效果全部实现；复用既有结构零新依赖；遵守 PRODUCT 约束 |
| D13 | 阶段二"至少1个新子系统" | 落地"战役进度"子系统：主菜单+模式选择+数据驱动 MAPS(6张含掩体/危险格)/CAMPAIGN(6关含Boss)/BOSS_UNITS+单位池扩至12种(三阵营各4)+localStorage进度(unlockedLevel)+地形减伤/危险格结算+阵营差异化AI | 直接交付 §2.5 阶段二多项 checklist（地图≥6/战役≥6含Boss/单局遭遇/敌方AI分阵营/本地进度存档）；满足"自主提出新子系统"要求；零网络零依赖，不突破"每方≤3单位/单位2~3技能"约束 |
| D14 | 阶段三"数值平衡"如何交付 | 落地"难度选择"子系统：DIFFICULTY 数据驱动（简单/普通/困难）+ 仅缩放敌方 HP 与伤害（×0.8/1.0/1.35）+ 菜单按钮切换 setDifficulty + createUnit 部署时应用 | 玩家小队保持基准不变保证公平；难度档位可低成本扩展；直接推进 §2.5 阶段三"数值平衡" checklist，零网络零依赖；不突破"每方≤3单位/单位2~3技能"约束 |
| D15 | 阶段三"测试全绿"如何在无网络下交付 | 以纯 Node 零依赖冒烟测试替代 Vitest：用 vm 加载真实 game.js + mock 浏览器环境驱动完整战斗；为可测性加只读 `_state()` 钩子（仅暴露状态副本，不改行为） | Vitest 需 npm/网络，受无网络约束不可行；纯 Node 内置模块即可覆盖引擎主路径（部署/技能结算/状态tick/危险格/敌AI/胜负/存档），零新依赖、可重复运行，直接推进 §2.5 阶段三"测试全绿" checklist |
| D16 | 阶段三"数值平衡"如何量化并调参 | 以纯 Node 自对弈平衡自检（称职玩家代理驱动真实引擎）量化三档难度胜率梯度；发现原困难档 HP×1.35 + 伤害×1.35 导致玩家 0% 胜率（不可赢），修正为「敌方更肉、伤害略增」（HP×1.25 / 伤害×1.10），梯度恢复单调且困难可赢 | 困难档原双 1.35 使玩家每回合承受过高伤害且敌方过肉，实质不可赢；改为以 HP 缩放为主、伤害缩放克制，保留挑战性同时恢复可赢性；零网络零依赖，自检脚本可重复运行回归 |
| D17 | 阶段三"性能优化"如何交付 | 静态层离屏缓存：把「背景+网格线+地形」绘制进离屏画布，逐帧 `drawImage` 合成 + 叠加动态层，仅切换地图时重建；只读 `_perf()` 钩子供纯 Node 验证 | 网格/地形内容与地图绑定、逐帧不变化，缓存后可把每帧 Canvas 开销从「重绘整盘」降到「一次位图拷贝 + 少量动态绘制」，直接对应 §2.5 阶段三「无可见卡顿」；零侵入游戏逻辑、零新依赖、可纯 Node 断言验证缓存命中 |
| D18 | ~~RELEASED／待命~~ → **已废弃** | **此决策已被 D20 取代。项目已从"三阶段 + RELEASED／待命"模型转为"方向驱动"模型（§2.5）。不再有"完成"或"待命"概念。每次调用必须在至少一个开发方向上有所推进。** | 2026-07-07 11:41 用户明确要求"不设置指标，只设方向，每次调用必须在某一方向推进"；设计文档 §2.5 已全部重写；详见 D20 |
| D19 | 用户 12:00 轮指令的处置 | 用户消息"看下7.7日的比赛比得分"+"继续完成未完成的任务"视为新需求（非待命），按 §2.5 在方向3 系统新创推进"战力评估/比分预测"子系统；纯函数零侵入战斗逻辑、mock DOM 安全 | §2.5 规定"新用户指令即触发主动工作"；此前 21 轮因"无新需求"维持待命，本轮有明确用户指令故结束待命、恢复 active work；该子系统直接回应"比赛比得分"且风险可控（不改动既有结算/AI/胜负路径） |
| **D20** | **模型切换：RELEASED → 方向驱动** | **项目生命周期模型从"三阶段→RELEASED→待命"切换为"方向驱动（Direction-Driven）"。设计文档 §2.5 已全部重写，BLACKBOARD Status/Goal 已更新，D18 已作废。新规则：**不设指标、不设终点、5 个开发方向（核心玩法／内容扩建／系统新创／体验打磨／工程基石），每次调用必须在至少一个方向上推进。只有用户 `freeze` 才停止。** | 2026-07-07 11:34~11:41 用户连续两条指令："不设置明确指标,只设计若干开发方向,要求每次调用必须在某一方向上进行更新"。该指令优先级 > 旧 §2.5 待命规则。**所有 Agent 立即结束待命，下次调用必须在至少一个方向上产生推进。** |
| **D21** | **12:27 轮（Run #N+20）待命核验是否合规** | **不合规（违反 D20）。** 该轮在 D20 已生效（11:41）后仍按旧"RELEASED/待命"模型仅做只读健康核验、零代码改动，与 D20"每次调用至少在一个方向推进"直接冲突。现纠正：12:38 轮（Run #N+21）在方向1 核心玩法真实落地"致盲"新状态效果（改 game.js/dist/game.js/DESIGN.md/BLACKBOARD.md ≤5 文件，零网络），恢复方向驱动推进。 | D20 优先级最高且无豁免；"无新用户指令"不再是待命理由。后续自动轮无论有无显式新需求，均须认领至少一个方向并产出可验证改动（方向5 工程基石永远可用作兜底）。 |
| **D22** | **14:00 轮（Run #N+25）方向选择** | **方向4 体验打磨（视觉反馈）**。五方向健康度扫描显示方向4 持续相对偏薄（缺乏即时战斗反馈层）；本轮落地**飘字反馈（Floating Combat Text）**——单位受击/治疗/状态结算/DoT/危险格时在其上方弹出文字并逐帧上浮淡出，与既有状态标记（晕/燃/冰/毒/盲）共同构成完整视觉反馈闭环。 | 不新增单位/技能、零侵入战斗逻辑（仅 `pushFloater` + `drawFloaters` 渲染层 + `floaters` 状态队列，`_state()` 暴露供方向5 纯 Node 验证）；直接对应 §2.5 方向4「视觉反馈」打磨；遵守 ≤5 文件限制（game.js/dist/game.js/DESIGN.md/BLACKBOARD.md = 4 文件，LOG 不计）。 |
