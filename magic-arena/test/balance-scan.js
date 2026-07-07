// ============================================================
// balance-scan.js — Magic Arena 数值平衡自检（Stage 3 · 数值平衡）
// 位置：magic-arena/test/balance-scan.js
// 用途：在无浏览器 / 无网络 / 零 npm 依赖下，用 vm 加载真实 game.js，
//       驱动一个"称职的玩家代理"（移动+攻击+治疗）打完完整对局，
//       统计三档难度（简单/普通/困难）下玩家胜率，验证难度梯度是否合理
//       （应为 简单 ≥ 普通 ≥ 困难，且普通档战役可通关），作为数值平衡证据。
// 用法：node test/balance-scan.js   （退出码 0=梯度健康，1=发现失衡需调参）
// 约束：仅用 Node 内置模块（vm/fs/path）；setTimeout 同步化使对局确定性可复现。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------
// 1. 浏览器环境 Mock（与 smoke-test.js 同款最小子集）
// ------------------------------------------------------------
class El {
  constructor(id) {
    this.id = id; this._text = ''; this._html = ''; this.className = '';
    this.disabled = false; this.onclick = null; this.style = {};
    this.children = []; this.width = 640; this.height = 640;
    this.scrollTop = 0; this.scrollHeight = 0;
    this._clickHandler = null; this._ctx = null;
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
  return new Proxy({}, { get(t, p) { return (p in store) ? store[p] : () => {}; }, set(t, p, v) { store[p] = v; return true; } });
}
const elements = new Map();
function getEl(id) { if (!elements.has(id)) elements.set(id, new El(id)); return elements.get(id); }
const documentMock = { getElementById: (id) => getEl(id), createElement: () => new El('created'), addEventListener: () => {} };
let domReady = null;
const windowMock = { addEventListener: (t, fn) => { if (t === 'DOMContentLoaded') domReady = fn; } };
const _store = new Map();
const localStorageMock = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};
const setTimeoutMock = (fn) => { fn(); return 0; }; // 同步化 → 对局确定性
const clearTimeoutMock = () => {};

// ------------------------------------------------------------
// 2. 可复现随机数（mulberry32），注入 sandbox.Math 以驱动 skirmish 的随机选图/选敌
// ------------------------------------------------------------
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------
// 3. 加载真实 game.js
// ------------------------------------------------------------
const CELL = 80;
const gamePath = path.join(__dirname, '..', 'game.js');
let code = fs.readFileSync(gamePath, 'utf8');
code += '\n;globalThis.Game = Game;';

const sandbox = {};
let currentRng = Math.random;
const sandboxMath = new Proxy(Math, { get(t, p) { return (p === 'random') ? currentRng : t[p]; } });
sandbox.Math = sandboxMath;
sandbox.document = documentMock;
sandbox.window = windowMock;
sandbox.localStorage = localStorageMock;
sandbox.setTimeout = setTimeoutMock;
sandbox.clearTimeout = clearTimeoutMock;
sandbox.console = console;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Game = sandbox.Game;
if (typeof Game !== 'object' || typeof Game.startCampaign !== 'function') {
  throw new Error('Game 未正确加载（平衡自检环境初始化失败）');
}
if (typeof domReady === 'function') domReady();

// ------------------------------------------------------------
// 4. 玩家代理（称职贪婪策略：能打就打，不能打就贴近，残血就治疗）
// ------------------------------------------------------------
function clickCell(gx, gy) {
  const handler = getEl('arena')._clickHandler;
  if (!handler) throw new Error('canvas click handler 未注册');
  handler({ clientX: gx * CELL + 40, clientY: gy * CELL + 40 });
}
const manhattan = (a, b) => Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);

