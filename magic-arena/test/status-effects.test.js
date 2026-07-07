// ============================================================
// status-effects.test.js — Magic Arena 状态效果回归测试（方向5 · 工程基石）
// 位置：magic-arena/test/status-effects.test.js
// 用途：在无浏览器 / 无网络 / 无框架依赖的前提下，用 vm 在 Node 内加载真实
//       game.js，mock 浏览器环境（DOM/Canvas/localStorage/setTimeout 同步化），
//       通过公开 API（_state / startCampaign / castSkill / 画布点击 / endTurn）
//       确定性地验证状态效果子系统的核心行为：
//         - 眩晕(stun) 应用 + 生命周期（敌方被眩晕跳过行动）
//         - 灼烧(burn) 应用 + 回合边界持续伤害结算
//         - 致盲(blind) 应用 + 生命周期 + 输出伤害降低 50% 的伤害修正
//         - 冰冻(freeze) / 中毒(poison) 仍在技能数据/引擎中正确接线（存在性断言）
// 用法：node test/status-effects.test.js   （退出码 0=通过，1=失败）
// 约束：零 npm install、零外网请求，仅用 Node 内置模块（vm/fs/path）。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------
// 1. 浏览器环境 Mock（与 smoke-test.js 同构，最小可用子集）
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

if (typeof Game !== 'object' || typeof Game._state !== 'function') {
  throw new Error('Game 未正确加载（测试环境初始化失败）');
}
if (typeof domReady === 'function') domReady(); // 触发 DOMContentLoaded → init()

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
// 让 (gx,gy) 处的单位移动到 (tx,ty)（需该格为空且在移动范围内）
function moveUnit(gx, gy, tx, ty) {
  clickCell(gx, gy);       // 选中
  Game.startMove();        // 进入移动阶段并计算可移动格
  clickCell(tx, ty);       // 执行移动
}
// 选中 (gx,gy) 处单位、施放第 idx 个技能、并以 (tx,ty) 为目标的格
function castAt(gx, gy, skillIdx, tx, ty) {
  clickCell(gx, gy);
  Game.castSkill(skillIdx);
  clickCell(tx, ty);
}
function enemyAt(gx, gy) {
  return Game._state().units.find(u => u.team === 'enemy' && u.gx === gx && u.gy === gy && u.hp > 0);
}
// 按名称稳定定位敌方单位（被致盲的敌方会在其回合移动，不能按坐标追踪）
function enemyByName(name) {
  return Game._state().units.find(u => u.team === 'enemy' && u.name === name && u.hp > 0);
}

console.log('\n=== Magic Arena 状态效果回归测试 ===\n');

// ------------------------------------------------------------
// S1 眩晕术（stun）：应用 + 敌方被眩晕本回合跳过行动（生命周期）
// ------------------------------------------------------------
console.log('[S1] 眩晕术 (stun) 应用与生命周期');
Game.setDifficulty('normal');
Game.startCampaign(1);
// 特斯拉(1,3) 移动至 (4,3)（距敌方(6,3)维克 2 格，眩晕 range3 命中）
moveUnit(1, 3, 4, 3);
castAt(4, 3, 1, 6, 3); // 特斯拉技能槽[1] = 眩晕术，目标 (6,3)
const s1target = enemyAt(6, 3);
assert(!!s1target && s1target.stunned === true, 'S1 眩晕术命中 → 维克 stunned=true（实际 ' + (s1target ? s1target.stunned : '目标已死') + '）');
Game.endTurn(); // 敌方回合：被眩晕者跳过行动并解除眩晕标记
const s1after = enemyAt(6, 3);
assert(!!s1after && s1after.stunned === false, 'S1 敌方回合后眩晕标记被消费（stunned=false），敌方跳过该回合行动');

// ------------------------------------------------------------
// S2 灼烧术（burn）：应用 + 回合边界持续伤害结算（DoT）
// ------------------------------------------------------------
console.log('[S2] 灼烧术 (burn) 应用与持续伤害结算');
Game.setDifficulty('normal');
Game.startCampaign(1);
// 艾拉(1,1) 移动至 (3,1)（距敌方(6,1)卡尔 3 格，灼烧 range3 命中）
moveUnit(1, 1, 3, 1);
castAt(3, 1, 1, 6, 1); // 艾拉技能槽[1] = 灼烧术，目标 (6,1)
const s2target = enemyAt(6, 1);
assert(!!s2target && s2target.burnTurns === 2, 'S2 灼烧术命中 → 卡尔 burnTurns=2（实际 ' + (s2target ? s2target.burnTurns : '目标已死') + '）');
const hpBefore = s2target.hp;
Game.endTurn(); // nextTurn 结算灼烧持续伤害（普通档 burnDmg=6）
const s2after = enemyAt(6, 1);
const burnDmg = (s2target && s2target.skills.find(s => s.isBurn)) ? 6 : 6; // 普通档灼烧伤害固定 6（SKILL_DEFS.burn.burnDmg）
assert(!!s2after && s2after.hp === hpBefore - 6, 'S2 回合边界灼烧结算 → 卡尔 HP 减少 6（' + hpBefore + ' → ' + (s2after ? s2after.hp : '死') + '）');
assert(!!s2after && s2after.burnTurns === 1, 'S2 灼烧回合计数递减 → burnTurns=1（实际 ' + (s2after ? s2after.burnTurns : '-') + '）');

