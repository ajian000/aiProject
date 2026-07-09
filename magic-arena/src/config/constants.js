// ============================================================
// Config: Constants — 游戏常量
// ============================================================

const GRID_W = 12; // 战场宽（列数）
const GRID_H = 10; // 战场高（行数）
const CELL = 80;
const COLORS = {
  gridBg: '#0a0a23',
  gridLine: '#1a3a5c',
  cellHighlight: 'rgba(240,192,127,0.25)',
  moveHighlight: 'rgba(64,180,255,0.3)',
  attackHighlight: 'rgba(244,67,54,0.3)',
  playerUnit: '#4caf50',
  enemyUnit: '#f44336',
  selected: '#f0c27f',
  hpGreen: '#4caf50',
  hpRed: '#f44336',
};
const HAZARD_DMG = 8;
const COVER_REDUCE = 0.7;
const VULN_AMP = 0.5;
const EMPOWER_AMP = 0.5;
// —— 兵种克制循环（方向2 Phase 1 · 决策深度）——
// 战克弓、弓克法、法克战；奶为中立辅助单位（不参与克制循环，也不被克制）。
const COUNTER_BONUS = 1.5;
const COUNTERS = { warrior: 'archer', archer: 'mage', mage: 'warrior' };
const UNIT_TYPE_LABEL = { warrior: '战', archer: '弓', mage: '法', healer: '奶' };
const UNIT_TYPE_COLOR = { warrior: '#ff7043', archer: '#4fc3f7', mage: '#b388ff', healer: '#69f0ae' };
const GROWTH = {
  expPerLevel: 100,
  expPerWin: 50,
  expPerKill: 25,
  maxLevel: 10,
  hpPerLevel: 14,
  dmgPerLevel: 4,
};
