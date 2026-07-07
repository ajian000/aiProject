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
assert(s2.units.length === 6, '战场单位数 = 6（实际 ' + s2.units.length + '）');
assert(s2.units.filter(u => u.team === 'player').length === 3, '玩家单位 = 3');
assert(s2.units.filter(u => u.team === 'enemy').length === 3, '敌方单位 = 3');
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
  assert(st.units.length === 6, '遭遇战部署 6 单位');
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

// ------------------------------------------------------------
// 5. 汇总
// ------------------------------------------------------------
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
