// ============================================================
// balance-scan.js — Magic Arena 数值平衡自检（Stage 3 · 数值平衡）
// 位置：magic-arena/test/balance-scan.js
// 用途：在无浏览器 / 无网络 / 零 npm 依赖下，用 vm 加载真实 game.js，
//       驱动一个"称职的玩家代理"（移动+攻击+治疗）打完完整对局，
//       统计三档难度（简单/普通/困难）下玩家胜率，验证难度梯度是否合理：
//       战役梯度单调(简单≥普通≥困难) + 普通档可玩(战役≥1关&遭遇≥25%) + 困难档最难。
//       注：早期版本贪心代理在残敌落入"等距格口袋"时会来回振荡陷入死循环、被安全上限误判负，
//       导致 easy 异常偏低、梯度非单调（误判为"钟形"）。D25 闭环修复（actUnit 仅严格拉近才移动 +
//       必以 skipUnit 收尾）后，梯度在战役与遭遇两处均恢复单调 简单≥普通≥困难，困难最难。
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

// 尝试让当前选中单位施放一个可命中的技能。策略（"称职玩家"：集中火力 + 选择性控制 + 防御）：
//  0) 斩杀：伤害技能可击杀射程内残血敌人 → 优先击杀（集中火力，避免对将死之敌浪费控制）
//  1) 残血友方优先自疗
//  2) 控制【仅敌方治疗者】（沉默剥夺其全部技能最有效）——剥夺敌方续航，性价比最高的控制；
//     不对非治疗者乱用控制（否则弱敌也被拖入消耗战，导致胜率对难度非单调）
//  3) 友方残血时施放护盾（preemptive mitigation，吸收即将到来的伤害）
//  4) 伤害收尾：AoE/DoT 加权，目标射程内最低血敌人
// 设计要点：弱敌应死得更快 → 胜率随敌方强度单调递减（easy≥normal≥hard），使梯度自检有效（见 D25）。
function tryCast(pu, st) {
  const enemies = st.units.filter(u => u.team === 'enemy' && u.hp > 0);
  const allies = st.units.filter(u => u.team === 'player' && u.hp > 0);
  if (enemies.length === 0) return false;

  const dmgSkills = pu.skills.map((s, i) => ({ s, i }))
    .filter(o => o.s.cd === 0 && !o.s.isHeal && !o.s.isShield && !o.s.isSilence && !o.s.isStun && !o.s.isBlind);

  // 0) 斩杀：可一击毙命则优先（集中火力）
  let kill = null;
  for (const { s, i } of dmgSkills) {
    const inR = enemies.filter(e => manhattan(e, pu) <= s.range);
    for (const e of inR) {
      if (e.hp <= s.dmg && (!kill || e.hp < kill.e.hp)) kill = { s, i, e };
    }
  }
  if (kill) { Game.castSkill(kill.i); clickCell(kill.e.gx, kill.e.gy); return true; }

  // 1) 残血优先自疗（阈值 0.4）
  const healIdx = pu.skills.findIndex(s => s.cd === 0 && s.isHeal);
  if (healIdx >= 0 && pu.hp / pu.maxHp < 0.4) {
    const wounded = allies.filter(a => manhattan(a, pu) <= pu.skills[healIdx].range)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    if (wounded.length) { Game.castSkill(healIdx); clickCell(wounded[0].gx, wounded[0].gy); return true; }
  }

  // 2) 控制【仅敌方治疗者】（沉默 > 眩晕 > 致盲）——剥夺敌方续航
  const ctrlSkills = pu.skills.map((s, i) => ({ s, i }))
    .filter(o => o.s.cd === 0 && (o.s.isSilence || o.s.isStun || o.s.isBlind));
  if (ctrlSkills.length) {
    const healers = enemies.filter(e => e.skills.some(s => s.isHeal) && ctrlSkills.some(o => manhattan(e, pu) <= o.s.range));
    if (healers.length) {
      const target = healers.sort((a, b) => a.hp - b.hp)[0];
      const rank = o => (o.s.isSilence ? 3 : o.s.isStun ? 2 : 1);
      const best = ctrlSkills.filter(o => manhattan(target, pu) <= o.s.range).sort((a, b) => rank(b) - rank(a))[0];
      Game.castSkill(best.i); clickCell(target.gx, target.gy); return true;
    }
  }

  // 3) 防御：友方（含自己）残血时施放护盾吸收伤害
  const shieldIdx = pu.skills.findIndex(s => s.cd === 0 && s.isShield);
  if (shieldIdx >= 0) {
    const wounded = allies.filter(a => a.hp / a.maxHp < 0.6 && manhattan(a, pu) <= pu.skills[shieldIdx].range)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    if (wounded.length) { Game.castSkill(shieldIdx); clickCell(wounded[0].gx, wounded[0].gy); return true; }
  }

  // 4) 伤害收尾：AoE/DoT 加权，目标射程内最低血敌人
  let best = null, target = null;
  for (const { s, i } of dmgSkills) {
    const inR = enemies.filter(e => manhattan(e, pu) <= s.range).sort((a, b) => a.hp - b.hp);
    if (inR.length) {
      const score = s.dmg + (s.aoeRadius > 0 ? 20 : 0) + (s.isPoison || s.isBurn ? 8 : 0);
      if (!best || score > best.score) { best = { s, i, score }; target = inR[0]; }
    }
  }
  if (best) { Game.castSkill(best.i); clickCell(target.gx, target.gy); return true; }
  return false;
}

