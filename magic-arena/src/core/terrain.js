// ============================================================
// Core: Terrain — 地图地形矩阵系统（方向5 地图系统升级 · Phase 1 核心机制）
// 参考：magic-arena/map-redesign-plan.md §2.2 / §3.2
// 提供 10+ 种地形类型、移动消耗、不可通行、高地、旧格式兼容升迁。
// 纯数据 + 纯函数，零战斗逻辑侵入；旧地图（cover/hazard）自动升迁为平地矩阵，
// 保持既有 cover(-30%受伤) 与 hazard(+8伤害/回合) 行为完全不变 → balance-safe。
// ============================================================

// 地形类型定义表（字符 → 语义）
// cost: 进入该格的移动消耗（Infinity = 不可通行）；passable: 是否可进入；
// cover: 是否提供掩体(受伤-30%)；hazardDmg: 每回合环境伤害；high: 是否高地(站此攻击+20%)。
const TERRAIN = {
  '.': { key: '.', name: '平地', cost: 1, passable: true, cover: false, hazardDmg: 0, high: false, glyph: '' },
  'R': { key: 'R', name: '路面', cost: 1, passable: true, cover: false, hazardDmg: 0, high: false, glyph: '' },
  'T': { key: 'T', name: '树林', cost: 2, passable: true, cover: true, hazardDmg: 0, high: false, glyph: '林' },
  'W': { key: 'W', name: '矮墙', cost: 2, passable: true, cover: true, hazardDmg: 0, high: false, glyph: '墙' },
  'M': { key: 'M', name: '沼泽', cost: 3, passable: true, cover: false, hazardDmg: 4, high: false, glyph: '沼' },
  'L': { key: 'L', name: '熔岩', cost: Infinity, passable: false, cover: false, hazardDmg: 8, high: false, glyph: '岩' },
  'A': { key: 'A', name: '水域', cost: Infinity, passable: false, cover: false, hazardDmg: 0, high: false, glyph: '水' },
  'C': { key: 'C', name: '悬崖', cost: Infinity, passable: false, cover: false, hazardDmg: 0, high: false, glyph: '崖' },
  'H': { key: 'H', name: '高地', cost: 2, passable: true, cover: false, hazardDmg: 0, high: true, glyph: '高' },
  'D': { key: 'D', name: '门户', cost: 1, passable: true, cover: false, hazardDmg: 0, high: false, glyph: '门' },
  'B': { key: 'B', name: '可破坏墙', cost: 2, passable: true, cover: true, hazardDmg: 0, high: false, glyph: '裂' },
  'P': { key: 'P', name: '玩家部署区', cost: 1, passable: true, cover: false, hazardDmg: 0, high: false, glyph: '' },
  'E': { key: 'E', name: '敌方部署区', cost: 1, passable: true, cover: false, hazardDmg: 0, high: false, glyph: '' },
};

// 地形渲染配色（仅供 renderer.js 使用）
const TILE_BG = {
  'T': 'rgba(34,139,34,0.35)',
  'W': 'rgba(120,120,140,0.40)',
  'M': 'rgba(106,90,24,0.40)',
  'L': 'rgba(244,67,54,0.30)',
  'A': 'rgba(30,120,200,0.45)',
  'C': 'rgba(60,60,80,0.55)',
  'H': 'rgba(210,180,90,0.30)',
  'D': 'rgba(240,192,127,0.22)',
  'B': 'rgba(140,90,150,0.40)',
};
const TILE_FG = {
  'T': '#bfe6bf', 'W': '#dcdce6', 'M': '#e6dca0', 'L': '#ff8a80', 'A': '#90caf9',
  'C': '#b0b0c0', 'H': '#ffe0a0', 'D': '#f0c27f', 'B': '#e1bee7',
};

// 当前战场的地形网格（二维数组 grid[y][x] = TERRAIN 条目）；startBattle 时由 setActiveTerrain 填充
let activeTerrain = null;

// 解析地图 → 地形网格
// 新格式：mapObj.tiles 为行字符串数组，直接逐字符映射为 TERRAIN 矩阵（行列数以 tiles 为准）。
// 旧格式：无 tiles 字段 → 全平地矩阵 + 将 cover 升迁为掩体格(cost1,保持可通行)、hazard 升迁为危险格(cost1,+8伤害,保持可通行)。
//         这样旧 29 张地图的 cover/hazard 行为 100% 保留，balance-scan 零回归。
function parseMapTiles(mapObj) {
  if (mapObj && Array.isArray(mapObj.tiles) && mapObj.tiles.length > 0) {
    const grid = mapObj.tiles.map(row => row.split('').map(ch => TERRAIN[ch] || TERRAIN['.']));
    for (let y = 0; y < grid.length; y++) {
      if (!grid[y]) grid[y] = [];
      for (let x = 0; x < grid[y].length; x++) {
        if (!grid[y][x]) grid[y][x] = TERRAIN['.'];
      }
    }
    return grid;
  }
  // 旧格式兼容：GRID_W × GRID_H 全平地
  const grid = [];
  for (let y = 0; y < GRID_H; y++) {
    const row = [];
    for (let x = 0; x < GRID_W; x++) row.push(TERRAIN['.']);
    grid.push(row);
  }
  const coverSet = (mapObj && mapObj.cover) || [];
  coverSet.forEach(c => {
    if (grid[c.gy] && grid[c.gy][c.gx]) {
      // 旧 cover：保留可通行 + cost1，仅追加 cover 掩体属性（行为与旧版一致）
      grid[c.gy][c.gx] = Object.assign({}, TERRAIN['.'], { cover: true });
    }
  });
  const hazardSet = (mapObj && mapObj.hazard) || [];
  hazardSet.forEach(c => {
    if (grid[c.gy] && grid[c.gy][c.gx]) {
      // 旧 hazard：保留可通行 + cost1，仅把环境伤害设为 HAZARD_DMG（行为与旧版一致）
      grid[c.gy][c.gx] = Object.assign({}, TERRAIN['.'], { hazardDmg: HAZARD_DMG });
    }
  });
  return grid;
}

function setActiveTerrain(grid) { activeTerrain = grid; }

function tileAt(gx, gy) {
  if (!activeTerrain) return TERRAIN['.'];
  if (gy < 0 || gy >= activeTerrain.length) return TERRAIN['.'];
  if (gx < 0 || gx >= activeTerrain[gy].length) return TERRAIN['.'];
  return activeTerrain[gy][gx];
}

function getTileCost(gx, gy) { return tileAt(gx, gy).cost; }
function isPassable(gx, gy) { return tileAt(gx, gy).passable; }
function isCoverAt(gx, gy) { return tileAt(gx, gy).cover; }
function isHighAt(gx, gy) { return tileAt(gx, gy).high; }
function getTileHazardDmg(gx, gy) { return tileAt(gx, gy).hazardDmg; }
