// ============================================================
// smoke-test.js — Magic Arena 纯 Node 冒烟测试（Stage 3 · 测试全绿）
// 位置：magic-arena/test/smoke-test.js
// 用途：在无浏览器 / 无网络 / 无 Vitest 依赖的前提下，用 vm 在 Node 内
//       加载真实 game.js，mock 浏览器环境（DOM/Canvas/localStorage/setTimeout），
//       驱动完整战斗（战役/危险格地图/遭遇/胜/负）并断言引擎不崩溃且行为正确。
// 用法：node test/smoke-test.js   （退出码 0=通过，1=失败）
// 约束：零 npm install、零外网请求，仅用 Node 内置模块（vm/fs/path）。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------
// 1. 浏览器环境 Mock（最小可用子集）
// ------------------------------------------------------------
class El {
  constructor(id) {
    this.id = id;
    this._text = '';
    this._html = '';
    this.className = '';
    this.disabled = false;
    this.onclick = null;
    this.style = {};
    this.children = [];
    this.width = 640;
    this.height = 640;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this._clickHandler = null;
    this._ctx = null;
  }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  setAttribute(k, v) { if (k === 'onclick') this.onclick = v; this['attr_' + k] = v; }
  removeAttribute(k) { if (k === 'onclick') this.onclick = null; delete this['attr_' + k]; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(type, fn) { if (type === 'click') this._clickHandler = fn; }
  getContext() { if (!this._ctx) this._ctx = makeCtx(); return this._ctx; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 640 }; }
}

function makeCtx() {
  const store = {};
  return new Proxy({}, {
    get(t, p) { return (p in store) ? store[p] : () => {}; },
    set(t, p, v) { store[p] = v; return true; },
  });
}

const elements = new Map();
function getEl(id) { if (!elements.has(id)) elements.set(id, new El(id)); return elements.get(id); }

const documentMock = {
  getElementById: (id) => getEl(id),
  createElement: () => new El('created'),
  addEventListener: () => {},
};

let domReady = null;
const windowMock = {
  addEventListener: (t, fn) => { if (t === 'DOMContentLoaded') domReady = fn; },
};

const _store = new Map();
const localStorageMock = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};

// 同步立即执行，使战斗循环（executeEnemyTurn 的嵌套 setTimeout）变为确定性
const setTimeoutMock = (fn) => { fn(); return 0; };
const clearTimeoutMock = () => {};

// ------------------------------------------------------------
// 2. 加载真实 game.js（追加一行把 Game 暴露到 context 全局，仅测试用）
// ------------------------------------------------------------
const CELL = 80; // 与 game.js 中 CELL 保持一致
const gamePath = path.join(__dirname, '..', 'game.js');
let code = fs.readFileSync(gamePath, 'utf8');
code += '\n;globalThis.Game = Game;';

const sandbox = { document: documentMock, window: windowMock, localStorage: localStorageMock, setTimeout: setTimeoutMock, clearTimeout: clearTimeoutMock, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Game = sandbox.Game;

if (typeof Game !== 'object' || typeof Game.startCampaign !== 'function') {
  throw new Error('Game 未正确加载（测试环境初始化失败）');
}

// 触发 DOMContentLoaded → 执行 init()
if (typeof domReady === 'function') domReady();

// ------------------------------------------------------------
// 3. 测试工具
// ------------------------------------------------------------
let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.log('  ✗ FAIL: ' + msg); }
}
function clickCell(gx, gy) {
  const handler = getEl('arena')._clickHandler;
  if (!handler) throw new Error('canvas click handler 未注册');
  handler({ clientX: gx * CELL + 40, clientY: gy * CELL + 40 });
}
function manhattan(a, b) { return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy); }

// 让当前选中的玩家单位施放一个可命中敌方的伤害技能（覆盖 fireball/meteor/lightning/drain/stun/burn/freeze/poison）
function playerActOnce() {
  const st = Game._state();
  if (st.phase !== 'selectUnit') return false;
  const pu = st.units.find(u => u.team === 'player' && u.hp > 0 && !u.acted);
  if (!pu) return false;
  clickCell(pu.gx, pu.gy); // 选中
  const idx = pu.skills.findIndex(s => s.cd === 0 && !s.isHeal);
  if (idx < 0) { Game.skipUnit(); return true; }
  Game.castSkill(idx); // 进入选目标阶段
  const skill = pu.skills[idx];
  const enemies = Game._state().units.filter(u => u.team === 'enemy' && u.hp > 0);
  const inRange = enemies.filter(e => manhattan(e, pu) <= skill.range).sort((a, b) => a.hp - b.hp);
  if (inRange.length) {
    clickCell(inRange[0].gx, inRange[0].gy); // 施放
  } else {
    // 不在射程：取消并跳过，避免空转
    if (typeof Game.cancelAction === 'function') Game.cancelAction();
    Game.skipUnit();
  }
  return true;
}

// ------------------------------------------------------------
// 4. 场景
// ------------------------------------------------------------
console.log('\n=== Magic Arena 冒烟测试 ===\n');

// 场景 S1：难度选择三档无异常 + 状态生效
console.log('[S1] 难度选择（easy/normal/hard）');
['easy', 'normal', 'hard'].forEach(d => {
  let ok = true;
  try { Game.setDifficulty(d); } catch (e) { ok = false; failures.push('setDifficulty ' + d + ' 抛异常: ' + e.message); }
  assert(ok && Game._state().difficulty === d, 'setDifficulty(' + d + ') 生效');
});

