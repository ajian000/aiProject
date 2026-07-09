// ============================================================
// subsystems.test.js — Magic Arena 子系统回归测试（方向5 · 工程基石）
// 位置：magic-arena/test/subsystems.test.js
// 用途：在无浏览器 / 无网络 / 无框架依赖的前提下，用 vm 在 Node 内加载真实
//       game.js，mock 浏览器环境（DOM/Canvas/localStorage/setTimeout 同步化），
//       通过公开 API 确定性地验证三个此前缺乏专属回归覆盖的方向3 子系统契约：
//         - 战力评估 / 比分预测（@A22 evaluateSideScore + predictOutcome）
//         - 世界地图 / 章节选择界面（@A42 showWorldMap）
//         - 难度选择 + 敌方 HP 缩放（@A17 setDifficulty + createUnit 缩放）
// 这些子系统均零侵入战斗逻辑（不参与伤害/状态/胜负结算），本测试仅消费其公开
// 纯函数 / 只读 UI 渲染输出，不改变任何游戏行为；为未来 §2.7 代码模块化（模块拆分）
// 提供确定性回归护栏，避免拆分静默破坏既有子系统契约。
// 用法：node test/subsystems.test.js   （退出码 0=通过，1=失败）
// 约束：零 npm install、零外网请求，仅用 Node 内置模块（vm/fs/path）。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------
// 1. 浏览器环境 Mock（与 status-effects.test.js / smoke-test.js 同构，最小可用子集）
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
function enemyMaxHpSum() {
  return Game._state().units.filter(u => u.team === 'enemy').reduce((s, u) => s + u.maxHp, 0);
}

console.log('\n=== Magic Arena 子系统回归测试 ===\n');

// ------------------------------------------------------------
// S1 战力评估 / 比分预测（@A22 · 方向3 系统新创）
//    契约：evaluateSideScore 返回有限数；predictOutcome 胜率在 [0,100]；
//          战力优势单调 → 胜率单调（玩家更强→胜率不降、玩家更弱→胜率不升）。
// ------------------------------------------------------------
console.log('[S1] 战力评估 / 比分预测 (evaluateSideScore + predictOutcome)');
Game.setDifficulty('normal');
Game.startCampaign(1);
const st = Game._state();
const players = st.units.filter(u => u.team === 'player');
const enemies = st.units.filter(u => u.team === 'enemy');
assert(players.length === 5, 'S1 战役 L1 部署 5 名玩家单位（实测 ' + players.length + '）');
assert(enemies.length >= 1, 'S1 战役 L1 部署 ≥1 名敌方单位（实测 ' + enemies.length + '）');

const base = Game.predictOutcome(players, enemies);
assert(typeof base.playerScore === 'number' && isFinite(base.playerScore), 'S1 predictOutcome.playerScore 为有限数（实测 ' + base.playerScore + '）');
assert(typeof base.enemyScore === 'number' && isFinite(base.enemyScore), 'S1 predictOutcome.enemyScore 为有限数（实测 ' + base.enemyScore + '）');
assert(base.playerWinProb >= 0 && base.playerWinProb <= 100, 'S1 预估胜率在 [0,100] 区间（实测 ' + base.playerWinProb + '）');

// 单调性：玩家方增强（多一名单位）→ 胜率不降；削弱（少一名单位）→ 胜率不升。
const stronger = players.concat([players[0]]);
const weaker = players.slice(1);
const rStrong = Game.predictOutcome(stronger, enemies);
const rWeak = Game.predictOutcome(weaker, enemies);
assert(rStrong.playerWinProb >= base.playerWinProb, 'S1 玩家增强 → 胜率不降（' + rStrong.playerWinProb + ' ≥ ' + base.playerWinProb + '）');
assert(rWeak.playerWinProb <= base.playerWinProb, 'S1 玩家削弱 → 胜率不升（' + rWeak.playerWinProb + ' ≤ ' + base.playerWinProb + '）');
assert(rStrong.playerWinProb > rWeak.playerWinProb, 'S1 战力评估单调：强方胜率 > 弱方胜率（' + rStrong.playerWinProb + ' > ' + rWeak.playerWinProb + '）');