function computeMoveCells(pu, st) {
  const cells = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    if (manhattan({ gx: x, gy: y }, pu) <= pu.moveRange) {
      const occupied = st.units.some(u => u.hp > 0 && u.gx === x && u.gy === y);
      if (!occupied) cells.push({ gx: x, gy: y });
    }
  }
  return cells;
}
// 危险格（地图含 hazard）：从 game.js 状态推断（currentMap.hazard 已暴露）
function hazardSet(st) {
  const set = new Set();
  if (st.currentMap && st.currentMap.hazard) st.currentMap.hazard.forEach(h => set.add(h.gx + ',' + h.gy));
  return set;
}
function coverSet(st) {
  const set = new Set();
  if (st.currentMap && st.currentMap.cover) st.currentMap.cover.forEach(c => set.add(c.gx + ',' + c.gy));
  return set;
}
// 选移动格：贴近最近敌人，但避开危险格、优先掩体
function pickMoveCell(pu, st, nearest) {
  const cells = computeMoveCells(pu, st);
  const hz = hazardSet(st), cv = coverSet(st);
  const safe = cells.filter(c => !hz.has(c.gx + ',' + c.gy));
  const pool = safe.length ? safe : cells;
  // 优先能进入射程（贴近到 range 内）的格；再按到敌人距离排序
  const inRange = pool.filter(c => manhattan(c, nearest) <= pu.moveRange + 1)
    .sort((a, b) => manhattan(a, nearest) - manhattan(b, nearest));
  const sorted = pool.sort((a, b) => manhattan(a, nearest) - manhattan(b, nearest));
  const cand = inRange.length ? inRange : sorted;
  // 在并列最近里优先掩体
  const minD = manhattan(cand[0], nearest);
  const ties = cand.filter(c => manhattan(c, nearest) === minD);
  const onCover = ties.filter(c => cv.has(c.gx + ',' + c.gy));
  return (onCover.length ? onCover : ties)[0];
}

// 尝试让当前选中单位施放一个可命中的技能（伤害/控制/治疗），命中返回 true
// 策略：残血自疗 → 以伤害为主（高伤/AoE 优先，可一击致命则优先），控制技作为低权重补充
function tryCast(pu, st) {
  // 1) 残血优先自疗
  const healIdx = pu.skills.findIndex(s => s.cd === 0 && s.isHeal);
  if (healIdx >= 0 && pu.hp / pu.maxHp < 0.4) {
    const allies = st.units.filter(u => u.team === 'player' && u.hp > 0)
      .filter(a => manhattan(a, pu) <= pu.skills[healIdx].range).sort((a, b) => a.hp - b.hp);
    if (allies.length) { Game.castSkill(healIdx); clickCell(allies[0].gx, allies[0].gy); return true; }
  }
  // 2) 伤害/控制：以 dmg 为主导评分（控制仅作小幅加权），目标是射程内最低血敌方
  const dmg = pu.skills.map((s, i) => ({ s, i })).filter(o => o.s.cd === 0 && !o.s.isHeal);
  let best = null, target = null;
  for (const { s, i } of dmg) {
    const enemies = st.units.filter(u => u.team === 'enemy' && u.hp > 0)
      .filter(e => manhattan(e, pu) <= s.range).sort((a, b) => a.hp - b.hp);
    if (enemies.length) {
      const score = s.dmg + (s.aoeRadius > 0 ? 20 : 0) + (s.isStun || s.isFreeze || s.isPoison || s.isBurn ? 8 : 0);
      if (!best || score > best.score) { best = { s, i, score }; target = enemies[0]; }
    }
  }
  if (best) { Game.castSkill(best.i); clickCell(target.gx, target.gy); return true; }
  return false;
}

// 让一个未行动玩家单位行动：攻击 →（不行就移动后再次攻击）→（还不行就跳过）
function actUnit(pu) {
  clickCell(pu.gx, pu.gy); // 选中
  let st = Game._state();
  if (tryCast(pu, st)) return;
  // 移动贴近最近敌人（避开危险格、优先掩体）
  const enemies = st.units.filter(u => u.team === 'enemy' && u.hp > 0);
  if (enemies.length) {
    const nearest = enemies.sort((a, b) => manhattan(a, pu) - manhattan(b, pu))[0];
    const best = pickMoveCell(pu, st, nearest);
    if (best) {
      Game.startMove();
      clickCell(best.gx, best.gy);
      st = Game._state();
      const me = st.units.find(u => u.id === pu.id);
      if (me && !me.acted) tryCast(me, st); // 移动后再尝试攻击
      return;
    }
  }
  Game.skipUnit();
}