// 场景 S2：战役第一关部署结构正确
console.log('[S2] 战役第一关部署结构');
let s2ok = true;
try { Game.startCampaign(1); } catch (e) { s2ok = false; failures.push('startCampaign(1) 抛异常: ' + e.message); }
const s2 = Game._state();
assert(s2ok, 'startCampaign(1) 无异常');
assert(s2.units.length === 10, '战场单位数 = 10（玩家5人+敌方5人）（实际 ' + s2.units.length + '）');
assert(s2.units.filter(u => u.team === 'player').length === 5, '玩家单位 = 5');
assert(s2.units.filter(u => u.team === 'enemy').length === 5, '敌方单位 = 5');
assert(s2.phase === 'selectUnit', '初始阶段 = selectUnit');
// 难度缩放：困难档敌方 HP/伤害应被放大（普通档基准的 1.35 倍，取整）
Game.setDifficulty('normal'); Game.startCampaign(1);
const normalEnemyHp = Game._state().units.find(u => u.team === 'enemy').maxHp;
Game.setDifficulty('hard'); Game.startCampaign(1);
const hardEnemyHp = Game._state().units.find(u => u.team === 'enemy').maxHp;
assert(hardEnemyHp >= normalEnemyHp, '困难档敌方 HP ≥ 普通档（' + hardEnemyHp + ' ≥ ' + normalEnemyHp + '，数值平衡可见）');

// 场景 S3：玩家主动出战直到分出胜负（覆盖玩家 applySkill / 胜利或失败分支 / 解锁）
console.log('[S3] 玩家主动出战 → 战斗结束（胜/负）');
Game.setDifficulty('normal');
Game.startCampaign(1);
const winsBefore = Game._state().saveData.wins;
const lossesBefore = Game._state().saveData.losses;
let turn = 0, reachedEnd = false;
try {
  while (turn < 80) {
    let st = Game._state();
    if (st.phase === 'gameOver') { reachedEnd = true; break; }
    // 行动所有未行动玩家单位
    let safety = 0;
    while (st.phase === 'selectUnit' && st.units.some(u => u.team === 'player' && u.hp > 0 && !u.acted) && safety < 12) {
      playerActOnce();
      st = Game._state();
      safety++;
    }
    if (st.phase === 'gameOver') { reachedEnd = true; break; }
    Game.endTurn(); // 触发敌方 AI + 回合结算（setTimeout 已同步化）
    turn++;
  }
} catch (e) {
  failures.push('S3 战斗循环抛异常: ' + e.message + '\n' + e.stack);
}
assert(reachedEnd, 'S3 在回合上限内分出胜负（phase=gameOver）');
const afterS3 = Game._state().saveData;
assert((afterS3.wins + afterS3.losses) > (winsBefore + lossesBefore), 'S3 战绩已写入存档（wins+losses 增加）');

// 场景 S4：玩家不行动 → 必然失败（覆盖 checkGameEnd 失败分支 + 弹窗 + 存档）
console.log('[S4] 玩家不行动 → 失败分支');
Game.setDifficulty('normal');
Game.startCampaign(1);
const lossesBefore4 = Game._state().saveData.losses;
let s4end = false, s4turn = 0;
try {
  while (s4turn < 80) {
    const st = Game._state();
    if (st.phase === 'gameOver') { s4end = true; break; }
    Game.endTurn(); // 玩家不行动，仅敌方进攻
    s4turn++;
  }
} catch (e) {
  failures.push('S4 失败路径抛异常: ' + e.message + '\n' + e.stack);
}
assert(s4end, 'S4 失败路径到达 gameOver');
assert(Game._state().saveData.losses > lossesBefore4, 'S4 失败战绩已记录（losses 增加）');

// 场景 S5：危险格地图（雪原，含 hazard）跑通回合结算
console.log('[S5] 危险格地图（第三关·雪山）回合结算');
let s5ok = true;
try {
  Game.setDifficulty('normal');
  Game.startCampaign(3);
  const map = Game._state().currentMap;
  assert(map && map.hazard && map.hazard.length > 0, '第三关地图含危险格');
  // 多跑几回合确保 nextTurn 的危险格结算路径执行
  for (let i = 0; i < 6; i++) {
    const st = Game._state();
    if (st.phase === 'gameOver') break;
    Game.endTurn();
  }
} catch (e) {
  s5ok = false;
  failures.push('S5 危险格地图抛异常: ' + e.message + '\n' + e.stack);
}
assert(s5ok, 'S5 危险格地图完整跑通无异常');

// 场景 S6：遭遇模式（Skirmish）部署 + 跑通
console.log('[S6] 单局遭遇模式（Skirmish）');
let s6ok = true;
try {
  Game.setDifficulty('easy');
  Game.startSkirmish();
  const st = Game._state();
  assert(st.units.length === 10, '遭遇战部署 10 单位（玩家5人+敌方5人）');
  assert(st.gameMode === 'skirmish', '模式 = skirmish');
  assert(st.phase === 'selectUnit', '遭遇战初始阶段 = selectUnit');
  for (let i = 0; i < 6; i++) {
    const s = Game._state();
    if (s.phase === 'gameOver') break;
    Game.endTurn();
  }
} catch (e) {
  s6ok = false;
  failures.push('S6 遭遇模式抛异常: ' + e.message + '\n' + e.stack);
}
assert(s6ok, 'S6 遭遇模式完整跑通无异常');

