// ============================================================
// perf-check.js — Magic Arena 纯 Node 性能优化验证（Stage 3 · 性能优化）
// 位置：magic-arena/test/perf-check.js
// 用途：在无浏览器 / 无网络 / 无框架依赖的前提下，用 vm 在 Node 内加载真实
//       game.js，mock 一个「计数式 Canvas 2D 上下文」，验证「静态层离屏缓存」生效：
//       地图不变时，背景+网格线+地形只在切换地图时绘制一次；之后每次交互帧只做
//       drawImage 合成 + 动态层，Canvas 绘制开销大幅下降（对应阶段三「无可见卡顿」）。
// 用法：node test/perf-check.js   （退出码 0=通过，1=失败）
// 约束：零 npm install、零外网请求，仅用 Node 内置模块（vm/fs/path）。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------
// 1. 计数式 Canvas 2D 上下文（关键绘制调用累计到共享 counts）
//    判别依据：
//      moveTo      —— 仅 buildStaticLayer 绘制网格线时调用（每地图 18 次）
//      strokeRect  —— 仅 buildStaticLayer 绘制地形掩体边框时调用
//      drawImage   —— 仅在 render() 合成静态层时调用（每帧一次）
//      fillText    —— 静态层(地形文字) 与 动态层(单位名/状态) 都会调用（总量不用于断言）
//    所有 Canvas（主画布 / 离屏静态层）共用同一 counts，聚合统计。
// ------------------------------------------------------------
const counts = { moveTo: 0, strokeRect: 0, drawImage: 0, fillText: 0, stroke: 0, fillRect: 0, fill: 0, arc: 0 };
function makeCountingCtx() {
  return {
    _counts: counts,
    clearRect() {}, fillRect() { counts.fillRect++; }, beginPath() {},
    moveTo() { counts.moveTo++; }, lineTo() {}, stroke() { counts.stroke++; },
    fill() { counts.fill++; }, arc() { counts.arc++; },
    strokeRect() { counts.strokeRect++; }, fillText() { counts.fillText++; },
    drawImage() { counts.drawImage++; }, save() {}, restore() {},
    // fillStyle / font / textAlign / lineWidth 等属性赋值直接忽略
  };
}

class CanvasMock {
  constructor() { this.width = 640; this.height = 640; this._ctx = makeCountingCtx(); }
  getContext() { return this._ctx; }
  addEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 640 }; }
}

class El {
  constructor(id) {
    this.id = id; this._text = ''; this._html = ''; this.className = '';
    this.disabled = false; this.onclick = null; this.style = {};
    this.children = []; this.width = 640; this.height = 640;
    this.scrollTop = 0; this.scrollHeight = 0; this._clickHandler = null;
  }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  setAttribute(k, v) { if (k === 'onclick') this.onclick = v; }
  removeAttribute(k) { if (k === 'onclick') this.onclick = null; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(type, fn) { if (type === 'click') this._clickHandler = fn; }
}

const arenaCanvas = new CanvasMock();
const elements = new Map();
function getEl(id) { if (!elements.has(id)) elements.set(id, new El(id)); return elements.get(id); }
const documentMock = {
  getElementById: (id) => (id === 'arena' ? arenaCanvas : getEl(id)),
  createElement: (tag) => (tag === 'canvas' ? new CanvasMock() : new El('created')),
  addEventListener: () => {},
};

let domReady = null;
const windowMock = { addEventListener: (t, fn) => { if (t === 'DOMContentLoaded') domReady = fn; } };

const _store = new Map();
const localStorageMock = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};
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

if (typeof Game !== 'object' || typeof Game._perf !== 'function') {
  throw new Error('Game._perf 未暴露（性能钩子缺失，或 game.js 未正确加载）');
}
if (typeof domReady === 'function') domReady(); // 触发 DOMContentLoaded → init()

// ------------------------------------------------------------
// 3. 断言
// ------------------------------------------------------------
let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); console.log('  ✗ FAIL: ' + msg); } }