// 跑完一整局，返回 'win' | 'lose'
function playBattle(startFn) {
  startFn();
  let safety = 0;
  while (safety < 400) {
    safety++;
    let st = Game._state();
    if (st.phase === 'gameOver') {
      const enemyAlive = st.units.filter(u => u.team === 'enemy' && u.hp > 0).length;
      return enemyAlive === 0 ? 'win' : 'lose';
    }
    const pu = st.units.find(u => u.team === 'player' && u.hp > 0 && !u.acted);
    if (pu) {
      actUnit(pu);
    } else {
      Game.endTurn(); // 敌方 AI + 回合结算（setTimeout 已同步化）
    }
  }
  // 超过安全上限：按当前存活判定（理论上不应到达）
  const st = Game._state();
  const enemyAlive = st.units.filter(u => u.team === 'enemy' && u.hp > 0).length;
  return enemyAlive === 0 ? 'win' : 'lose';
}

// ------------------------------------------------------------
// 5. 扫描
// ------------------------------------------------------------
console.log('\n=== Magic Arena 数值平衡自检 ===\n');

const DIFFS = ['easy', 'normal', 'hard'];

// 5a. 战役（确定性：固定敌人，无随机）→ 每档每关 1 局
console.log('— 战役胜率（确定性，6 关）—');
const campaignByDiff = {};
for (const d of DIFFS) {
  Game.setDifficulty(d);
  let wins = 0;
  const perLevel = [];
  for (let lv = 1; lv <= 6; lv++) {
    const r = playBattle(() => Game.startCampaign(lv));
    if (r === 'win') wins++;
    perLevel.push(r === 'win' ? '胜' : '负');
  }
  campaignByDiff[d] = { wins, perLevel };
  console.log(`  ${d.padEnd(6)}: ${wins}/6  关序[${perLevel.join(' ')}]`);
}

// 5b. 遭遇（随机：用可复现 RNG 跑多局求稳定胜率）
console.log('\n— 遭遇胜率（seeded skirmish，每档 60 局）—');
const skirmishByDiff = {};
for (const d of DIFFS) {
  Game.setDifficulty(d);
  let wins = 0; const N = 60;
  for (let i = 0; i < N; i++) {
    currentRng = makeRng(1000 + i * 31 + d.length * 7);
    const r = playBattle(() => Game.startSkirmish());
    if (r === 'win') wins++;
  }
  skirmishByDiff[d] = wins / N;
  console.log(`  ${d.padEnd(6)}: ${(wins / N * 100).toFixed(1)}%  (${wins}/${N})`);
}

// ------------------------------------------------------------
// 6. 健康度判定
// ------------------------------------------------------------
console.log('\n=== 平衡结论 ===');
const camp = DIFFS.map(d => campaignByDiff[d].wins);
const skir = DIFFS.map(d => skirmishByDiff[d]);
const monotonic = camp[0] >= camp[1] && camp[1] >= camp[2] && skir[0] >= skir[1] && skir[1] >= skir[2];
const normalWinnable = campaignByDiff.normal.wins >= 1 && skirmishByDiff.normal >= 0.25;

console.log(`难度梯度单调性(简单≥普通≥困难): ${monotonic ? '✅ 健康' : '❌ 失衡'}`);
console.log(`普通档可玩性(战役≥1关 & 遭遇≥25%): ${normalWinnable ? '✅ 健康' : '❌ 需调参'}`);
console.log(`战役胜场 简单/普通/困难 = ${camp.join(' / ')}`);
console.log(`遭遇胜率 简单/普通/困难 = ${skir.map(s => (s * 100).toFixed(0) + '%').join(' / ')}`);

if (monotonic && normalWinnable) {
  console.log('\n数值平衡自检: 通过 ✅ （难度梯度合理，普通档具备可玩与挑战）');
  process.exit(0);
} else {
  console.log('\n数值平衡自检: 发现失衡 ❌ （需在 game.js 调整 DIFFICULTY 或单位数值）');
  process.exit(1);
}