// ------------------------------------------------------------
// S2 世界地图 / 章节选择界面（@A42 · 方向3 系统新创 + @A48 Phase 0 扩至6区域/12关 + @A50 星渊走廊扩至7区域/15关 + @A57 第三部余烬回响扩至8区域/18关）
//    契约：showWorldMap 渲染 8 区域 + 18 章节节点；默认解锁进度 1/18 → 17 章锁定。
// ------------------------------------------------------------
console.log('[S2] 世界地图 / 章节选择界面 (showWorldMap)');
const wm = getEl('world-map');
Game.showWorldMap();
const html = wm.innerHTML;
assert(html.includes('世界地图'), 'S2 世界地图面板标题渲染（含「世界地图」）');
assert((html.match(/wm-node/g) || []).length === 18, 'S2 渲染 18 个章节节点（wm-node × 18，实测 ' + (html.match(/wm-node/g) || []).length + '）');
assert((html.match(/wm-region-name/g) || []).length === 8, 'S2 渲染 8 个区域（wm-region-name × 8，实测 ' + (html.match(/wm-region-name/g) || []).length + '）');
assert((html.match(/ locked/g) || []).length === 17, 'S2 默认解锁进度 1/18 → 17 章锁定（实测 ' + (html.match(/ locked/g) || []).length + '）');
assert(html.includes('1/18'), 'S2 进度标识显示「1/18」');

// ------------------------------------------------------------
// S3 难度选择 + 敌方 HP 缩放（@A17 · 阶段三数值平衡子系统）
//    契约：setDifficulty 切换生效；createUnit 部署时仅缩放敌方 HP；
//          困难档敌方总 HP 严格高于简单档（HP×1.25 vs HP×0.60）。
// ------------------------------------------------------------
console.log('[S3] 难度选择 / 敌方 HP 缩放 (setDifficulty)');
Game.setDifficulty('easy');
Game.startCampaign(1);
const easyHp = enemyMaxHpSum();
Game.setDifficulty('hard');
Game.startCampaign(1);
const hardHp = enemyMaxHpSum();
assert(Game._state().difficulty === 'hard', 'S3 setDifficulty 生效：difficulty==="hard"');
assert(hardHp > easyHp, 'S3 困难档敌方总 HP 高于简单档（' + hardHp + ' > ' + easyHp + '），缩放契约成立');

// ------------------------------------------------------------
// S4 第三部「余烬回响」阵营战役部署（方向2 内容扩建 Phase 2 · @A57 落地）
//    契约（纯数据扩建、零方向1 引擎改动、balance-safe）：
//      - startCampaign(16) 切至第三部首关「余烬祭坛」、按 5v5 部署、含审判之焰新阵营敌方
//      - startCampaign(18) 终局 BOSS 关「灵脉枢机」、敌方含审判之主·奥古斯（BOSS）
// ------------------------------------------------------------
console.log('[S4] 第三部「余烬回响」阵营战役部署 (startCampaign 16/18)');
let s4ok = true;
try {
  Game.setDifficulty('normal');
  Game.startCampaign(16);
  const st16 = Game._state();
  assert(st16.units.length === 10, 'S4 第十六关部署 10 单位（玩家5人+敌方5人）（实测 ' + st16.units.length + '）');
  assert(st16.units.filter(u => u.team === 'player').length === 5, 'S4 第十六关 玩家单位 = 5');
  assert(st16.units.filter(u => u.team === 'enemy').length === 5, 'S4 第十六关 敌方单位 = 5');
  const emberEnemies = st16.units.filter(u => u.team === 'enemy');
  assert(emberEnemies.some(u => u.name.indexOf('审判使') >= 0 || u.name.indexOf('燃光祭司') >= 0 || u.name.indexOf('裁决射手') >= 0), 'S4 第十六关含审判之焰新阵营敌方单位');

  Game.startCampaign(18);
  const st18 = Game._state();
  assert(st18.units.length === 10, 'S4 第十八关部署 10 单位（玩家5人+敌方5人）（实测 ' + st18.units.length + '）');
  assert(st18.units.filter(u => u.team === 'enemy').length === 5, 'S4 第十八关 敌方单位 = 5');
  assert(st18.units.some(u => u.team === 'enemy' && u.name.indexOf('审判之主') >= 0), 'S4 第十八关终局含 BOSS「审判之主·奥古斯」');
} catch (e) {
  s4ok = false;
  failures.push('S4 第三部部署断言抛异常: ' + e.message + '\n' + e.stack);
}
assert(s4ok, 'S4 第三部「余烬回响」阵营战役部署无异常');

// ------------------------------------------------------------
// 4. 汇总
// ------------------------------------------------------------
console.log('\n=== 子系统回归测试结果 ===');
console.log('通过: ' + pass + '  失败: ' + fail);
if (fail > 0) {
  console.log('\n失败明细:');
  failures.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  console.log('\n子系统回归测试: 未通过 ❌');
  process.exit(1);
} else {
  console.log('\n子系统回归测试: 全部通过 ✅（纯 Node · 零依赖 · 无网络）');
  process.exit(0);
}