console.log('\n=== Magic Arena 性能优化验证（静态层离屏缓存）===\n');

// 基线：init 时渲染平原地图（buildStaticLayer 一次，平原无掩体/危险格）
const perf0 = Game._perf();
assert(perf0.staticRebuilds === 1, 'init 阶段静态层构建 1 次（平原），实际 ' + perf0.staticRebuilds);

// 切换到雪山地图（含 1 掩体 + 3 危险格），触发一次重建
Game.setDifficulty('normal');
Game.startCampaign(3);
const perf1 = Game._perf();
assert(perf1.staticRebuilds === 2, '切换雪山地图后静态层重建 2 次，实际 ' + perf1.staticRebuilds);
assert(counts.strokeRect === 1, '地形掩体描边(strokeRect) 累计 1 次（雪山顶 1 掩体），实际 ' + counts.strokeRect);

// 在同一地图进行大量交互帧（选中/取消/结束回合/敌方 AI/回合结算）
let frames = 0;
for (let i = 0; i < 30; i++) {
  const st = Game._state();
  if (st.phase === 'gameOver') { Game.startCampaign(3); } // 重置到同一雪山顶地图 → 不应触发重建
  const pu = Game._state().units.find(u => u.team === 'player' && u.hp > 0 && !u.acted);
  if (pu) {
    const h = getEl('arena')._clickHandler;
    if (h) { h({ clientX: pu.gx * CELL + 40, clientY: pu.gy * CELL + 40 }); frames++; }
    if (typeof Game.cancelAction === 'function') Game.cancelAction();
  }
  Game.endTurn(); // 敌方 AI + 回合结算，每次都 render
  frames++;
}

const perf2 = Game._perf();
const moveToAfter = counts.moveTo;
const strokeRectAfter = counts.strokeRect;
const drawImageAfter = counts.drawImage;

// 核心断言：地图未变 → 静态层不再重建，网格/地形绘制调用数保持恒定
assert(perf2.staticRebuilds === 2, '30 帧交互后静态层重建次数仍为 2（缓存命中，无重复绘制网格），实际 ' + perf2.staticRebuilds);
assert(strokeRectAfter === 1, '地形描边仍为 1 次（掩体仅在 build 绘制，不随帧重绘），实际 ' + strokeRectAfter);
assert(moveToAfter === 18 * perf2.staticRebuilds, '网格线 moveTo 调用 = 18×重建次数（' + moveToAfter + ' = 18×' + perf2.staticRebuilds + '），证明网格未逐帧重绘');
assert(drawImageAfter > 0, '每次交互帧都通过 drawImage 合成静态层（drawImage = ' + drawImageAfter + '）');

// 量化收益：若无缓存，每帧重绘 18 条网格线 → 远超实际
const baselineRenders = 2; // init 1 + 切换 1
const naiveMoveTo = 18 * (baselineRenders + frames);
assert(moveToAfter < naiveMoveTo, '静态层缓存显著降低绘制开销：实际 moveTo=' + moveToAfter + ' ≪ 无缓存预估 ' + naiveMoveTo + '（约 ' + Math.round((1 - moveToAfter / naiveMoveTo) * 100) + '% 减少）');

// ------------------------------------------------------------
// 4. 汇总
// ------------------------------------------------------------
console.log('\n=== 性能验证结果 ===');
console.log('通过: ' + pass + '  失败: ' + fail);
console.log('绘制调用统计: moveTo=' + counts.moveTo + ' strokeRect=' + counts.strokeRect +
  ' drawImage=' + counts.drawImage + ' | staticRebuilds=' + perf2.staticRebuilds + ' | 交互帧≈' + frames);
if (fail > 0) {
  console.log('\n失败明细:');
  failures.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  console.log('\n性能验证: 未通过 ❌');
  process.exit(1);
} else {
  console.log('\n性能验证: 全部通过 ✅（静态层离屏缓存生效 · 纯 Node · 零依赖 · 无网络）');
  process.exit(0);
}
