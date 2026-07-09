// ============================================================
// lore.test.js — Magic Arena 世界观 / 传记 / 百科回归测试（方向5 · 工程基石）
// 位置：magic-arena/test/lore.test.js
// 用途：在无浏览器 / 无网络 / 无框架依赖的前提下，用 vm 在 Node 内加载真实
//       game.js，mock 浏览器环境，确定性地验证 PRODUCT.md 的两项硬性验收：
//         - 世界观百科 WORLD_LORE ≥ 30 篇（PRODUCT「百科≥30篇」）
//         - 角色传记 CHARACTER_BIOS ≥ 12 名且每人背景故事 ≥ 200 字
//         - 渲染路径：showLore() 后 #lore-panel 实际包含新增百科条目
//       纯数据 / 纯只读 UI 断言，零战斗逻辑改动、balance-safe；
//       为「方向2 内容扩建」的百科扩容提供确定性护栏，防止后续轮次静默缩减。
// 用法：node test/lore.test.js   （退出码 0=通过，1=失败）
// 约束：零 npm install、零外网请求，仅用 Node 内置模块（vm/fs/path）。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const gamePath = path.join(__dirname, '..', 'game.js');
let code = fs.readFileSync(gamePath, 'utf8');
code += '\n;globalThis.Game = Game;';
const sandbox = { document: documentMock, window: windowMock, localStorage: localStorageMock, setTimeout: setTimeoutMock, clearTimeout: clearTimeoutMock, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Game = sandbox.Game;
if (typeof Game !== 'object' || typeof Game._state !== 'function') throw new Error('Game 未正确加载（测试环境初始化失败）');
if (typeof domReady === 'function') domReady();

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) { if (cond) { pass++; } else { fail++; failures.push(msg); console.log('  ✗ FAIL: ' + msg); } }

console.log('\n=== Magic Arena 世界观 / 传记回归测试 ===\n');

const st = Game._state();

// —— L1：百科条目数 ≥ 30（PRODUCT「百科≥30篇」）——
console.log('[L1] 世界观百科 WORLD_LORE ≥ 30 篇');
assert(st.lore.worldCount >= 30, 'L1 百科条目数 ≥ 30（实测 ' + st.lore.worldCount + '）');
assert(st.lore.worldTitles.length === st.lore.worldCount, 'L1 worldTitles 长度与 worldCount 一致');
const dupWorld = st.lore.worldTitles.filter((t, i) => st.lore.worldTitles.indexOf(t) !== i);
assert(dupWorld.length === 0, 'L1 百科标题无重复（重复：' + dupWorld.join('/') + '）');

// —— L2：角色传记 ≥ 12 名且每人背景故事 ≥ 200 字（PRODUCT 验收）——
console.log('[L2] 角色传记 CHARACTER_BIOS ≥ 12 名 · 每人 ≥ 200 字');
assert(st.lore.biosCount >= 12, 'L2 可招募角色传记 ≥ 12 名（实测 ' + st.lore.biosCount + '）');
// 经 _state 暴露的 bios 仅含名字；改为扫描源码校验字数
const srcBio = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'lore.js'), 'utf8');
const bioBlock = srcBio.match(/const CHARACTER_BIOS = \{([\s\S]*?)\n\};/);
const bioEntries = bioBlock ? (bioBlock[1].match(/bio:\s*'([^']*)'/g) || []) : [];
let minLen = Infinity, shortName = '';
bioEntries.forEach(b => {
  const txt = b.replace(/bio:\s*'/, '').replace(/'$/, '');
  if (txt.length < minLen) { minLen = txt.length; shortName = txt.slice(0, 8); }
});
assert(bioEntries.length >= 12, 'L2 源码传记条目 ≥ 12（实测 ' + bioEntries.length + '）');
assert(minLen >= 200, 'L2 最短传记 ≥ 200 字（最短 ' + minLen + ' 字，样例「' + shortName + '…」）');

// —— L3：渲染路径——showLore() 后 #lore-panel 实际包含新增百科条目 ——
console.log('[L3] 渲染路径：showLore() 含新增百科（星渊走廊 / 世界树·余烬）');
Game.showLore();
const panel = getEl('lore-panel').innerHTML;
assert(panel.includes('星渊走廊'), 'L3 渲染含新增百科「星渊走廊」');
assert(panel.includes('世界树·余烬'), 'L3 渲染含新增百科「世界树·余烬」');
assert(panel.includes('天裂'), 'L3 渲染含新增百科「天裂」');

// —— 汇总 ——
console.log('\n=== 世界观 / 传记回归测试结果 ===');
console.log('通过: ' + pass + '  失败: ' + fail);
if (fail > 0) {
  console.log('\n失败明细:');
  failures.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  console.log('\n世界观 / 传记回归测试: 未通过 ❌');
  process.exit(1);
} else {
  console.log('\n世界观 / 传记回归测试: 全部通过 ✅（纯 Node · 零依赖 · 无网络）');
  process.exit(0);
}
