// ============================================================
// terrain.test.js — Magic Arena 地形矩阵系统回归测试（方向5 地图系统升级）
// 位置：magic-arena/test/terrain.test.js
// 验证：parseMapTiles / 移动消耗 / 不可通行 / 高地 / 旧格式兼容 / river_plain 端到端。
// 用法：node test/terrain.test.js   （退出码 0=通过，1=失败）
// 约束：零 npm install、零外网请求，仅用 Node 内置模块（vm/fs/path）。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- 浏览器环境 Mock（与 smoke-test 一致的最小子集）----
class El {
  constructor(id) { this.id = id; this._text = ''; this._html = ''; this.className = ''; this.disabled = false; this.onclick = null; this.style = {}; this.children = []; this.width = 640; this.height = 640; this.scrollTop = 0; this.scrollHeight = 0; this._clickHandler = null; this._ctx = null; }
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
const localStorageMock = { getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => _store.set(k, String(v)), removeItem: (k) => _store.delete(k) };
const setTimeoutMock = (fn) => { fn(); return 0; };
const clearTimeoutMock = () => {};

// ---- 加载真实 game.js ----
const gamePath = path.join(__dirname, '..', 'game.js');
let code = fs.readFileSync(gamePath, 'utf8');
code += '\n;globalThis.Game = Game;';
const sandbox = { document: documentMock, window: windowMock, localStorage: localStorageMock, setTimeout: setTimeoutMock, clearTimeout: clearTimeoutMock, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Game = sandbox.Game;
if (typeof Game !== 'object' || typeof Game.parseMapTiles !== 'function') throw new Error('Game/地形系统 未正确加载');
if (typeof domReady === 'function') domReady();

// ---- 测试工具 ----
let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) { if (cond) { pass++; } else { fail++; failures.push(msg); console.log('  ✗ FAIL: ' + msg); } }

// ============================================================
// T1 — parseMapTiles：新格式 tiles 解析
// ============================================================
console.log('T1  parseMapTiles（新 tiles 格式）');
const sample = ['..AA..', '..AA..', 'T....H']; // 3 行 6 列
const g = Game.parseMapTiles({ tiles: sample });
Game.setActiveTerrain(g);
assert(g.length === 3 && g[0].length === 6, 'tiles 矩阵维度应为 3×6');
assert(Game.getTileCost(2, 0) === Infinity, '水域(A) 移动消耗应为 Infinity');
assert(Game.isPassable(2, 0) === false, '水域(A) 应不可通行');
assert(Game.isCoverAt(0, 2) === true, '树林(T) 应提供掩体');
assert(Game.getTileCost(0, 2) === 2, '树林(T) 移动消耗应为 2');
assert(Game.isHighAt(5, 2) === true, '高地(H) 应判定为高');
assert(Game.getTileHazardDmg(0, 0) === 0, '平地危险伤害应为 0');

// ============================================================
// T2 — 旧格式兼容：cover/hazard 自动升迁，行为不变
// ============================================================
console.log('T2  旧格式兼容（cover/hazard 自动升迁）');
const g2 = Game.parseMapTiles({ cover: [{ gx: 1, gy: 1 }], hazard: [{ gx: 2, gy: 2 }] });
Game.setActiveTerrain(g2);
assert(Game.isCoverAt(1, 1) === true, '旧 cover 升迁后仍应提供掩体');
assert(Game.getTileCost(1, 1) === 1, '旧 cover 应保持可通行 cost1（行为不变）');
assert(Game.getTileHazardDmg(2, 2) === 8, '旧 hazard 升迁后危险伤害仍为 8（行为不变）');
assert(Game.isPassable(2, 2) === true, '旧 hazard 应保持可通行（行为不变）');
assert(Game.isCoverAt(0, 0) === false && Game.getTileCost(0, 0) === 1, '平地应无掩体且 cost1');

// ============================================================
// T3 — 端到端：河道哨探(river_plain) 地形机制
// ============================================================
console.log('T3  河道哨探 river_plain 端到端');
const enemies = [{ src: 'enemy', i: 0 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 2 }, { src: 'enemy', i: 3 }, { src: 'enemy', i: 4 }];
Game._testStartMapById('river_plain', enemies);
const st = Game._state();
assert(st.currentMap && st.currentMap.id === 'river_plain', '应在 river_plain 地图开战');
assert(typeof st.terrainInfo === 'string' && st.terrainInfo.includes('A') && st.terrainInfo.includes('D'), 'terrainInfo 应包含水域(A)与门户(D)');

// 不可通行：中央水域(col5/col6)任何行均不可通行（除 row4 桥 D）
const waterBlocked = [0, 1, 2, 3, 5, 6, 7, 8, 9].every(r => !Game.isPassable(5, r) && !Game.isPassable(6, r));
assert(waterBlocked, '中央水域(col5/6)除桥外应全部不可通行');
assert(Game.isPassable(5, 4) && Game.isPassable(6, 4), 'row4 门户(D)桥应可通行');

// 高地：左侧(4,2)与右侧(7,7)应为高地
assert(Game.isHighAt(4, 2) === true, '左侧(4,2) 应为高地');
assert(Game.isHighAt(7, 7) === true, '右侧(7,7) 应为高地');

// 树林掩体 + 移动消耗 2
assert(Game.isCoverAt(2, 1) === true && Game.getTileCost(2, 1) === 2, '树林(2,1) 应为掩体且 cost2');

// 移动范围：玩家单位单回合无法跨越河流到达右侧（gx>=7 不可达）
const mover = st.units.find(u => u.team === 'player' && u.hp > 0);
const cells = Game._testGetMoveCells(mover.name);
const maxGx = cells.reduce((m, c) => Math.max(m, c.gx), -1);
assert(maxGx <= 6, '单回合移动范围不应越过河流抵达右侧（maxGx<=6，实测 ' + maxGx + '）');
assert(cells.length > 0, '玩家单位应有合法移动格');

// ============================================================
// T4 — 回归守卫：旧平原地图(plains) 移动行为不变（全平地 → 曼哈顿菱形）
// ============================================================
console.log('T4  旧地图移动回归（plains 全平地）');
Game._testStartMapById('plains', enemies);
const stOld = Game._state();
const pu = stOld.units.find(u => u.team === 'player' && u.hp > 0);
const oldCells = Game._testGetMoveCells(pu.name);
const budget = pu.moveRange;
// 全平地无阻挡 → 每个 gx,gy 空地曼哈顿距离 ≤ moveRange 都应可达
let expected = 0;
for (let x = 0; x < 12; x++) for (let y = 0; y < 10; y++) {
  if (x === pu.gx && y === pu.gy) continue;
  if (Math.abs(x - pu.gx) + Math.abs(y - pu.gy) <= budget) expected++;
}
assert(oldCells.length === expected, `旧平原地图可达格数应等于曼哈顿菱形(${expected})，实测 ${oldCells.length}`);

// ============================================================
// 结果汇总
// ============================================================
console.log(`\n=== 地形系统测试: ${pass} 通过 / ${fail} 失败 ===`);
if (fail > 0) {
  console.log('失败项:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