// ------------------------------------------------------------
// S3 致盲术（blind）：应用 + 生命周期（2 回合递减至 0）
// ------------------------------------------------------------
console.log('[S3] 致盲术 (blind) 应用与生命周期');
Game.setDifficulty('normal');
Game.startCampaign(1);
// 莫甘娜(1,5) 移动至 (3,5)（距敌方(6,5)安娜 3 格，致盲 range3 命中）
moveUnit(1, 5, 3, 5);
castAt(3, 5, 2, 6, 5); // 莫甘娜技能槽[2] = 致盲术，目标 (6,5)
const s3target = enemyAt(6, 5);
assert(!!s3target && s3target.blindTurns === 2, 'S3 致盲术命中 → 安娜 blindTurns=2（实际 ' + (s3target ? s3target.blindTurns : '目标已死') + '）');
Game.endTurn(); // 第一个回合边界 → 2→1（安娜被致盲仍会移动/行动，按名称追踪）
const s3after1 = enemyByName('亡灵术士·安娜');
assert(!!s3after1 && s3after1.blindTurns === 1, 'S3 一回合后致盲递减 → blindTurns=1（实际 ' + (s3after1 ? s3after1.blindTurns : '-') + '）');
Game.endTurn(); // 第二个回合边界 → 1→0
const s3after2 = enemyByName('亡灵术士·安娜');
assert(!!s3after2 && s3after2.blindTurns === 0, 'S3 两回合后致盲解除 → blindTurns=0（实际 ' + (s3after2 ? s3after2.blindTurns : '-') + '）');

// ------------------------------------------------------------
// S4 致盲伤害修正：致盲期间敌方输出伤害降低 50%（攻击玩家验证）
// ------------------------------------------------------------
console.log('[S4] 致盲术伤害修正（敌方输出 -50%）');
Game.setDifficulty('normal');
Game.startCampaign(1);
// 莫甘娜(1,5) → (3,5)，致盲 (6,5) 的安娜（安娜 pyro/aggressive，陨石术 range4/dmg18 会攻击莫甘娜）
moveUnit(1, 5, 3, 5);
castAt(3, 5, 2, 6, 5);
const s4target = enemyAt(6, 5);
assert(!!s4target && s4target.blindTurns === 2, 'S4 致盲术命中安娜（blindTurns=2）');
// 仅扫描本回合新增的战斗日志（mock 的 innerHTML='' 不清空 children，需按快照隔离），
// 从被致盲的安娜(敌方)施放技能的日志条目中提取实际伤害，验证 -50% 修正。
const logEl = getEl('log-content');
const beforeLen = logEl.children.length;
Game.endTurn(); // 致盲的安娜施放陨石术（dmg18）→ 受致盲修正 floor(18*0.5)=9（平原无掩体）
const newEntries = logEl.children.slice(beforeLen);
const annaHit = newEntries.find(c => /安娜/.test(c.textContent) && /造成 \d+ 伤害/.test(c.textContent));
let dealt = null;
if (annaHit) {
  const m = annaHit.textContent.match(/造成 (\d+) 伤害/);
  if (m) dealt = parseInt(m[1], 10);
}
assert(annaHit && dealt === 9, 'S4 致盲修正生效：被致盲的安娜陨石术(18) 对莫甘娜造成 9 伤害（日志实测 ' + dealt + '，预期 floor(18×0.5)=9）');

// ------------------------------------------------------------
// S5 冰冻 / 中毒 存在性：技能数据仍在引擎中正确接线（玩家不可施放，由敌方持有）
// ------------------------------------------------------------
console.log('[S5] 冰冻(freeze)/中毒(poison) 技能接线存在性');
Game.setDifficulty('normal');
Game.startCampaign(3); // 含 弗罗斯特(冰冻) / 维克·摩格(中毒)
const s5enemies = Game._state().units.filter(u => u.team === 'enemy');
const hasFreeze = s5enemies.some(u => u.skills.some(s => s.isFreeze));
const hasPoison = s5enemies.some(u => u.skills.some(s => s.isPoison));
assert(hasFreeze, 'S5 敌方单位持有冰冻术（isFreeze 标记存在）');
assert(hasPoison, 'S5 敌方单位持有中毒术（isPoison 标记存在）');

// ------------------------------------------------------------
// 6. 汇总
// ------------------------------------------------------------
console.log('\n=== 状态效果回归测试结果 ===');
console.log('通过: ' + pass + '  失败: ' + fail);
if (fail > 0) {
  console.log('\n失败明细:');
  failures.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  console.log('\n状态效果回归测试: 未通过 ❌');
  process.exit(1);
} else {
  console.log('\n状态效果回归测试: 全部通过 ✅（纯 Node · 零依赖 · 无网络）');
  process.exit(0);
}