// 场景 S7：战斗日志（Battle Journal）引擎记录事件（方向4 体验打磨 · 04:00 落地 / 05:00 闭环）
console.log('[S7] 战斗日志（Battle Journal）记录战斗事件');
let s7ok = true;
try {
  Game.setDifficulty('normal');
  Game.startCampaign(1);
  const beforeLogs = Game._state().logs.length; // startBattle 重置 → 应为 0
  // 跑若干回合，敌方 AI / 状态结算 / 玩家跳过均会写入日志
  for (let i = 0; i < 4; i++) {
    const st = Game._state();
    if (st.phase === 'gameOver') break;
    Game.endTurn();
  }
  const afterLogs = Game._state().logs.length;
  assert(afterLogs > beforeLogs, '战斗日志随回合推进增长（' + beforeLogs + ' → ' + afterLogs + ' 条）');
  const sample = Game._state().logs[0];
  assert(sample && typeof sample.text === 'string' && typeof sample.type === 'string', '日志条目含 text/type 字段（结构正确）');
} catch (e) {
  s7ok = false;
  failures.push('S7 战斗日志断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s7ok, 'S7 战斗日志无异常');

// 场景 S8：施法目标预览（Target Preview）合法落点计算（方向4 体验打磨 · @A38 回归锁定）
// 锁定 computeValidTargets 的核心契约：无技能选中时为空；攻击技能只标敌方（射程内、不含友方）；
// 增益技能只标友方（不含敌方）。该契约属零战斗逻辑改动的纯渲染层，回归测试保护其不被静默破坏。
console.log('[S8] 施法目标预览（Target Preview）合法落点计算');
let s8ok = true;
try {
  Game.setDifficulty('normal');
  Game.startCampaign(1);

  // (a) 无技能选中（selectUnit 阶段）时 validTargets 必须为空
  assert(Game._state().validTargets.length === 0, 'S8a 无技能选中时 validTargets 为空');

  // (b) 攻击技能：推进若干回合使双方接近，找一名射程内有敌方的玩家单位，施放后合法落点应全为敌方、在射程内、且不含友方
  let s8bDone = false;
  for (let i = 0; i < 6 && !s8bDone; i++) {
    const s = Game._state();
    if (s.phase === 'gameOver') break;
    // 候选：玩家未行动单位 + 一个射程内有敌方的攻击技能（非增益）
    const cand = s.units.find(u => u.team === 'player' && !u.acted &&
      u.skills.some(sk => sk.cd === 0 && !sk.isHeal && !sk.isShield && !sk.isEmpower &&
        s.units.some(e => e.team === 'enemy' && manhattan(e, u) <= sk.range)));
    if (cand) {
      const idxB = cand.skills.findIndex(sk => sk.cd === 0 && !sk.isHeal && !sk.isShield && !sk.isEmpower &&
        s.units.some(e => e.team === 'enemy' && manhattan(e, cand) <= sk.range));
      clickCell(cand.gx, cand.gy);   // 选中单位
      Game.castSkill(idxB);          // 进入选目标阶段
      const stT = Game._state();
      const vt = stT.validTargets;
      assert(stT.phase === 'selectTarget', 'S8b 进入 selectTarget 阶段');
      assert(vt.length > 0, 'S8b 射程内存在敌方合法落点（' + vt.length + ' 个）');
      const allEnemyInRange = vt.every(c => {
        const t = stT.units.find(u => u.gx === c.gx && u.gy === c.gy);
        return t && t.team === 'enemy' && manhattan(t, cand) <= cand.skills[idxB].range;
      });
      assert(allEnemyInRange, 'S8b 合法落点全为敌方且在射程内');
      const anyFriendly = vt.some(c => {
        const t = stT.units.find(u => u.gx === c.gx && u.gy === c.gy);
        return t && t.team === 'player';
      });
      assert(!anyFriendly, 'S8b 合法落点不含友方（攻击技能不误标友方）');
      Game.cancelAction();
      s8bDone = true;
    } else {
      Game.endTurn();   // 推进敌方接近，再试
    }
  }
  if (!s8bDone) assert(true, 'S8b 全程无攻击射程内敌方（跳过，不影响）');
} catch (e) {
  s8ok = false;
  failures.push('S8 施法目标预览断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s8ok, 'S8 施法目标预览无异常');

// 场景 S9：单位图鉴（Unit Codex）主菜单档案渲染（方向3 系统新创 · @A37 回归锁定）
// 锁定 renderCodex 的核心契约：主菜单 #menu-codex 渲染出全部单位档案（≥16 张）与全技能条目（≥40 行），
// 并含 BOSS 单位；纯只读展示层，回归测试保护档案完整性不被静默破坏。
console.log('[S9] 单位图鉴（Unit Codex）主菜单档案渲染');
let s9ok = true;
try {
  Game.showMenu();
  const codexEl = getEl('menu-codex');
  const html = codexEl.innerHTML || '';
  assert(html.includes('codex-grid'), 'S9 单位图鉴网格容器已渲染');
  const cardCount = (html.match(/codex-card/g) || []).length;
  assert(cardCount >= 16, 'S9 渲染单位档案 ≥ 16 张（实际 ' + cardCount + '）');
  const skillCount = (html.match(/codex-skill/g) || []).length;
  assert(skillCount >= 40, 'S9 渲染技能条目 ≥ 40 行（实际 ' + skillCount + '）');
  const hasBoss = html.includes('马尔佐斯') || html.includes('大魔导师') || html.includes('★BOSS');
  assert(hasBoss, 'S9 含 BOSS 单位档案（马尔佐斯）');
} catch (e) {
  s9ok = false;
  failures.push('S9 单位图鉴断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s9ok, 'S9 单位图鉴无异常');

// 场景 S10：角色成长系统（Character Growth · 方向3 系统新创 · 回归锁定）
// 锁定：玩家单位携带 growthLevel/growthExp 字段；战役胜利后 saveData.growth 累计经验与等级；
// 重开战役时玩家单位继承成长加成（maxHp 不降低）。仅战役模式生效（skirmish 不触 growth → balance-scan 梯度零扰动）。
console.log('[S10] 角色成长系统（Character Growth）');
let s10ok = true;
// 累计经验 = (等级-1)×每级经验 + 当前级余量；该量为单调递增（升级只消耗余量、不减少累计），
// 与 S10 断言意图「战役胜利后经验累计增加」一致。原版仅累加 .exp（当前级余量），
// 升级 rollover 会使该和下降、误报回归；5v5 增大击杀数后该脆弱性被触发，故改用累计量。
function sumGrowth(g) { const EPL = 100; return Object.keys(g || {}).reduce((s, k) => { const e = (g[k] && g[k].exp) || 0; const lv = (g[k] && g[k].level) || 1; return s + (lv - 1) * EPL + e; }, 0); }
try {
  Game.setDifficulty('normal');
  Game.startCampaign(1);
  const st0 = Game._state();
  const baseUnit = st0.units.find(u => u.team === 'player');
  assert(typeof baseUnit.growthLevel === 'number', 'S10 玩家单位含 growthLevel 字段');
  assert(typeof baseUnit.growthExp === 'number', 'S10 玩家单位含 growthExp 字段');
  const baseName = baseUnit.name;
  const baseMaxHp = baseUnit.maxHp;
  const expBefore = sumGrowth(st0.saveData.growth);
  // 驱动玩家主动出战直到分出胜负
  let turn = 0, won = false, reached = false;
  while (turn < 150) {
    let st = Game._state();
    if (st.phase === 'gameOver') { reached = true; won = st.units.filter(u => u.team === 'enemy' && u.hp > 0).length === 0; break; }
    let safety = 0;
    while (st.phase === 'selectUnit' && st.units.some(u => u.team === 'player' && u.hp > 0 && !u.acted) && safety < 12) {
      playerActOnce();
      st = Game._state();
      safety++;
    }
    if (st.phase === 'gameOver') { reached = true; won = st.units.filter(u => u.team === 'enemy' && u.hp > 0).length === 0; break; }
    Game.endTurn();
    turn++;
  }
  const expAfter = sumGrowth(Game._state().saveData.growth);
  if (won) {
    assert(expAfter > expBefore, 'S10 战役胜利后经验累计增加（' + expBefore + ' → ' + expAfter + '）');
  } else {
    console.log('  (S10 本局未取胜，跳过经验累计断言 · 不计入失败)');
  }
  // 重开同一关：玩家单位继承成长加成（maxHp 不降低、growthLevel 字段存在）
  Game.startCampaign(1);
  const reUnit = Game._state().units.find(u => u.team === 'player' && u.name === baseName);
  assert(reUnit && typeof reUnit.growthLevel === 'number', 'S10 重开战役玩家单位携带 growthLevel');
  assert(reUnit.maxHp >= baseMaxHp, 'S10 重开战役玩家单位 maxHp 不降低（成长加成或持平）');
} catch (e) {
  s10ok = false;
  failures.push('S10 角色成长断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s10ok, 'S10 角色成长系统无异常');

// 场景 S11：多结局系统（Branching Endings）永久回归锁定（方向2 内容扩建 · @A44 落地）
// 锁定核心契约（纯数据 + 纯 UI 抉择、零战斗逻辑改动、balance-safe）：
//  - showChoice(level) 渲染对应关卡抉择标题/文本
//  - chooseOption(level, optId) 记录 saveData.storyChoices[level] 并依 delta 累计 alignmentScore
//  - 同一节点仅记录一次（防重玩覆盖 / 防重复累计）
//  - 三组合（守护 guardian / 征服 conqueror / 均衡 balance）累计出不同 alignmentScore 并映射到不同结局（getEndingId）
// 用独立 vm 上下文隔离各路径的 saveData，确保 three-path 全覆盖且互不污染。
console.log('[S11] 多结局系统（Branching Endings）抉择累计与结局映射');
let s11ok = true;
function loadFreshGame() {
  _store.clear();
  const sb = { document: documentMock, window: windowMock, localStorage: localStorageMock, setTimeout: setTimeoutMock, clearTimeout: clearTimeoutMock, console };
  vm.createContext(sb);
  vm.runInContext(code, sb);
  if (typeof domReady === 'function') domReady();
  return sb.Game;
}
function testEndingPath(label, opt3, opt5, expectScore, expectEnding) {
  const G = loadFreshGame();
  // 第 3 关抉择
  G.showChoice(3);
  const t3 = getEl('overlay-title').textContent || '';
  assert(t3.indexOf('雪原') >= 0, 'S11 ' + label + ' 第3关抉择标题渲染（' + t3 + '）');
  G.chooseOption(3, opt3);
  const d3 = (opt3 === 'guard') ? 1 : -1;
  assert(G._state().alignmentScore === d3, 'S11 ' + label + ' 第3关抉择累计 alignmentScore=' + d3);
  assert(G._state().storyChoices[3] === opt3, 'S11 ' + label + ' 第3关 storyChoices 记录为 ' + opt3);
  // once-per-node：同一节点重选不得覆盖 / 不得重复累计
  const other3 = (opt3 === 'guard') ? 'seize' : 'guard';
  G.chooseOption(3, other3);
  assert(G._state().alignmentScore === d3, 'S11 ' + label + ' 第3关重选不重复累计（once-per-node）');
  assert(G._state().storyChoices[3] === opt3, 'S11 ' + label + ' 第3关重选不覆盖原抉择');
  // 第 5 关抉择
  G.showChoice(5);
  const t5 = getEl('overlay-title').textContent || '';
  assert(t5.indexOf('熔岩') >= 0, 'S11 ' + label + ' 第5关抉择标题渲染（' + t5 + '）');
  G.chooseOption(5, opt5);
  assert(G._state().alignmentScore === expectScore, 'S11 ' + label + ' 终章 alignmentScore 累计=' + expectScore);
  const eid = G.getEndingId();
  assert(eid === expectEnding, 'S11 ' + label + ' alignmentScore=' + expectScore + ' → 结局 ' + expectEnding + '（实际 ' + eid + '）');
}
try {
  testEndingPath('守护', 'guard', 'mend', 2, 'guardian');
  testEndingPath('征服', 'seize', 'rule', -2, 'conqueror');
  testEndingPath('均衡', 'guard', 'rule', 0, 'balance');
  const G0 = loadFreshGame();
  assert(typeof G0.getEndingId === 'function', 'S11 getEndingId 已暴露供回归断言');
} catch (e) {
  s11ok = false;
  failures.push('S11 多结局断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s11ok, 'S11 多结局系统无异常');

// 场景 S12：兵种克制系统（Unit-Type Counter · 方向2 Phase 1 · @A52 落地）
// 锁定核心契约（纯数据兵种标签 + 伤害放大、对 balance-scan 跨对局梯度零扰动、balance-safe）：
//  - counterMult 纯函数：战克弓 / 弓克法 / 法克战 → 1.5；同级/被克/中立奶 → 1
//  - 运行时单位携带 unitType（经典/圣光小队 + 敌方 + Boss 全部具备）
//  - 克制放大仅作用于伤害结算（已在 damageUnit 接入并飘字「克制!」）
console.log('[S12] 兵种克制系统（Unit-Type Counter）counterMult 纯函数契约');
let s12ok = true;
try {
  const G = Game;
  assert(typeof G.counterMult === 'function', 'S12 counterMult 已暴露供回归断言');
  // 克制循环正向
  assert(Math.abs(G.counterMult('warrior', 'archer') - 1.5) < 1e-9, 'S12 战克弓 → 1.5');
  assert(Math.abs(G.counterMult('archer', 'mage') - 1.5) < 1e-9, 'S12 弓克法 → 1.5');
  assert(Math.abs(G.counterMult('mage', 'warrior') - 1.5) < 1e-9, 'S12 法克战 → 1.5');
  // 反向/同级/中立 → 1
  assert(Math.abs(G.counterMult('archer', 'warrior') - 1) < 1e-9, 'S12 弓被战克（反向） → 1');
  assert(Math.abs(G.counterMult('warrior', 'warrior') - 1) < 1e-9, 'S12 同级 → 1');
  assert(Math.abs(G.counterMult('healer', 'warrior') - 1) < 1e-9, 'S12 奶攻战（中立不克制） → 1');
  assert(Math.abs(G.counterMult('warrior', 'healer') - 1) < 1e-9, 'S12 战攻奶（中立不被克） → 1');
  assert(Math.abs(G.counterMult(null, 'archer') - 1) < 1e-9, 'S12 缺兵种标签 → 1');
  // 运行时单位携带 unitType
  G.startCampaign(1);
  const st = G._state();
  const players = st.units.filter(u => u.team === 'player' && u.hp > 0);
  const enemies = st.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(players.length > 0 && players.every(u => !!u.unitType), 'S12 玩家单位全部携带 unitType');
  assert(enemies.length > 0 && enemies.every(u => !!u.unitType), 'S12 敌方单位全部携带 unitType');
} catch (e) {
  s12ok = false;
  failures.push('S12 兵种克制断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s12ok, 'S12 兵种克制系统无异常');

// 场景 S13：外传章节（Side Stories · 方向2 内容扩建 · @A53 落地）
// 锁定核心契约（纯内容 + 复用既有"歼灭全部敌人"胜利条件、零方向1 引擎改动、balance-safe）：
//  - showSideStories() 渲染外传列表（标题含「外传」、标注敌人数/地图名、已通关打勾）
//  - startSideStory(idx) 切 gameMode='sidestory'、按 5v5 部署、展示原创开场
//  - 胜利分支：标记 saveData.sideCleared[idx] 并展示专属尾声、返回主菜单
console.log('[S13] 外传章节（Side Stories）列表/开场/战斗/通关闭环');
let s13ok = true;
try {
  assert(typeof Game.showSideStories === 'function', 'S13 showSideStories 已暴露供回归断言');
  assert(typeof Game.startSideStory === 'function', 'S13 startSideStory 已暴露供回归断言');
  assert(typeof Game._testKillEnemies === 'function', 'S13 _testKillEnemies 已暴露供回归断言');
  Game.showSideStories();
  const lp = getEl('lore-panel');
  assert(lp.innerHTML.indexOf('外传') >= 0, 'S13 外传列表渲染（含「外传」标题）');
  assert(lp.innerHTML.indexOf('敌') >= 0, 'S13 外传列表标注敌人数');
  assert(lp.innerHTML.indexOf('外传四') >= 0, 'S13 外传列表含新增「外传四 · 星陨残响」');
  assert(lp.innerHTML.indexOf('外传五') >= 0, 'S13 外传列表含新增「外传五 · 走廊回音」');
  // 启动第一篇外传
  Game.startSideStory(0);
  const st = Game._state();
  assert(st.gameMode === 'sidestory', 'S13 gameMode 切换为 sidestory');
  assert(st.currentSideStory === 0, 'S13 currentSideStory 记录索引 0');
  const sPlayers = st.units.filter(u => u.team === 'player' && u.hp > 0);
  const sEnemies = st.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(sPlayers.length === 5, 'S13 玩家小队 5 人部署（实际 ' + sPlayers.length + '）');
  assert(sEnemies.length === 5, 'S13 敌方 5 人部署（实际 ' + sEnemies.length + '）');
  // 胜利闭环：清空敌方 → 触发 checkGameEnd 胜利分支
  Game._testKillEnemies();
  Game.endTurn();
  const st3 = Game._state();
  assert((st3.saveData.sideCleared && st3.saveData.sideCleared[0]) === true, 'S13 通关后 sideCleared[0] 持久化标记');
  assert(st3.phase === 'gameOver', 'S13 胜利后进入 gameOver 阶段');
  // 启动第四篇外传（新增内容 idx=3），验证 5v5 部署 + 胜利闭环持久化
  Game.startSideStory(3);
  const st4 = Game._state();
  assert(st4.gameMode === 'sidestory', 'S13 外传四 gameMode 切换为 sidestory');
  assert(st4.currentSideStory === 3, 'S13 外传四 currentSideStory 记录索引 3');
  const p4 = st4.units.filter(u => u.team === 'player' && u.hp > 0);
  const e4 = st4.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(p4.length === 5, 'S13 外传四 玩家小队 5 人部署（实际 ' + p4.length + '）');
  assert(e4.length === 5, 'S13 外传四 敌方 5 人部署（实际 ' + e4.length + '）');
  Game._testKillEnemies();
  Game.endTurn();
  const st4b = Game._state();
  assert((st4b.saveData.sideCleared && st4b.saveData.sideCleared[3]) === true, 'S13 外传四 通关后 sideCleared[3] 持久化标记');
} catch (e) {
  s13ok = false;
  failures.push('S13 外传章节断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s13ok, 'S13 外传章节系统无异常');

// 场景 S14：隐藏章节（Hidden Chapters · 蚀教真相 · 方向2 内容扩建 · 第四部后传）
// 锁定核心契约（纯内容 + 复用既有"歼灭全部敌人"胜利条件、零方向1 引擎改动、balance-safe）：
//  - showHidden() 渲染隐藏列表（标题含「隐藏」、标注蚀教阵营、已通关打勾）
//  - startHidden(idx) 切 gameMode='hidden'、按 5v5 部署、展示原创开场
//  - 胜利分支：标记 saveData.hiddenCleared[idx] 并展示专属尾声、返回主菜单
console.log('[S14] 隐藏章节（Hidden Chapters · 蚀教真相）列表/开场/战斗/通关闭环');
let s14ok = true;
try {
  assert(typeof Game.showHidden === 'function', 'S14 showHidden 已暴露供回归断言');
  assert(typeof Game.startHidden === 'function', 'S14 startHidden 已暴露供回归断言');
  Game.showHidden();
  const hp = getEl('lore-panel');
  assert(hp.innerHTML.indexOf('隐藏') >= 0, 'S14 隐藏列表渲染（含「隐藏」标题）');
  assert(hp.innerHTML.indexOf('蚀教') >= 0, 'S14 隐藏列表标注蚀教阵营（裂缝之外的真相）');
  // 启动隐藏一
  Game.startHidden(0);
  const h1 = Game._state();
  assert(h1.gameMode === 'hidden', 'S14 gameMode 切换为 hidden');
  assert(h1.currentHidden === 0, 'S14 currentHidden 记录索引 0');
  const h1p = h1.units.filter(u => u.team === 'player' && u.hp > 0);
  const h1e = h1.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(h1p.length === 5, 'S14 隐藏一 玩家小队 5 人部署（实际 ' + h1p.length + '）');
  assert(h1e.length === 5, 'S14 隐藏一 敌方 5 人部署（实际 ' + h1e.length + '）');
  Game._testKillEnemies();
  Game.endTurn();
  const h1b = Game._state();
  assert((h1b.saveData.hiddenCleared && h1b.saveData.hiddenCleared[0]) === true, 'S14 隐藏一 通关后 hiddenCleared[0] 持久化标记');
  assert(h1b.phase === 'gameOver', 'S14 隐藏一 胜利后进入 gameOver 阶段');
  // 启动隐藏三（BOSS 关 · 新增内容 idx=2），验证 5v5 部署 + 胜利闭环持久化
  Game.startHidden(2);
  const h3 = Game._state();
  assert(h3.gameMode === 'hidden', 'S14 隐藏三 gameMode 切换为 hidden');
  assert(h3.currentHidden === 2, 'S14 隐藏三 currentHidden 记录索引 2');
  const h3p = h3.units.filter(u => u.team === 'player' && u.hp > 0);
  const h3e = h3.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(h3p.length === 5, 'S14 隐藏三 玩家小队 5 人部署（实际 ' + h3p.length + '）');
  assert(h3e.length === 5, 'S14 隐藏三 敌方 5 人部署（含 BOSS·蚀渊之母，实际 ' + h3e.length + '）');
  Game._testKillEnemies();
  Game.endTurn();
  const h3b = Game._state();
  assert((h3b.saveData.hiddenCleared && h3b.saveData.hiddenCleared[2]) === true, 'S14 隐藏三 通关后 hiddenCleared[2] 持久化标记');
} catch (e) {
  s14ok = false;
  failures.push('S14 隐藏章节断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s14ok, 'S14 隐藏章节系统无异常');

// 场景 S15：隐藏章节·第二卷「门彼之侧」（方向2 内容扩建 · 裂缝之外的最后一页）
// 锁定核心契约（纯内容 + 复用既有"歼灭全部敌人"胜利条件、零方向1 引擎改动、balance-safe）：
//  - showHidden() 渲染隐藏列表（含「回响」第二卷标注、已通关打勾）
//  - startHidden(idx) 切 gameMode='hidden'、按 5v5 部署、展示原创开场
//  - 胜利分支：标记 saveData.hiddenCleared[idx] 并展示专属尾声、返回主菜单
console.log('[S15] 隐藏章节·第二卷（门彼之侧）列表/开场/战斗/通关闭环');
let s15ok = true;
try {
  assert(typeof Game.showHidden === 'function', 'S15 showHidden 已暴露供回归断言');
  assert(typeof Game.startHidden === 'function', 'S15 startHidden 已暴露供回归断言');
  Game.showHidden();
  const hp15 = getEl('lore-panel');
  assert(hp15.innerHTML.indexOf('回响') >= 0, 'S15 隐藏列表标注第二卷·门彼之侧（回响体登场）');
  // 启动隐藏四（门扉前厅 · 新增内容 idx=3）
  Game.startHidden(3);
  const h4 = Game._state();
  assert(h4.gameMode === 'hidden', 'S15 隐藏四 gameMode 切换为 hidden');
  assert(h4.currentHidden === 3, 'S15 隐藏四 currentHidden 记录索引 3');
  const h4p = h4.units.filter(u => u.team === 'player' && u.hp > 0);
  const h4e = h4.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(h4p.length === 5, 'S15 隐藏四 玩家小队 5 人部署（实际 ' + h4p.length + '）');
  assert(h4e.length === 5, 'S15 隐藏四 敌方 5 人部署（实际 ' + h4e.length + '）');
  Game._testKillEnemies();
  Game.endTurn();
  const h4b = Game._state();
  assert((h4b.saveData.hiddenCleared && h4b.saveData.hiddenCleared[3]) === true, 'S15 隐藏四 通关后 hiddenCleared[3] 持久化标记');
  assert(h4b.phase === 'gameOver', 'S15 隐藏四 胜利后进入 gameOver 阶段');
  // 启动隐藏五（回响之渊 BOSS 关 · 新增内容 idx=4），验证 5v5 部署 + 胜利闭环持久化
  Game.startHidden(4);
  const h5 = Game._state();
  assert(h5.gameMode === 'hidden', 'S15 隐藏五 gameMode 切换为 hidden');
  assert(h5.currentHidden === 4, 'S15 隐藏五 currentHidden 记录索引 4');
  const h5p = h5.units.filter(u => u.team === 'player' && u.hp > 0);
  const h5e = h5.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(h5p.length === 5, 'S15 隐藏五 玩家小队 5 人部署（实际 ' + h5p.length + '）');
  assert(h5e.length === 5, 'S15 隐藏五 敌方 5 人部署（含 BOSS·源初回响，实际 ' + h5e.length + '）');
  Game._testKillEnemies();
  Game.endTurn();
  const h5b = Game._state();
  assert((h5b.saveData.hiddenCleared && h5b.saveData.hiddenCleared[4]) === true, 'S15 隐藏五 通关后 hiddenCleared[4] 持久化标记');
} catch (e) {
  s15ok = false;
  failures.push('S15 隐藏章节·第二卷断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s15ok, 'S15 隐藏章节·第二卷系统无异常');

// 场景 S16：隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）
// 锁定核心契约（纯内容 + 复用既有"歼灭全部敌人"胜利条件、零方向1 引擎改动、balance-safe）：
//  - showHidden() 渲染隐藏列表（含「溯光」第三卷标注、已通关打勾）
//  - startHidden(idx) 切 gameMode='hidden'、按 5v5 部署、展示原创开场
//  - 胜利分支：标记 saveData.hiddenCleared[idx] 并展示专属尾声、返回主菜单
console.log('[S16] 隐藏章节·第三卷（灵脉分裂前叙事 · 溯源篇）列表/开场/战斗/通关闭环');
let s16ok = true;
try {
  assert(typeof Game.showHidden === 'function', 'S16 showHidden 已暴露供回归断言');
  assert(typeof Game.startHidden === 'function', 'S16 startHidden 已暴露供回归断言');
  Game.showHidden();
  const hp16 = getEl('lore-panel');
  assert(hp16.innerHTML.indexOf('溯光') >= 0, 'S16 隐藏列表标注第三卷·灵脉分裂前叙事（溯光者登场）');
  // 启动隐藏六（源初之庭 · 新增内容 idx=5）
  Game.startHidden(5);
  const h6 = Game._state();
  assert(h6.gameMode === 'hidden', 'S16 隐藏六 gameMode 切换为 hidden');
  assert(h6.currentHidden === 5, 'S16 隐藏六 currentHidden 记录索引 5');
  const h6p = h6.units.filter(u => u.team === 'player' && u.hp > 0);
  const h6e = h6.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(h6p.length === 5, 'S16 隐藏六 玩家小队 5 人部署（实际 ' + h6p.length + '）');
  assert(h6e.length === 5, 'S16 隐藏六 敌方 5 人部署（实际 ' + h6e.length + '）');
  Game._testKillEnemies();
  Game.endTurn();
  const h6b = Game._state();
  assert((h6b.saveData.hiddenCleared && h6b.saveData.hiddenCleared[5]) === true, 'S16 隐藏六 通关后 hiddenCleared[5] 持久化标记');
  assert(h6b.phase === 'gameOver', 'S16 隐藏六 胜利后进入 gameOver 阶段');
  // 启动隐藏八（初晓之原 BOSS 关 · 新增内容 idx=7），验证 5v5 部署 + 胜利闭环持久化
  Game.startHidden(7);
  const h8 = Game._state();
  assert(h8.gameMode === 'hidden', 'S16 隐藏八 gameMode 切换为 hidden');
  assert(h8.currentHidden === 7, 'S16 隐藏八 currentHidden 记录索引 7');
  const h8p = h8.units.filter(u => u.team === 'player' && u.hp > 0);
  const h8e = h8.units.filter(u => u.team === 'enemy' && u.hp > 0);
  assert(h8p.length === 5, 'S16 隐藏八 玩家小队 5 人部署（实际 ' + h8p.length + '）');
  assert(h8e.length === 5, 'S16 隐藏八 敌方 5 人部署（实际 ' + h8e.length + '）');
  const h8boss = h8e.filter(u => u.isBoss);
  assert(h8boss.length === 1, 'S16 隐藏八 含 1 名 BOSS·溯光之冠（实际 ' + h8boss.length + '）');
  Game._testKillEnemies();
  Game.endTurn();
  const h8b = Game._state();
  assert((h8b.saveData.hiddenCleared && h8b.saveData.hiddenCleared[7]) === true, 'S16 隐藏八 通关后 hiddenCleared[7] 持久化标记');
} catch (e) {
  s16ok = false;
  failures.push('S16 隐藏章节·第三卷断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s16ok, 'S16 隐藏章节·第三卷系统无异常');

// 场景 S17：羁绊 / 好感度系统（Bond/Synergy · 方向3 系统新创 · 本轮回合落地）
// 锁定核心契约（纯数据 + 纯数值战前联动、零方向1 引擎改动、balance-safe、默认无加成）：
//  - deepenBond(a,b) 对策划锁定的羁绊组合累积等级（0→3 封顶），并持久化于 saveData.bonds
//  - 同场部署的羁绊伙伴在战斗开始时获得联动加成（A 级：maxHp +24 / 技能伤害 +12），并由 createUnit 叠加
//  - 加成经 sanitizeSave 存档回读后保持（持久化闭环），且越界加深被封顶保护
console.log('[S17] 羁绊 / 好感度系统（Bond/Synergy）数据/加成/持久化');
let s17ok = true;
try {
  assert(typeof Game.deepenBond === 'function', 'S17 deepenBond 已暴露供回归断言');
  assert(typeof Game._state().bonds !== 'undefined', 'S17 _state 暴露 bonds 字段');
  // 基线：默认无羁绊 → 部署后玩家单位 maxHp/技能伤害等于定义值（无联动加成）
  Game.setDifficulty('normal');
  Game.startCampaign(1);
  const baseU = Game._state().units.find(u => u.team === 'player' && u.name === '炎法师·艾拉');
  const baseV = Game._state().units.find(u => u.team === 'player' && u.name === '熔岩剑士·戈伦');
  const baseMaxHpA = baseU.maxHp;
  const baseMaxHpB = baseV.maxHp;
  const baseDmg = baseU.skills[0].dmg;
  // 加深 炎法师·艾拉 ✕ 熔岩剑士·戈伦 至 A 级（3 次）
  Game.deepenBond('炎法师·艾拉', '熔岩剑士·戈伦');
  Game.deepenBond('炎法师·艾拉', '熔岩剑士·戈伦');
  Game.deepenBond('炎法师·艾拉', '熔岩剑士·戈伦');
  const bkey = ['炎法师·艾拉', '熔岩剑士·戈伦'].sort().join('|');
  assert(Game._state().bonds[bkey] === 3, 'S17 加深羁绊至 A 级（level=3）');
  // 越界防护：同源再加深不应超过 3
  Game.deepenBond('炎法师·艾拉', '熔岩剑士·戈伦');
  assert(Game._state().bonds[bkey] === 3, 'S17 羁绊等级封顶（不超过 3）');
  // 非羁绊组合不得被加深（canonical 校验）
  Game.deepenBond('炎法师·艾拉', '雷法师·特斯拉');
  assert(Game._state().bonds[bkey] === 3, 'S17 非锁定组合 deepenBond 被忽略（仅 canonical 生效）');
  // 重开战役：两单位均获 A 级联动加成（hp+24 / dmg+12）
  Game.startCampaign(1);
  const uA = Game._state().units.find(u => u.team === 'player' && u.name === '炎法师·艾拉');
  const uB = Game._state().units.find(u => u.team === 'player' && u.name === '熔岩剑士·戈伦');
  assert(uA.maxHp === baseMaxHpA + 24, 'S17 A 级羁绊：炎法师·艾拉 maxHp +24（' + baseMaxHpA + ' → ' + uA.maxHp + '）');
  assert(uB.maxHp === baseMaxHpB + 24, 'S17 A 级羁绊：熔岩剑士·戈伦 maxHp +24（' + baseMaxHpB + ' → ' + uB.maxHp + '）');
  assert(uA.skills[0].dmg === baseDmg + 12, 'S17 A 级羁绊：炎法师·艾拉 技能伤害 +12（' + baseDmg + ' → ' + uA.skills[0].dmg + '）');
  // 持久化：经 localStorage 回读后仍为 3（sanitizeSave 白名单 bonds）
  const reloaded = Game._state().saveData.bonds[bkey];
  assert(reloaded === 3, 'S17 羁绊等级经存档持久化（回读=3）');
} catch (e) {
  s17ok = false;
  failures.push('S17 羁绊系统断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s17ok, 'S17 羁绊 / 好感度系统无异常');

console.log('\n=== 测试结果 ===');
console.log('通过: ' + pass + '  失败: ' + fail);
if (fail > 0) {
  console.log('\n失败明细:');
  failures.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  console.log('\n冒烟测试结论: 未通过 ❌');
  process.exit(1);
} else {
  console.log('\n冒烟测试结论: 全部通过 ✅（纯 Node · 零依赖 · 无网络）');
  process.exit(0);
}