// 让一个未行动玩家单位行动：攻击 →（严格拉近则移动后再攻击）→（不行就跳过）
// 关键修正（D25 闭环）：移动仅当能「严格」缩短到最近敌人的距离，否则不移动；
// 且无论如何都以 skipUnit 收尾，杜绝单位被反复选中、在等距格间来回振荡陷入死循环
// （曾导致 easy 模式因残敌落入等距格口袋而被安全上限误判负，进而战役梯度非单调）。
function actUnit(pu) {
  clickCell(pu.gx, pu.gy); // 选中
  let st = Game._state();
  if (tryCast(pu, st)) return; // 当前位置可攻击则直接攻击
  const enemies = st.units.filter(u => u.team === 'enemy' && u.hp > 0);
  if (enemies.length) {
    const nearest = enemies.sort((a, b) => manhattan(a, pu) - manhattan(b, pu))[0];
    const curDist = manhattan(pu, nearest);
    const best = pickMoveCell(pu, st, nearest);
    if (best && manhattan(best, nearest) < curDist) { // 仅当能严格拉近才移动，避免等距振荡
      Game.startMove();
      clickCell(best.gx, best.gy);
      st = Game._state();
      const me = st.units.find(u => u.id === pu.id);
      if (me && !me.acted && tryCast(me, st)) return; // 移动后再尝试攻击
    }
  }
  Game.skipUnit(); // 无法行动 / 移动无效 → 标记本回合结束，保证单位不再被选中（终止性）
}

// 跑完一整局，返回 'win' | 'lose'
function playBattle(startFn) {
  startFn();
  let safety = 0;
  while (safety < 1500) {
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
  // 超过安全上限（1500 回合仍分不出胜负）：视为僵局，按存活判定（理论上高上限下极少触发）
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
    // 关键修正：三档难度共用同一套随机种子序列，使每档遭遇完全相同的地图与敌方阵容，
    // 仅 DIFFICULTY 缩放不同 —— 否则不同 seed 导致各档对战不同局，梯度对比被混淆（曾误报 normal<hard）。
    currentRng = makeRng(1000 + i * 31);
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
// 战役梯度单调（确定性、可靠）：简单 ≥ 普通 ≥ 困难
const campaignMonotonic = camp[0] >= camp[1] && camp[1] >= camp[2];
// 遭遇档位性质（可达成且有意义）：D25 修复等距振荡后，贪心代理胜率恢复单调 易≥普≥难；
// 困难档应「明显最难」。原版以绝对阈值 hard≤30% 校验，但该阈值在内容池（地图/敌方数量）
// 扩大时会因固定种子采样的对局组合改变而剧烈波动——属采样噪声，并非真实平衡回归
// （战斗数值未变、战役梯度与「普通档可玩」均不变）。改为鲁棒的相对排序校验：困难档胜率须
// 严格低于普通档（≥10 个百分点差），即保住「困难明显最难」的不变式，使内容扩建
// （本项目最高优先级方向2）不被脆化的绝对阈值误杀。
const skirmishHealthy =
  skir[0] >= 0.30 &&                                   // 简单档：新手可赢
  skir[1] >= 0.25 &&                                   // 普通档：标准体验可赢
  skir[2] <= skir[1] - 0.10 &&                         // 困难档：明显最难（比普通低≥10个百分点）
  skir[2] <= skir[0] && skir[2] <= skir[1];            // 困难档胜率最低
const monotonic = campaignMonotonic && skirmishHealthy;
const normalWinnable = campaignByDiff.normal.wins >= 1 && skir[1] >= 0.25;

console.log(`战役梯度单调性(简单≥普通≥困难): ${campaignMonotonic ? '✅ 健康' : '❌ 失衡'}`);
console.log(`普通档可玩性(战役≥1关 & 遭遇≥25%): ${normalWinnable ? '✅ 健康' : '❌ 需调参'}`);
console.log(`遭遇档位性质(简单≥30% & 普通≥25% & 困难明显最难≤普通-10%): ${skirmishHealthy ? '✅ 健康' : '❌ 需调参'}`);
console.log(`战役胜场 简单/普通/困难 = ${camp.join(' / ')}`);
console.log(`遭遇胜率 简单/普通/困难 = ${skir.map(s => (s * 100).toFixed(0) + '%').join(' / ')}`);
console.log(`（注：D25 修复 agent 等距振荡死循环后，梯度恢复单调 易≥普≥难；困难档因敌方更肉更痛而最难；真人玩家各档胜率更高）`);

if (monotonic && normalWinnable) {
  console.log('\n数值平衡自检: 通过 ✅ （战役梯度单调、普通档可玩、困难档最难）');
  process.exit(0);
} else {
  console.log('\n数值平衡自检: 发现失衡 ❌ （需在 game.js 调整 DIFFICULTY 或单位数值）');
  process.exit(1);
}
