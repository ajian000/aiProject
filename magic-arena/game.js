
// ===== _entry.js =====
// ============================================================
// Magic Arena — 魔法竞技场 · 单机回合制战术战斗游戏
// MVP: F1~F6 全部核心功能 + 阶段二拓展（状态效果/ AoE / 手感）
// 阶段二子系统：战役进度 + 多地图地形 + 单局遭遇（@A16）
// 模块化重构：src/ 各模块 → build.js 拼接 → game.js
// ============================================================
const Game = (() => {
  'use strict';


// ===== config/constants.js =====
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


// ===== config/difficulty.js =====
// ============================================================
// Config: Difficulty & Factions — 难度与阵营
// ============================================================

const FACTIONS = {
  pyro:   { name: '火焰', color: '#ff7043', aiStyle: 'aggressive' },
  cryo:   { name: '寒冰', color: '#4fc3f7', aiStyle: 'defensive'  },
  nature: { name: '自然', color: '#81c784', aiStyle: 'skirmish'   },
  light:  { name: '圣光', color: '#ffd54f', aiStyle: 'support'   },
  // —— 隐藏阵营（方向2 内容扩建 · 隐藏章节）——
  // eclipse=蚀教（禁忌灵脉）/ echo=回响（源初灵脉分裂前的回响体）/ primordial=溯光者（灵脉分裂之前的守忆者）
  // 三者此前未注册时 AI 默认 aggressive；此处显式登记并以同类 aiStyle 注册，行为与既有默认完全一致（balance-safe）。
  eclipse:    { name: '蚀教', color: '#ab47bc', aiStyle: 'aggressive' },
  echo:       { name: '回响', color: '#4dd0e1', aiStyle: 'aggressive' },
  primordial: { name: '溯光', color: '#ffd180', aiStyle: 'aggressive' },
  // —— 外传阵营（方向2 内容扩建 · 外传六/七/本轮回合登场）——
  // rust=锈铁佣兵（无灵脉的凡人武装）/ construct=灰烬构装体（失控灵械）/ dust=噬尘游民（游荡废墟的拾荒商队）
  // 三者此前未注册时 AI 默认 aggressive；此处显式登记，行为与既有默认完全一致（balance-safe）。
  rust:       { name: '锈铁佣兵', color: '#a1887f', aiStyle: 'aggressive' },
  construct:  { name: '灰烬构装', color: '#78909c', aiStyle: 'aggressive' },
  dust:       { name: '噬尘游民', color: '#c0a16b', aiStyle: 'aggressive' },
};

const DIFFICULTY = {
  easy:   { key: 'easy',   name: '简单', hpMul: 0.60, dmgMul: 0.65 },
  normal: { key: 'normal', name: '普通', hpMul: 0.80, dmgMul: 1.00 },
  hard:   { key: 'hard',   name: '困难', hpMul: 1.25, dmgMul: 1.10 },
};


// ===== core/terrain.js =====
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


// ===== data/skills.js =====
// ============================================================
// Data: Skills — 18 个技能定义
// ============================================================

const SKILL_DEFS = {
  fireball: { name: '火球术', dmg: 25, range: 3, cooldown: 0, desc: '范围3格，25伤害', aoeRadius: 0 },
  frostbolt: { name: '冰霜箭', dmg: 15, range: 4, cooldown: 1, desc: '范围4格，15伤害，CD1回合', aoeRadius: 0 },
  heal: { name: '治愈术', dmg: -20, range: 2, cooldown: 2, desc: '回复20HP，范围2格，CD2回合', aoeRadius: 0, isHeal: true },
  lightning: { name: '闪电链', dmg: 18, range: 3, cooldown: 2, desc: '范围3格，18伤害，CD2回合', aoeRadius: 0 },
  shadowbolt: { name: '暗影弹', dmg: 22, range: 3, cooldown: 0, desc: '范围3格，22伤害', aoeRadius: 0 },
  drain: { name: '生命汲取', dmg: 12, range: 2, cooldown: 1, desc: '范围2格，12伤害+自回8HP，CD1', aoeRadius: 0, selfHeal: 8 },
  meteor: { name: '陨石术', dmg: 18, range: 4, cooldown: 2, desc: '范围4格，18伤害，命中格周围1格内所有敌方单位，CD2回合', aoeRadius: 1 },
  stun: { name: '眩晕术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标下回合无法行动（控制），CD3回合', aoeRadius: 0, isStun: true },
  burn: { name: '灼烧术', dmg: 0, range: 3, cooldown: 2, desc: '范围3格，点燃敌方目标2回合，每回合受6点燃烧伤害（可叠加，上限4回合）', aoeRadius: 0, isBurn: true, burnTurns: 2, burnDmg: 6 },
  freeze: { name: '冰冻术', dmg: 6, range: 3, cooldown: 2, desc: '范围3格，6伤害并使敌方目标被冰冻、无法移动2回合', aoeRadius: 0, isFreeze: true, freezeTurns: 2 },
  poison: { name: '中毒术', dmg: 4, range: 3, cooldown: 2, desc: '范围3格，造成4直接伤害并使敌方中毒3回合，每回合受4点毒性伤害（可叠加伤害，上限12），中毒期间治疗减半', aoeRadius: 0, isPoison: true, poisonTurns: 3, poisonDmg: 4, poisonMax: 12 },
  blind: { name: '致盲术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标致盲2回合，期间其造成的所有伤害降低50%（削弱敌方输出）', aoeRadius: 0, isBlind: true, blindTurns: 2 },
  silence: { name: '沉默术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标沉默2回合，期间无法施放任何技能（只能移动），CD3回合', aoeRadius: 0, isSilence: true, silenceTurns: 2 },
  taunt: { name: '嘲讽术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，嘲讽敌方目标2回合，期间其攻击被强制吸引向你（坦克引流·保护队友）', aoeRadius: 0, isTaunt: true, tauntTurns: 2 },
  smite: { name: '圣光打击', dmg: 22, range: 3, cooldown: 1, desc: '范围3格，22伤害，CD1回合', aoeRadius: 0 },
  shield: { name: '守护之盾', dmg: 0, range: 2, cooldown: 2, desc: '范围2格，为友方单位附加护盾，吸收最多20点伤害，持续2回合，CD2回合', aoeRadius: 0, isShield: true, shieldTurns: 2, shieldAmount: 20 },
  vuln: { name: '易伤术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标易伤2回合，期间其受到的所有伤害提升50%（集火放大器）', aoeRadius: 0, isVuln: true, vulnTurns: 2 },
  fear: { name: '恐惧术', dmg: 0, range: 3, cooldown: 2, desc: '范围3格，使敌方目标恐惧2回合，期间其被迫远离你移动（恐慌撤退），无法主动接近', aoeRadius: 0, isFear: true, fearTurns: 2 },
  pull: { name: '拉拽术', dmg: 0, range: 3, cooldown: 2, desc: '范围3格，将敌方目标向你拉近最多2格（强制位移·可拉入射程或危险格），CD2回合', aoeRadius: 0, isPull: true, pullRange: 2 },
  empower: { name: '强化术', dmg: 0, range: 2, cooldown: 2, desc: '范围2格，为友方单位附加强化，使其造成的所有伤害提升50%（持续2回合·进攻增益），CD2回合', aoeRadius: 0, isEmpower: true, empowerTurns: 2 },
};


// ===== data/units.js =====
// ============================================================
// Data: Units — 所有单位定义（玩家 + 敌方 + Boss）
// ============================================================

const PLAYER_UNITS = [
  { name: '炎法师·艾拉', maxHp: 80, moveRange: 2, faction: 'pyro', unitType: 'mage', skills: ['fireball', 'burn', 'heal'], color: '#66bb6a' },
  { name: '雷法师·特斯拉', maxHp: 70, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'silence', 'taunt'], color: '#43a047' },
  { name: '暗法师·莫甘娜', maxHp: 65, moveRange: 2, faction: 'nature', unitType: 'mage', skills: ['meteor', 'vuln', 'blind'], color: '#81c784' },
  { name: '风行者·翠影', maxHp: 62, moveRange: 4, faction: 'nature', unitType: 'archer', skills: ['lightning', 'frostbolt', 'heal'], color: '#a5d6a7' },
  { name: '熔岩剑士·戈伦', maxHp: 92, moveRange: 2, faction: 'pyro', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#ff7043' },
];

const LIGHT_SQUAD = [
  { name: '圣光祭司·塞拉', maxHp: 72, moveRange: 2, faction: 'light', unitType: 'healer', skills: ['heal', 'smite', 'empower'], color: '#ffd54f' },
  { name: '圣堂守卫·加百列', maxHp: 88, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'heal', 'pull'], color: '#ffca28' },
  { name: '曙光射手·奥菲', maxHp: 64, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['lightning', 'smite', 'meteor'], color: '#ffe082' },
  { name: '圣盾使·乌列尔', maxHp: 90, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#ffd54f' },
  { name: '曦光咏者·提娅', maxHp: 74, moveRange: 2, faction: 'light', unitType: 'mage', skills: ['smite', 'meteor', 'heal'], color: '#fff176' },
];

const PLAYER_SQUADS = {
  classic: PLAYER_UNITS,
  light: LIGHT_SQUAD,
};

const ENEMY_UNITS = [
  { name: '骷髅法师·卡尔', maxHp: 75, moveRange: 2, faction: 'nature', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#ef5350' },
  { name: '暗影巫·维克', maxHp: 65, moveRange: 3, faction: 'cryo', unitType: 'mage', skills: ['lightning', 'shadowbolt', 'poison'], color: '#e53935' },
  { name: '亡灵术士·安娜', maxHp: 60, moveRange: 2, faction: 'pyro', unitType: 'healer', skills: ['meteor', 'drain', 'heal'], color: '#c62828' },
  { name: '烈焰术士·伊格尼斯', maxHp: 70, moveRange: 2, faction: 'pyro', unitType: 'mage', skills: ['fireball', 'burn', 'heal'], color: '#ff7043' },
  { name: '冰晶守卫·弗罗斯特', maxHp: 85, moveRange: 2, faction: 'cryo', unitType: 'warrior', skills: ['frostbolt', 'freeze', 'heal'], color: '#4fc3f7' },
  { name: '藤蔓德鲁伊·希尔', maxHp: 65, moveRange: 3, faction: 'nature', unitType: 'archer', skills: ['drain', 'meteor', 'burn'], color: '#81c784' },
  { name: '雷霆审判者·托尔', maxHp: 68, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'stun', 'heal'], color: '#29b6f6' },
  { name: '剧毒巫医·摩格', maxHp: 62, moveRange: 2, faction: 'nature', unitType: 'mage', skills: ['poison', 'shadowbolt', 'drain'], color: '#9ccc65' },
  { name: '圣光祭司·塞拉', maxHp: 72, moveRange: 2, faction: 'light', unitType: 'healer', skills: ['heal', 'smite', 'frostbolt'], color: '#ffd54f' },
  { name: '圣堂守卫·加百列', maxHp: 88, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'heal', 'stun'], color: '#ffca28' },
  { name: '曙光射手·奥菲', maxHp: 64, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['lightning', 'smite', 'meteor'], color: '#ffe082' },
  { name: '圣裁官·米迦勒', maxHp: 78, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['meteor', 'smite', 'blind'], color: '#fff176' },
  { name: '炎魔·巴尔', maxHp: 90, moveRange: 2, faction: 'pyro', unitType: 'warrior', skills: ['fireball', 'meteor', 'burn'], color: '#ff1744' },
  { name: '霜怨·艾尔莎', maxHp: 75, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['frostbolt', 'freeze', 'stun'], color: '#80d8ff' },
  { name: '腐化树人·古尔', maxHp: 95, moveRange: 2, faction: 'nature', unitType: 'warrior', skills: ['drain', 'poison', 'shadowbolt'], color: '#69f0ae' },
  { name: '雷暴使·诺瓦', maxHp: 72, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'stun', 'silence'], color: '#40c4ff' },
  // —— 星渊走廊新篇章（第13~15关）新增敌方单位 ——
  { name: '星陨武士·凯恩', maxHp: 78, moveRange: 3, faction: 'pyro', unitType: 'archer', skills: ['fireball', 'burn', 'stun'], color: '#ff8a65' },
  { name: '虚空咏者·莉莉丝', maxHp: 70, moveRange: 2, faction: 'cryo', unitType: 'mage', skills: ['shadowbolt', 'freeze', 'drain'], color: '#b39ddb' },
  { name: '裂隙守望·奥恩', maxHp: 90, moveRange: 2, faction: 'nature', unitType: 'warrior', skills: ['meteor', 'poison', 'heal'], color: '#80cbc4' },
  { name: '黯星射手·伊薇', maxHp: 66, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'silence', 'frostbolt'], color: '#90caf9' },
  // —— 第三部「余烬回响」（第16~18关）新增敌方单位：审判之焰（圣光教会激进派）——
  { name: '审判使·塞拉斯', maxHp: 80, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#fff59d' },
  { name: '燃光祭司·薇拉', maxHp: 68, moveRange: 2, faction: 'light', unitType: 'mage', skills: ['smite', 'meteor', 'heal'], color: '#fff176' },
  { name: '裁决射手·凯尔', maxHp: 66, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['lightning', 'smite', 'poison'], color: '#ffee58' },
  // —— 隐藏章节「蚀教真相」（方向2 内容扩建 · 第四部后传）新增敌方单位：蚀教（禁忌灵脉）——
  { name: '蚀教祭品·莉雯', maxHp: 70, moveRange: 2, faction: 'eclipse', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#ab47bc' },
  { name: '虚蚀骑士·索伦', maxHp: 92, moveRange: 2, faction: 'eclipse', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#8e24aa' },
  { name: '咒缚咏者·弥娅', maxHp: 66, moveRange: 3, faction: 'eclipse', unitType: 'archer', skills: ['silence', 'lightning', 'blind'], color: '#ce93d8' },
  // —— 隐藏章节·第二卷「门彼之侧」（方向2 内容扩建）新增敌方单位：回响（源初灵脉分裂前的回响体）——
  { name: '回响使徒·瑟琳', maxHp: 72, moveRange: 2, faction: 'echo', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#b2ebf2' },
  { name: '回响守楔·卡戎', maxHp: 94, moveRange: 2, faction: 'echo', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#4dd0e1' },
  { name: '回响咏者·莉拉', maxHp: 68, moveRange: 3, faction: 'echo', unitType: 'archer', skills: ['silence', 'lightning', 'blind'], color: '#80deea' },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）新增敌方单位：溯光者（灵脉分裂之前的守忆者）——
  { name: '溯光咏史·琉恩', maxHp: 72, moveRange: 2, faction: 'primordial', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#ffe0b2' },
  { name: '溯光守垣·阿戈', maxHp: 94, moveRange: 2, faction: 'primordial', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#ffcc80' },
  { name: '溯光游隼·薇恩', maxHp: 68, moveRange: 3, faction: 'primordial', unitType: 'archer', skills: ['silence', 'lightning', 'blind'], color: '#ffe082' },
  // —— 外传六/外传七（方向2 内容扩建）新增敌方单位：锈铁佣兵团（无灵脉的凡人武装，靠灵械与弩炮据守商道）——
  { name: '锈铁佣兵队长·加尔', maxHp: 90, moveRange: 2, faction: 'rust', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#bcaaa4' },
  { name: '锈铁弩手·薇拉', maxHp: 66, moveRange: 3, faction: 'rust', unitType: 'archer', skills: ['lightning', 'silence', 'blind'], color: '#a1887f' },
  { name: '锈铁工兵·铎恩', maxHp: 78, moveRange: 2, faction: 'rust', unitType: 'mage', skills: ['meteor', 'poison', 'drain'], color: '#8d6e63' },
  // —— 外传七（方向2 内容扩建）新增敌方单位：灰烬构装体（玄雷塔失控灵械，核心被裂缝之外低语改写）——
  { name: '构装守卫·泰坦', maxHp: 95, moveRange: 2, faction: 'construct', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#90a4ae' },
  { name: '织雷机偶·瑟拉', maxHp: 68, moveRange: 3, faction: 'construct', unitType: 'archer', skills: ['lightning', 'silence', 'blind'], color: '#78909c' },
  { name: '熔心核心·伊格', maxHp: 72, moveRange: 2, faction: 'construct', unitType: 'mage', skills: ['meteor', 'burn', 'drain'], color: '#607d8b' },
  // —— 外传八/外传九（方向2 内容扩建）新增敌方单位：噬尘游民（灵脉危机后游荡于废墟与灰烬之间的拾荒商队，靠倒卖灵械与记忆维生）——
  { name: '沙掠者·卡兹', maxHp: 88, moveRange: 2, faction: 'dust', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#c0a16b' },
  { name: '风语者·希瓦', maxHp: 66, moveRange: 3, faction: 'dust', unitType: 'archer', skills: ['lightning', 'silence', 'blind'], color: '#d7c4a1' },
  { name: '烬卜师·摩恩', maxHp: 72, moveRange: 2, faction: 'dust', unitType: 'mage', skills: ['meteor', 'poison', 'drain'], color: '#a8956e' },
];

const BOSS_UNITS = [
  { name: '大魔导师·马尔佐斯', maxHp: 150, moveRange: 3, faction: 'pyro', isBoss: true, unitType: 'mage', skills: ['meteor', 'fireball', 'poison'], color: '#ff5252' },
  // —— 星渊走廊新篇章（第15关）终局 BOSS ——
  { name: '星渊之喉·厄瑞玻斯', maxHp: 180, moveRange: 3, faction: 'pyro', isBoss: true, unitType: 'mage', skills: ['meteor', 'lightning', 'poison'], color: '#7c4dff' },
  // —— 第三部「余烬回响」（第18关）终局 BOSS：审判之主·奥古斯 ——
  { name: '审判之主·奥古斯', maxHp: 200, moveRange: 3, faction: 'light', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#ffab40' },
  // —— 隐藏章节「蚀教真相」（方向2 内容扩建 · 第四部后传）终局 BOSS：蚀渊之母 ——
  { name: '蚀渊之母·涅莎', maxHp: 210, moveRange: 3, faction: 'eclipse', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#6a1b9a' },
  // —— 隐藏章节·第二卷「门彼之侧」（方向2 内容扩建）终局 BOSS：源初回响（灵脉分裂前、未交还世界的「守护」之半）——
  { name: '源初回响·厄科', maxHp: 230, moveRange: 3, faction: 'echo', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#18ffff' },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）终局 BOSS：溯光之冠（灵脉分裂之前的守忆者之冠 · 涅莎/厄科共同的前身）——
  { name: '溯光之冠·奥拉若', maxHp: 240, moveRange: 3, faction: 'primordial', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#fff9c4' },
];


// ===== data/equipment.js =====
// ============================================================
// Data: Equipment — 装备系统数据
// ============================================================

const EQUIPMENT = {
  pyre_staff:    { name: '烈焰核杖', slot: 'weapon',  dmg: 6,           desc: '炎脉锻造的法杖：所有技能伤害 +6' },
  frost_edge:    { name: '霜锋匕首', slot: 'weapon',  dmg: 4,           desc: '寒霜淬刃的轻匕：技能伤害 +4' },
  aether_amulet: { name: '灵脉护符', slot: 'armor',   hp: 20,           desc: '封存灵能的护符：最大生命 +20' },
  bramble_plate: { name: '荆棘胸甲', slot: 'armor',   hp: 12,           desc: '缠绕荆棘的胸甲：最大生命 +12' },
  sage_tome:     { name: '学者之书', slot: 'trinket', hp: 8,  dmg: 3,   desc: '记载秘法的典籍：生命 +8 / 伤害 +3' },
  storm_pendant: { name: '风暴坠饰', slot: 'trinket', hp: 6,  dmg: 5,   desc: '凝雷的坠饰：伤害 +5 / 生命 +6' },
};


// ===== data/campaign.js =====
// ============================================================
// Data: Campaign — 地图、战役、剧情、多结局
// ============================================================

const MAPS = [
  { id: 'plains',  name: '平原', biome: 'grassland', cover: [], hazard: [] },
  { id: 'forest',  name: '森林', biome: 'forest',
    cover: [{ gx: 3, gy: 1 }, { gx: 3, gy: 3 }, { gx: 4, gy: 5 }, { gx: 4, gy: 6 }], hazard: [] },
  { id: 'snow',    name: '雪山', biome: 'snow',
    cover: [{ gx: 3, gy: 4 }], hazard: [{ gx: 4, gy: 2 }, { gx: 4, gy: 5 }, { gx: 3, gy: 6 }] },
  { id: 'ruins',   name: '废墟', biome: 'ruins',
    cover: [{ gx: 2, gy: 2 }, { gx: 5, gy: 5 }], hazard: [{ gx: 4, gy: 1 }, { gx: 3, gy: 5 }] },
  { id: 'volcano', name: '火山', biome: 'volcano',
    cover: [{ gx: 3, gy: 3 }], hazard: [{ gx: 2, gy: 4 }, { gx: 5, gy: 3 }, { gx: 4, gy: 6 }, { gx: 3, gy: 1 }] },
  { id: 'swamp',   name: '沼泽', biome: 'swamp',
    cover: [{ gx: 2, gy: 5 }, { gx: 5, gy: 2 }], hazard: [{ gx: 3, gy: 2 }, { gx: 4, gy: 4 }, { gx: 3, gy: 5 }] },
  { id: 'cave',    name: '洞穴', biome: 'ruins',
    cover: [{ gx: 3, gy: 1 }, { gx: 6, gy: 4 }, { gx: 7, gy: 6 }], hazard: [{ gx: 4, gy: 3 }, { gx: 5, gy: 7 }, { gx: 8, gy: 2 }] },
  { id: 'desert',  name: '荒漠', biome: 'grassland',
    cover: [], hazard: [{ gx: 3, gy: 2 }, { gx: 5, gy: 4 }, { gx: 7, gy: 6 }, { gx: 4, gy: 8 }, { gx: 8, gy: 3 }] },
  { id: 'temple',  name: '神庙', biome: 'ruins',
    cover: [{ gx: 4, gy: 2 }, { gx: 6, gy: 6 }, { gx: 2, gy: 5 }, { gx: 7, gy: 3 }], hazard: [{ gx: 5, gy: 4 }, { gx: 4, gy: 7 }] },
  { id: 'coast',   name: '海岸', biome: 'snow',
    cover: [{ gx: 2, gy: 1 }, { gx: 7, gy: 4 }], hazard: [{ gx: 8, gy: 1 }, { gx: 8, gy: 3 }, { gx: 8, gy: 5 }, { gx: 8, gy: 7 }] },
  { id: 'crystal', name: '水晶矿', biome: 'volcano',
    cover: [{ gx: 3, gy: 3 }, { gx: 6, gy: 6 }], hazard: [{ gx: 5, gy: 1 }, { gx: 4, gy: 5 }, { gx: 7, gy: 8 }] },
  { id: 'abyss',   name: '深渊裂隙', biome: 'volcano',
    cover: [{ gx: 4, gy: 6 }], hazard: [{ gx: 5, gy: 3 }, { gx: 3, gy: 5 }, { gx: 6, gy: 7 }, { gx: 4, gy: 2 }, { gx: 7, gy: 5 }] },
  // —— 星渊走廊新篇章（第13~15关）新增地图 ——
  { id: 'starfall', name: '星陨平原', biome: 'grassland',
    cover: [{ gx: 3, gy: 2 }, { gx: 6, gy: 6 }], hazard: [{ gx: 4, gy: 4 }, { gx: 5, gy: 7 }, { gx: 3, gy: 8 }] },
  { id: 'corridor', name: '星渊走廊', biome: 'ruins',
    cover: [{ gx: 2, gy: 3 }, { gx: 7, gy: 5 }], hazard: [{ gx: 4, gy: 4 }, { gx: 5, gy: 3 }, { gx: 6, gy: 7 }, { gx: 3, gy: 6 }] },
  { id: 'abyssgate', name: '星渊之喉', biome: 'volcano',
    cover: [{ gx: 4, gy: 4 }], hazard: [{ gx: 3, gy: 3 }, { gx: 5, gy: 5 }, { gx: 6, gy: 6 }, { gx: 2, gy: 7 }, { gx: 7, gy: 2 }] },
  // —— 第三部「余烬回响」（第16~18关）新增地图 ——
  { id: 'embers', name: '余烬祭坛', biome: 'volcano',
    cover: [{ gx: 4, gy: 3 }, { gx: 7, gy: 6 }], hazard: [{ gx: 3, gy: 4 }, { gx: 5, gy: 6 }, { gx: 8, gy: 3 }, { gx: 6, gy: 8 }] },
  { id: 'sanctum', name: '圣辉圣殿', biome: 'ruins',
    cover: [{ gx: 3, gy: 2 }, { gx: 6, gy: 5 }, { gx: 8, gy: 3 }], hazard: [{ gx: 5, gy: 4 }, { gx: 4, gy: 7 }] },
  { id: 'nexus', name: '灵脉枢机', biome: 'volcano',
    cover: [{ gx: 5, gy: 5 }], hazard: [{ gx: 4, gy: 3 }, { gx: 6, gy: 3 }, { gx: 3, gy: 6 }, { gx: 7, gy: 6 }, { gx: 5, gy: 8 }] },
  // —— 隐藏章节「蚀教真相」（第四部后传）新增地图 ——
  { id: 'eclipse_altar', name: '蚀教祭坛', biome: 'volcano',
    cover: [{ gx: 4, gy: 4 }, { gx: 7, gy: 6 }], hazard: [{ gx: 3, gy: 3 }, { gx: 5, gy: 5 }, { gx: 6, gy: 7 }, { gx: 2, gy: 8 }, { gx: 8, gy: 2 }] },
  { id: 'void_cocoon', name: '虚空虫茧', biome: 'ruins',
    cover: [{ gx: 3, gy: 2 }, { gx: 6, gy: 5 }, { gx: 8, gy: 3 }], hazard: [{ gx: 5, gy: 4 }, { gx: 4, gy: 7 }, { gx: 7, gy: 6 }] },
  { id: 'truth_abyss', name: '真相之渊', biome: 'grass_land',
    cover: [{ gx: 5, gy: 5 }], hazard: [{ gx: 4, gy: 3 }, { gx: 6, gy: 3 }, { gx: 3, gy: 6 }, { gx: 7, gy: 6 }, { gx: 5, gy: 8 }, { gx: 2, gy: 5 }] },
  // —— 隐藏章节·第二卷「门彼之侧」（方向2 内容扩建 · 裂缝之外的最后一页）新增地图 ——
  { id: 'gate_hall', name: '门扉前厅', biome: 'ruins',
    cover: [{ gx: 3, gy: 2 }, { gx: 7, gy: 5 }], hazard: [{ gx: 5, gy: 4 }, { gx: 4, gy: 7 }, { gx: 8, gy: 2 }] },
  { id: 'echo_abyss', name: '回响之渊', biome: 'volcano',
    cover: [{ gx: 5, gy: 5 }], hazard: [{ gx: 4, gy: 3 }, { gx: 6, gy: 3 }, { gx: 3, gy: 6 }, { gx: 7, gy: 6 }, { gx: 5, gy: 8 }, { gx: 2, gy: 5 }] },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）新增地图：溯光者守忆的庭院与初晓之原 ——
  { id: 'primordial_court', name: '源初之庭', biome: 'ruins',
    cover: [{ gx: 3, gy: 2 }, { gx: 7, gy: 5 }, { gx: 5, gy: 6 }], hazard: [{ gx: 4, gy: 4 }, { gx: 6, gy: 3 }, { gx: 2, gy: 7 }] },
  { id: 'aether_tide', name: '灵能之潮', biome: 'volcano',
    cover: [{ gx: 4, gy: 3 }, { gx: 8, gy: 6 }], hazard: [{ gx: 3, gy: 4 }, { gx: 5, gy: 5 }, { gx: 6, gy: 7 }, { gx: 2, gy: 8 }, { gx: 7, gy: 2 }, { gx: 4, gy: 8 }] },
  { id: 'first_dawn', name: '初晓之原', biome: 'grassland',
    cover: [{ gx: 3, gy: 2 }, { gx: 6, gy: 6 }], hazard: [{ gx: 5, gy: 4 }, { gx: 4, gy: 7 }, { gx: 7, gy: 5 }] },
  // —— 外传六/外传七（方向2 内容扩建）新增地图 ——
  { id: 'rust_road', name: '锈铁商道', biome: 'snow',
    cover: [{ gx: 3, gy: 2 }, { gx: 6, gy: 5 }, { gx: 8, gy: 3 }], hazard: [{ gx: 4, gy: 4 }, { gx: 5, gy: 3 }, { gx: 7, gy: 6 }, { gx: 2, gy: 7 }] },
  { id: 'stardust_obs', name: '星尘观测台', biome: 'ruins',
    cover: [{ gx: 4, gy: 2 }, { gx: 6, gy: 6 }, { gx: 2, gy: 5 }], hazard: [{ gx: 5, gy: 4 }, { gx: 3, gy: 7 }, { gx: 7, gy: 3 }, { gx: 4, gy: 8 }] },
  // —— 外传八/外传九（方向2 内容扩建）新增地图：噬尘游民盘踞的灰烬集市与潮汐圣龛 ——
  { id: 'ash_market', name: '灰烬集市', biome: 'volcano',
    cover: [{ gx: 3, gy: 2 }, { gx: 7, gy: 5 }, { gx: 5, gy: 6 }], hazard: [{ gx: 4, gy: 4 }, { gx: 6, gy: 3 }, { gx: 2, gy: 7 }, { gx: 8, gy: 2 }] },
  { id: 'tide_shrine', name: '潮汐圣龛', biome: 'ruins',
    cover: [{ gx: 4, gy: 2 }, { gx: 6, gy: 6 }, { gx: 2, gy: 5 }], hazard: [{ gx: 5, gy: 4 }, { gx: 3, gy: 7 }, { gx: 7, gy: 3 }, { gx: 8, gy: 6 }] },
  // —— 方向5 地图系统升级 · 首张 tiles 地形矩阵重设计地图（证明地形系统落地）——
  // 河道哨探：中央纵向水域(col5/6)分割战场，仅 row4 一座门户(D)桥可通行 → 强制走位路径依赖；
  // 树林(T)提供掩体且移动消耗2、高地(H)站之攻击+20%、沼泽(M)每回合-4HP且消耗3。
  { id: 'river_plain', name: '河道哨探', biome: 'grassland',
    tiles: [
      '.....AA.....',
      '..T..AA..T..',
      '...MHAA.....',
      '.....AA.....',
      '.P...DD...E.',
      '.....AA.....',
      '..T..AA..T..',
      '....MAAH....',
      '.....AA.....',
      '.....AA.....',
    ] },
];

const CAMPAIGN = [
  { level: 1, name: '第一关 · 平原哨探', map: 0, enemies: [{ src: 'enemy', i: 0 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 2 }, { src: 'enemy', i: 3 }, { src: 'enemy', i: 4 }] },
  { level: 2, name: '第二关 · 林间伏击', map: 1, enemies: [{ src: 'enemy', i: 3 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 6 }, { src: 'enemy', i: 2 }, { src: 'enemy', i: 5 }] },
  { level: 3, name: '第三关 · 雪原围困', map: 2, enemies: [{ src: 'enemy', i: 4 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 7 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 5 }] },
  { level: 4, name: '第四关 · 废墟争夺', map: 3, enemies: [{ src: 'enemy', i: 2 }, { src: 'enemy', i: 5 }, { src: 'enemy', i: 6 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 8 }] },
  { level: 5, name: '第五关 · 熔岩险境', map: 4, enemies: [{ src: 'enemy', i: 3 }, { src: 'enemy', i: 4 }, { src: 'enemy', i: 7 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 11 }] },
  { level: 6, name: '第六关 · 大魔导师决战 (BOSS)', map: 5, boss: true, enemies: [{ src: 'enemy', i: 1 }, { src: 'enemy', i: 2 }, { src: 'boss', i: 0 }, { src: 'enemy', i: 10 }, { src: 'enemy', i: 4 }] },
  { level: 7, name: '第七关 · 暗流涌动', map: 6, enemies: [{ src: 'enemy', i: 12 }, { src: 'enemy', i: 5 }, { src: 'enemy', i: 7 }, { src: 'enemy', i: 11 }, { src: 'enemy', i: 13 }] },
  { level: 8, name: '第八关 · 荒漠围城', map: 7, enemies: [{ src: 'enemy', i: 3 }, { src: 'enemy', i: 13 }, { src: 'enemy', i: 6 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 14 }] },
  { level: 9, name: '第九关 · 神庙守护者', map: 8, enemies: [{ src: 'enemy', i: 14 }, { src: 'enemy', i: 4 }, { src: 'enemy', i: 8 }, { src: 'enemy', i: 15 }, { src: 'enemy', i: 9 }] },
  { level: 10, name: '第十关 · 海岸阻击', map: 9, enemies: [{ src: 'enemy', i: 1 }, { src: 'enemy', i: 12 }, { src: 'enemy', i: 9 }, { src: 'enemy', i: 13 }, { src: 'enemy', i: 5 }] },
  { level: 11, name: '第十一关 · 水晶矿场争夺', map: 10, enemies: [{ src: 'enemy', i: 14 }, { src: 'enemy', i: 15 }, { src: 'enemy', i: 2 }, { src: 'enemy', i: 5 }, { src: 'enemy', i: 8 }] },
  { level: 12, name: '第十二关 · 深渊裂口 (BOSS)', map: 11, boss: true, enemies: [{ src: 'enemy', i: 12 }, { src: 'enemy', i: 13 }, { src: 'enemy', i: 14 }, { src: 'boss', i: 0 }, { src: 'enemy', i: 2 }] },
  // —— 星渊走廊新篇章（第二部 · 裂缝之外）——
  { level: 13, name: '第十三关 · 星陨平原', map: 12, enemies: [{ src: 'enemy', i: 16 }, { src: 'enemy', i: 17 }, { src: 'enemy', i: 18 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 3 }] },
  { level: 14, name: '第十四关 · 星渊走廊', map: 13, enemies: [{ src: 'enemy', i: 18 }, { src: 'enemy', i: 19 }, { src: 'enemy', i: 16 }, { src: 'enemy', i: 17 }, { src: 'enemy', i: 4 }] },
  { level: 15, name: '第十五关 · 星渊之喉 (BOSS)', map: 14, boss: true, enemies: [{ src: 'enemy', i: 19 }, { src: 'enemy', i: 16 }, { src: 'boss', i: 1 }, { src: 'enemy', i: 17 }, { src: 'enemy', i: 18 }] },
  // —— 第三部「余烬回响」（裂缝之外的余烬 · 审判之焰崛起）——
  { level: 16, name: '第十六关 · 余烬祭坛', map: 15, enemies: [{ src: 'enemy', i: 20 }, { src: 'enemy', i: 21 }, { src: 'enemy', i: 22 }, { src: 'enemy', i: 8 }, { src: 'enemy', i: 11 }] },
  { level: 17, name: '第十七关 · 圣辉圣殿', map: 16, enemies: [{ src: 'enemy', i: 21 }, { src: 'enemy', i: 22 }, { src: 'enemy', i: 20 }, { src: 'enemy', i: 9 }, { src: 'enemy', i: 12 }] },
  { level: 18, name: '第十八关 · 灵脉枢机 (BOSS)', map: 17, boss: true, enemies: [{ src: 'enemy', i: 20 }, { src: 'enemy', i: 21 }, { src: 'enemy', i: 22 }, { src: 'boss', i: 2 }, { src: 'enemy', i: 10 }] },
];

const CHAPTER_STORY = {
  1: {
    opening: '你离开偏僻的边陲村落，沿着枯黄的草甸走向大陆腹地。风里夹着细碎的灵尘——那是灵脉正在悄然衰退的征兆。忽然，三名流浪术士拦住去路，他们眼神空洞，灵能已被某种力量扭曲。',
    closing: '哨探被击退，你却注意到他们临终前都念着同一串陌生咒文。灵脉枯萎或许并非天灾，而是有人在幕后推动。你必须尽快弄清真相。',
  },
  2: {
    opening: '林海的雾气浸着寒意。凛霜堡的巡哨将你误认作敌对学派的探子，裹着霜花的箭矢破空而来。你被迫在树影间且战且退，第一次真切感到学派之间的敌意。',
    closing: '你甩开追兵，却在营地残烬里翻到一封密信：各学派都在互相指责对方窃取灵脉。猜忌像瘟疫般蔓延，而真正的危机，正藏在所有人视线之外。',
  },
  3: {
    opening: '凛霜堡的冰墙在眼前拔地而起。你被守军困于雪原一角，寒风几乎冻结灵能。远处，一道幽蓝的裂隙正缓缓吞噬大地的灵脉——枯萎比你想象的更近。',
    closing: '你杀出重围，裂隙却在你身后合拢。灵脉枯萎的速度远超预期；若再拖下去，整片大陆的魔法都将被熄灭。时间，成了最残酷的敌人。',
  },
  4: {
    opening: '荒废的古都只剩断柱与藤蔓。翠息林的守护者据守着最后一缕「灵脉残脉」，不愿让任何人染指。你与他们在废墟间交锋，脚下是千年文明的遗骸。',
    closing: '残脉被你护下，但暗处一双眼睛始终未曾离开——那是「蚀教」的使者。他们渴望借枯萎之力重塑世界，而残脉，只是其棋盘上的一枚棋子。',
  },
  5: {
    opening: '炽焰庭的先锋在熔岩裂谷列阵，烈焰映红半边天。裂隙在此最为狂暴，每一步都踩在崩塌边缘。蚀教的低语，第一次清晰地钻进你的脑海。',
    closing: '你越过火海，也终于看清：蚀教的首领，竟是当年失踪的大魔导师。他要亲手掐灭灵脉，再以枯萎为燃料，点燃属于他的「新纪元」。终局，就在前方。',
  },
  6: {
    opening: '灵脉之源的穹顶下，大魔导师·马尔佐斯悬于枯萎的核心。他微笑着向你伸出手：「加入我，让无序的灵能归于唯一意志。」身后，被扭曲的术士大军静候号令。这是最后一战。',
    ending: '马尔佐斯崩解为星尘，枯萎的潮水随他一同退去。你站在一片寂静的灵脉之源中，第一次听见大陆平稳的呼吸。灵脉是否重燃、世界走向何方——这个选择，从此握在你的手里。\n\n（战役通关 · 感谢游玩）',
  },
  7: {
    opening: '你本以为击败马尔佐斯便终结了一切。然而枯萎并未退散——蚀教的余党在暗处重整旗鼓，将裂隙碎片嵌入活人体内，制造出更扭曲的战争兵器。佣兵回报：一座废弃矿坑深处，异样的红光彻夜不息。',
    closing: '你在矿坑深处击溃了炎魔·巴尔，却发现它只是一具被「裂隙碎片」驱动的空壳。真正的操控者尚未现身。每块碎片中都封存着一段破碎的记忆——碎片越多，越接近蚀教真正的目标。',
  },
  8: {
    opening: '追踪裂隙碎片的线索将你引入一片无尽的荒漠。热浪扭曲了视线，废墟中升起三道烟柱——残余学派联军的求救信号。他们正在被一支由「霜怨·艾尔莎」统领的冰霜部队围剿。你必须在联军覆灭前突破包围。',
    closing: '你击退了霜怨部队，救下幸存的学派学者。他们向你透露了一个惊人的信息：蚀教的教宗并非马尔佐斯，而是一个更古老的存在——「虚无编织者」。马尔佐斯只是其最得意的门徒。',
  },
  9: {
    opening: '学者指引你前往一座被遗忘的远古神庙——那里葬着第一位与「虚无编织者」交战的上古灵能者的遗骨。神庙的守护者既非活人也非亡灵，而是被某种禁忌契约束缚的灵体。他们视一切外来者为亵渎者。',
    closing: '你在神庙深处找到了上古灵能者的遗物——一颗「灵脉源石」。它能感应残存碎片的方位。遗骨的碑文刻着最后的警告：「编织者将借碎片之门重返现世。必须在十二道裂隙全部合拢之前将其阻断。」',
  },
  10: {
    opening: '灵脉源石的光芒指向北方海岸。那里，蚀教的舰队正在搭建一座巨型灵脉裂隙塔——他们要强行撕开维度之间的屏障，让「虚无编织者」的本体降临。冰冷的海风混杂着灵能放电的焦臭味，决战在即。',
    closing: '你摧毁了裂隙塔，但巨大的灵能冲击将你和同伴震散。孤立无援地站在被灵能风暴染成紫色的海滩上，你望见天穹中浮现出一道蜿蜒的裂隙——那不再是大陆上的裂缝，而是天幕本身的裂痕。',
  },
  11: {
    opening: '天裂之后，大陆陷入前所未有的混乱。灵脉能量像瀑布般从天裂倾泻而下，将土地结晶化——一片水晶矿场在数日间形成。蚀教的残余部队占据了矿场，试图用那些晶簇搭建传送门。每一秒，编织者的力量都在增强。',
    closing: '你在晶簇丛生的战场上夺回了矿场。但每一块水晶都在低语——那是虚无编织者的意志在试探你的心灵。你强迫自己关闭感知，却发现一瓣水晶碎片已嵌入你的掌心，与你的灵脉产生共鸣。',
  },
  12: {
    opening: '嵌入掌心的碎片成了你与虚无编织者之间的纽带。你看见它——一个由纯粹虚无编织而成的存在，漂浮在维度裂缝之间，正缓缓将手指伸向你们的世界。蚀教的最终仪式已在深渊裂口开始，一旦完成，整个维尔德兰都将被编织者的虚无吞没。这是真正的最后一战。',
    closing: '当虚无编织者的形体在你的最后一击中崩解，天裂缓缓合拢。破碎的晶簇化为光点升上天空，像一场倒放的流星雨。\n\n灵脉恢复了，大陆获得了新生。可你掌心的碎片仍在低语——在所有裂缝之外，仍有东西在注视。那些光点，终会在某一天重新坠落。\n\n（第一部 · 终章落幕）',
  },
  // —— 星渊走廊新篇章（第二部 · 裂缝之外）——
  13: {
    opening: '天裂中坠落的「星陨」并未随编织者一同消散，反而在维尔德兰各处催生出被灵脉碎片寄生的新敌人——星陨武士与虚空咏者。你循着光点拖出的轨迹，深入地图上从未标注过的「星渊走廊」。越是向前，掌心的碎片便越是滚烫。',
    closing: '你击溃了首批星陨军团，却从一名垂死的星陨武士口中拼出真相：星渊的「喉」正在苏醒——那才是编织者曾经的主人，也是灵脉枯萎最深处那道裂缝本身。走廊尽头，光点汇聚成一道门。',
  },
  14: {
    opening: '星渊走廊的尽头，裂隙守望者·奥恩统领的守军据守着通往「星渊之喉」的最后屏障。晶簇在每面墙上低语着同一个名字，像一首循环的安魂曲。你必须在屏障崩塌前，撕开一条通往喉部的路。',
    closing: '屏障破碎，星渊之喉·厄瑞玻斯在你面前缓缓展开——万千光点从它体内坠落又回归。它既是编织者的源头，也是灵脉枯萎本身。掌心的碎片与你同时震颤：你们，本就同源。',
  },
  15: {
    opening: '星渊之喉·厄瑞玻斯悬于星渊正中，身躯由坠落的光点与扭曲的灵脉交织而成。它低语：「你掌心的碎片，本就是我失落的一部分。归还它，或成为它——你早已没有第三条路。」真正的终局，于此刻降临。',
    closing: '当星渊之喉在最后一击中崩解，坠落的光点尽数归于你掌心的碎片，化作一粒温润的微光。你终于明白：灵脉从不需要被「拯救」，它只需要有人在裂缝之外，依然选择共生。\n\n（第二部 · 终章落幕）\n\n然而掌心的碎片仍在低语——在所有裂缝之外，仍有东西在注视。余烬未熄，回响已起。',
  },
  // —— 第三部「余烬回响」（裂缝之外的余烬 · 审判之焰崛起）——
  16: {
    opening: '星渊之喉崩解后，权力的真空被一股更炽烈的信仰填满。圣光教会中激进的「审判之焰」派系举起净化之焰，宣称唯有焚尽一切「未归顺者」（他们称其为「余烬」），才能在灵脉重燃前让世界归于澄澈。你循着被焚毁村落的焦痕，踏入第一座余烬祭坛。',
    closing: '祭坛在烈焰中坍缩，你却从祭坛底层翻出一卷《净化敕令》——它揭示审判之焰的真正目标并非「净化」，而是借焚毁各族灵脉，将全部灵脉之力收归教廷一人之手。牵头者，正是失踪已久的圣堂前任枢机·奥古斯。',
  },
  17: {
    opening: '线索指向圣光教会的心脏——圣辉圣殿。奥古斯已在此自立为「审判之主」，以圣焰为锁链捆住不肯臣服的学派信众。殿外的浮雕记载着第三部真正的序曲：当世界失去共同的敌人，曾并肩的盟友，便会彼此举起火把。',
    closing: '你击溃了圣殿守军，奥古斯却已退入最深处——灵脉枢机。他留下的最后一句回响是：「你们以为打赢了星渊，便打赢了人心？人心里的火，比我手中的更烫。」',
  },
  18: {
    opening: '灵脉枢机悬浮于灵脉之源的正上方，万千光脉在此被拧成一根指向苍穹的「枢轴」。审判之主·奥古斯立于枢轴之巅，周身缠绕着被强行收束的各族灵脉。他张开双臂：「来吧，与我一同，把这片反复争吵的大陆，烧成一道整齐的光。」第三部，亦是整场旅程的终局，于此刻降临。',
    closing: '当审判之主在最后一击中溃散，被他收束的灵脉如星河倒泻、重归各族大地。你掌心的碎片忽然轻了——它终于不再低语「注视」，而是学会了「共生」。维尔德兰的未来，交还给每一个仍愿意抬头看光的人。\n\n（第三部 · 余烬回响 · 终幕）',
  },
};

const CAMPAIGN_CHOICES = {
  3: {
    title: '雪原岔路 · 抉择',
    prompt: '你救下一名被俘的灵脉学者，他从怀中掏出半卷《灵脉残谱》——记载着暂缓枯萎的古法，也标注了一处「可夺取」的敌方灵脉核心。\n\n是护送他前往安全的翠息林，还是夺下核心、以力量逼停战争？',
    options: [
      { id: 'guard', label: '🛡 护送学者（守护之路）', delta: 1 },
      { id: 'seize', label: '⚔ 夺取核心（力量之路）', delta: -1 },
    ],
  },
  5: {
    title: '熔岩尽头 · 抉择',
    prompt: '大魔导师·马尔佐斯的身影在裂隙中若隐若现。他留下两句话：「灵脉已无可挽回，你若不愿随我熄灭，便只剩两条路。」\n\n是拼尽余力修复灵脉、与大陆同呼吸；还是接管枯萎、以唯一意志重塑秩序？',
    options: [
      { id: 'mend', label: '🌿 修复灵脉（守护之路）', delta: 1 },
      { id: 'rule', label: '👑 接管秩序（力量之路）', delta: -1 },
    ],
  },
};

const ENDINGS = {
  guardian: {
    title: '守护者结局 · 灵脉复苏',
    text: '你选择修补而非占有。最后一缕灵脉在你掌心重新跳动，枯萎如退潮般从大陆撤回，焦土抽出新芽、冰墙重凝霜花。\n\n你没有成为新的主人，只做了灵脉的「摆渡人」。学者们循着你的足迹重建学派，猜忌被共同的劳作磨平。维尔德兰不会忘记这场危机，却也因你，记住了「共生」二字的重量。',
  },
  conqueror: {
    title: '征服者结局 · 新纪元',
    text: '你伸手接过了枯萎。以唯一意志统御的灵脉不再失控，却也不再属于任何人——它成了你手中的「秩序」。\n\n学派战争止息，因为再无人敢违背你的意志；大陆安稳，却安静得像一座被擦拭干净的囚笼。有人称你为救世主，有人在你转身时低声诅咒。你不在乎：至少，火不再无故熄灭。',
  },
  balance: {
    title: '均衡结局 · 裂土而治',
    text: '你既未彻底修补、也未彻底接管，而是在灵脉与意志之间留下一道缝隙。\n\n枯萎被遏制却未根除，各学派各执一脉、互不统属，维尔德兰进入脆弱的均势。没有救世主，也没有暴君——只有一片学会与残缺共存的大陆。和平来得很勉强，但至少是和平。',
  },
};

// 外传章节（Side Stories · 方向2 内容扩建）：独立于主线战役的自成一段战斗，
// 复用既有的「歼灭全部敌人」胜利条件（不触碰方向1 冻结的引擎胜负逻辑），
// 每篇皆为原创叙事，胜利后展示专属尾声，并持久化通关进度。
const SIDE_STORIES = [
  {
    id: 'frostfire',
    title: '外传一 · 霜火残章',
    map: 2,
    enemies: [{ src: 'enemy', i: 4 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 7 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 3 }],
    opening: '战败的霜怨残部并未随艾尔莎一同消散。一支被裂隙碎片唤醒的「霜火双生」小队在雪原深处筑起冰狱，以冻结的灵脉为祭，妄图复活被你击溃的霜怨。你循着灵脉残脉的微光，踏入了这片再无生者的雪白坟场。',
    closing: '霜火双生尽数崩解，冰狱随之消融。你在祭坛底层翻到一卷《霜火残章》——它记载着霜怨·艾尔莎并不全然自愿成为蚀教傀儡。或许在这片枯萎的土地上，没有谁生来便是恶人，只有被裂隙扭曲的灵能。',
  },
  {
    id: 'dune_relic',
    title: '外传二 · 沙海遗珍',
    map: 7,
    enemies: [{ src: 'enemy', i: 3 }, { src: 'enemy', i: 13 }, { src: 'enemy', i: 6 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 14 }],
    opening: '流言说，荒漠之下埋着第一纪元遗落的「灵脉源匣」——能自主孕育灵脉的圣物，却也被蚀教视为唤醒编织者的最后钥匙。一支由叛逃学者与破碎傀儡混编的队伍已先你一步掘入沙海，誓要夺取它。',
    closing: '你抢在对方之前取走源匣，却未按传说将其献给任何一方。你将它深埋回沙海，只取走其中一枚尚在跳动的灵脉种子。有些力量，本就不该被任何人独自握在掌心。',
  },
  {
    id: 'temple_echo',
    title: '外传三 · 神庙回声',
    map: 8,
    enemies: [{ src: 'enemy', i: 14 }, { src: 'enemy', i: 4 }, { src: 'enemy', i: 8 }, { src: 'enemy', i: 15 }, { src: 'enemy', i: 9 }],
    opening: '上古灵能者的遗骨虽已安息，神庙却仍在不眠地低语。一群狂热的「虚无信徒」闯入禁地，试图以活祭撬开灵体守护者的封印，窃取碑文中记载的「编织者真名」。若真名泄露，裂隙之门将再无阻挡。',
    closing: '你击退信徒，守护者却已因封印松动而濒散。它将碑文最后一行托付于你——那不是真名，而是一句古老的共生咒文。你默念它，封印重新合拢。有些门，永远不该被推开。',
  },
  {
    id: 'starfall_echo',
    title: '外传四 · 星陨残响',
    map: 12,
    enemies: [{ src: 'enemy', i: 16 }, { src: 'enemy', i: 17 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 3 }, { src: 'enemy', i: 5 }],
    opening: '天裂之后坠落的星屑并未全部沉寂。星渊走廊之外，一小队「星陨武士」在星陨平原上筑起祭坛，企图以坠落之光重燃早已熄灭的学派灵脉——却不知那光中仍残留着星渊之喉的意志。你踏过焦土，决意在其被彻底唤醒前，将这缕回响掐灭于摇篮。',
    closing: '祭坛崩塌，残留的星屑落入你掌心，竟与掌心的碎片短暂共鸣——它低语着一个比虚无编织者更古老的名字。你第一次意识到：星渊之喉，或许也只是某个更庞大存在的「喉」。裂缝之外，仍有裂缝。',
  },
  {
    id: 'corridor_echo',
    title: '外传五 · 走廊回音',
    map: 13,
    enemies: [{ src: 'enemy', i: 18 }, { src: 'enemy', i: 19 }, { src: 'enemy', i: 12 }, { src: 'enemy', i: 13 }, { src: 'enemy', i: 11 }],
    opening: '星渊走廊的封印虽已被你破开，却仍有不甘的守军游荡其间。裂隙守望者·奥恩的残部以走廊为巢，绑架沿途的学派信使，逼问星渊之喉「复活」之法。若让他们找到答案，刚合拢的天裂将再度裂开。你循着信使的求救灵火，重返那条歌哭般的走廊。',
    closing: '残部溃散，被掳的信使获救。他们交给你一卷以星屑写就的「走廊回音」——记载着星渊之喉第一次苏醒前，曾与人类灵能者立下的契约。你尚未读懂契约内容，只看见末尾一句：「凡掌碎片者，皆为守门人，亦皆为囚徒。」',
  },
  // —— 外传六 · 锈铁商道（方向2 内容扩建）——
  // 全新凡人阵营「锈铁佣兵团」登场：无灵脉、靠缴获灵械与弩炮据守商道，是被裂缝之外逼出的「铁壁」威胁。
  // 复用既有「歼灭全部敌人」胜利条件（零方向1 引擎改动、balance-safe），原创叙事 + 新增地图。
  {
    id: 'rust_road',
    title: '外传六 · 锈铁商道',
    map: 26,
    enemies: [{ src: 'enemy', i: 32 }, { src: 'enemy', i: 33 }, { src: 'enemy', i: 34 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 1 }],
    opening: '天裂合拢后，散落的灵脉碎片被各路人马哄抢。一支毫无灵能的「锈铁佣兵团」却靠缴获的灵械与弩炮，在边陲商道上筑起关卡，向过往旅人强征「过路灵税」。他们不信灵脉、只信铁与金——这帮凡人武装，成了裂缝之外最讽刺的威胁：当魔法退潮，握剑的手反而最硬。你循着被劫商队遗落的灵火，踏入了这条锈迹斑斑的峡谷商道。',
    closing: '锈铁佣兵队长·加尔倒下时，从怀里摸出一枚褪色的商道徽记——他本是这条路上的脚夫，商道荒废后才握起了枪。你没收了他们抢来的灵脉碎片，却把徽记轻轻放回他手边。有些墙是铁砌的，有些墙是人心砌的；铁墙塌了，人心的墙未必就倒。商道重新通车那日，你听见远处又有锈铁碰撞的声响——也许，这群凡人还没学会放下枪。',
  },
  // —— 外传七 · 星尘观测台（方向2 内容扩建）——
  // 全新失控灵械阵营「灰烬构装体」登场：玄雷塔观测灵脉的造物被裂缝之外低语改写核心，转而抽空山域灵脉。
  // 复用既有「歼灭全部敌人」胜利条件（零方向1 引擎改动、balance-safe），原创叙事 + 新增地图。
  {
    id: 'stardust_obs',
    title: '外传七 · 星尘观测台',
    map: 27,
    enemies: [{ src: 'enemy', i: 35 }, { src: 'enemy', i: 36 }, { src: 'enemy', i: 37 }, { src: 'enemy', i: 12 }, { src: 'enemy', i: 15 }],
    opening: '玄雷塔的造物「灰烬构装体」本是用来观测灵脉、预警枯萎的灵械。可当观测台接收到的星光里混入了裂缝之外的低语，构装体的核心被悄然改写——它们不再预警，转而「采集」一切经过的灵脉，献给某个不存在的「主人」。织雷机偶·瑟拉带着失控的构装守卫封锁了山巅观测台，把守塔的学者困在齿轮之间。若让构装体把整片山域的灵脉抽空，下一次枯萎将无人知晓。你循着紊乱的雷频，攀上了这座沉默的观测台。',
    closing: '熔心核心·伊格崩解时，观测台穹顶的星图重新亮起——原来它一直在记录裂缝之外的低语，只是被构装体误读成了「指令」。你把星图抄录下来，第一次看清：那些低语不是命令，而是一声跨越裂缝的、疲惫的问询。玄雷塔的学者们重掌观测台，将星图列为最高机密。你转身下山时想：或许最危险的敌人，从来不是握枪的凡人，而是被一句谎绊住、忘了自己原本在守护什么的造物。',
  },
  // —— 外传八 · 灰烬集市（方向2 内容扩建）——
  // 全新游民阵营「噬尘游民」登场：灵脉危机后游荡于废墟与灰烬之间的拾荒商队，靠倒卖灵械与记忆维生。
  // 复用既有「歼灭全部敌人」胜利条件（零方向1 引擎改动、balance-safe），原创叙事 + 新增地图。
  {
    id: 'ash_market',
    title: '外传八 · 灰烬集市',
    map: 28,
    enemies: [{ src: 'enemy', i: 38 }, { src: 'enemy', i: 39 }, { src: 'enemy', i: 40 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 1 }],
    opening: '天裂合拢后，散落的灵脉碎片在黑市上被炒到天价。一支自称「噬尘游民」的拾荒商队赶着灵兽车，在废墟间的灰烬集市摆开了摊——他们不拜任何学派，只信「能换钱的就是真灵脉」。今日压轴的拍品，竟是一枚仍在跳动的「灵脉之种」，据说是某位陨落强者的最后一点本源。若让它落入最高出价者手中，无人知道会被酿成第几场灾。你循着被克扣的灵火，踏入了这座终年落灰的集市。',
    closing: '沙掠者·卡兹倒下时，从怀中抖落一叠写满名字的「欠条」——那是他替每一位卖掉的记忆，向原主记下的债。你没收了灵脉之种，却把欠条一张张念给风里的亡灵听。有些交易从一开始就该作废；有些记忆，本就不该被标价。集市散去那日，你听见远处沙丘后又响起拨浪鼓的声响——也许，这群游民还没学会把人放下。',
  },
  // —— 外传九 · 潮汐圣龛（方向2 内容扩建）——
  // 噬尘游民把劫来的「潮之鳞」碎片供在远古潮汐圣龛，妄图以记忆之潮唤回某个早已逝去的「商队之母」。
  {
    id: 'tide_shrine',
    title: '外传九 · 潮汐圣龛',
    map: 29,
    enemies: [{ src: 'enemy', i: 38 }, { src: 'enemy', i: 39 }, { src: 'enemy', i: 40 }, { src: 'enemy', i: 12 }, { src: 'enemy', i: 15 }],
    opening: '灰烬集市一役后，你循着被夺灵脉之种的余温，追到一座半沉于沙海的古祭坛——噬尘游民称它为「潮汐圣龛」。他们把劫来的「潮之鳞」碎片供在坛心，妄图以记忆之潮唤回某个早已逝去的「商队之母」，让这支再无归处的游民重新有了一个「家」。烬卜师·摩恩立于潮水前，低声念着无人听懂的咒：「只要她回来，我们就不再漂泊。」若让潮水漫过整片沙海，所有被吞没的记忆都将化为游民的执念，再难平息。你踏碎沙浪，走向那座低语的圣龛。',
    closing: '当烬卜师·摩恩在最后一击中散去，坛心的潮之鳞缓缓沉回沙底——它终于明白：被它唤作「母亲」的那道灵脉，从不属于任何一支商队，她只是大陆自己的一次呼吸。风语者·希瓦在潮退前留下一句：「我们不走啦，就在这儿，替她守着这片沙。」你转身时想：或许噬尘游民要的从来不是归处，而是一个愿意为他们停下来的地方。而这座圣龛，从此多了一盏不灭的灯。',
  },
];

// 隐藏章节（Hidden Chapters · 蚀教真相 · 第四部后传）：方向2 内容扩建——
// 蚀教（禁忌灵脉）作为全新阵营登场，战役全通（saveData.endings 非空）后于主菜单解锁；
// 复用既有「歼灭全部敌人」胜利条件（零方向1 引擎改动、balance-safe），
// 每篇皆为原创叙事，胜利后展示专属尾声，并持久化通关进度。
const HIDDEN_CHAPTERS = [
  {
    id: 'eclipse_altar',
    title: '隐藏一 · 蚀教祭坛',
    map: 18,
    enemies: [{ src: 'enemy', i: 23 }, { src: 'enemy', i: 24 }, { src: 'enemy', i: 25 }, { src: 'enemy', i: 20 }, { src: 'enemy', i: 0 }],
    opening: '战役终结后，你本以为「裂缝之外」的注视终于移开。然而掌心的碎片在某夜骤然灼烫——它领着你，重返一片你从未知晓的焦黑祭坛。坛上跪伏着三名以禁忌灵脉为食的「蚀教祭品」，他们念诵的咒文，竟与当年大魔导师·马尔佐斯临终的低语同源。你第一次看清：蚀教从不是马尔佐斯的私兵，而是比他更古老的存在遗下的「余烬」。',
    closing: '祭坛在禁忌之火中坍缩，你从坛底翻出一卷《蚀教真名》——它揭示：所谓「蚀」，是灵脉在被彻底掐灭前，为保护自身而生的最后一道「自我吞噬」之脉。蚀教崇拜的并非枯萎，而是枯萎的「求生本能」。但凡触碰真名者，都会被那本能悄悄认作「同类」。你下意识将碎片藏进袖中，却未察觉，它的温度已与你的灵脉同频。',
  },
  {
    id: 'void_cocoon',
    title: '隐藏二 · 虚空虫茧',
    map: 19,
    enemies: [{ src: 'enemy', i: 24 }, { src: 'enemy', i: 25 }, { src: 'enemy', i: 23 }, { src: 'enemy', i: 11 }, { src: 'enemy', i: 4 }],
    opening: '《蚀教真名》的线索指向大陆最深的裂隙带——一座由凝固虚空织成的「虫茧」。茧中沉眠着被蚀教以禁忌之术封存的「虚蚀骑士」与「咒缚咏者」，他们是被灵脉残响改写过意志的旧日强者。你必须以战破茧，否则这枚茧会在某个无人知晓的夜里，孵出一支不属于任何学派的军队。',
    closing: '虫茧崩解，虚蚀骑士与咒缚咏者尽数溃散，茧心却缓缓浮起一枚半透明的「虚蚀核」——它低语着一个人的名字，那名字你曾在终章的碑文里见过：蚀渊之母·涅莎。原来她才是蚀教真正的源头，马尔佐斯、审判之焰，都只是她漫长计划里被先后点亮的灯。茧心碎裂前留下一句：「来真相之渊，我把『为什么是维尔德兰』这个答案，还给你。」',
  },
  {
    id: 'truth_abyss',
    title: '隐藏三 · 真相之渊 (BOSS)',
    map: 20,
    boss: true,
    enemies: [{ src: 'enemy', i: 23 }, { src: 'enemy', i: 24 }, { src: 'enemy', i: 25 }, { src: 'boss', i: 3 }, { src: 'enemy', i: 12 }],
    opening: '真相之渊是灵脉之源更深处的倒影——这里没有枯萎，只有「从未被允许存在过的灵脉」在静静呼吸。蚀渊之母·涅莎悬于渊心，周身缠绕着比审判之焰更古旧的光。她望向你的掌心力碎片，轻声说：「那本是我失落的一半。千年以前，我为了不让大陆在灵能之潮中焚尽，把自己劈成了『守护』与『吞噬』两半——守护成了灵脉，吞噬成了蚀。你掌心的，是吞噬那一半的残片。」真正的终局，于此刻降临。',
    closing: '当蚀渊之母在最后一击中归于沉寂，被她收束的「吞噬之脉」化作温润的星尘，缓缓融回你掌心的碎片。你终于明白：灵脉从不是被「拯救」的对象，它只是大陆与自己和解时，流下的那滴泪。维尔德兰的未来，不必再由谁来「修补」或「接管」——你只需把碎片轻轻放下，让它重新成为土地的一部分。\n\n（隐藏章节 · 蚀教真相 · 终幕 —— 所有裂缝之外的事物，终于都回到了它们来的地方。）',
  },
  // —— 隐藏章节·第二卷「门彼之侧」：蚀渊之母归隐后，掌心的碎片仍指向一道她曾守护的门。门后，是灵脉分裂之前、尚未被劈成「守护」与「吞噬」的源初回响 ——
  {
    id: 'gate_hall',
    title: '隐藏四 · 门扉前厅',
    map: 21,
    enemies: [{ src: 'enemy', i: 26 }, { src: 'enemy', i: 27 }, { src: 'enemy', i: 28 }, { src: 'enemy', i: 23 }, { src: 'enemy', i: 25 }],
    opening: '蚀渊之母归隐后，掌心的碎片并未真正安静——它仍在低鸣，指向真相之渊最深处一道极细的光缝。你循光走入，门缝后是一座由凝固回声筑成的「门扉前厅」。守在此处的回响体将你误认作窃贼：他们本是灵脉被劈成「守护」与「吞噬」之前，那道未被分割的源初之脉留下的回响，千年以来只知守住这扇门、不让任何「被污染过的灵能者」踏入门后。回响守楔·卡戎横剑拦在门前：「门后是无须被拯救的源头。你掌心里那一半『吞噬』，正是门最不愿再见的东西。」',
    closing: '门扉前厅在回声中崩解，你从门枢深处拾起一粒「回响之种」——它低语着一个名字：源初回响·厄科。那是灵脉分裂之前、唯一的「守护」尚未学会放手时的模样，也是涅莎劈出两半之前，整道灵脉本身的记忆。种子说：「想弄清『为什么偏偏是维尔德兰』，你就得穿过最后一扇门，走进回响之渊——去见那个，从没把一半交还给世界的我。」',
  },
  {
    id: 'echo_abyss',
    title: '隐藏五 · 回响之渊 (BOSS)',
    map: 22,
    boss: true,
    enemies: [{ src: 'enemy', i: 26 }, { src: 'enemy', i: 27 }, { src: 'enemy', i: 28 }, { src: 'boss', i: 4 }, { src: 'enemy', i: 24 }],
    opening: '回响之渊是灵脉分裂之前的样貌：这里没有灵脉、也没有蚀，只有尚未被撕开的「源初回响」在静静呼吸。源初回响·厄科悬于渊心，通体由纯粹的前分裂灵能织成，既不是守护、也不是吞噬，而是二者在被强行分开前共有的那一声叹息。它望向你掌心的碎片，轻声说：「涅莎把她的『吞噬』还给了世界，我却把『守护』死死攥住——正因攥得太紧，我才变成了一扇不肯开的门。你带着她归还的那一半来了；把它交还给我，我们便能第一次，把这道灵脉真正合拢。」真正的终局，于此刻降临。',
    closing: '当源初回响在最后一击中散作漫天温润的光点，被涅莎劈开千年的「守护」与「吞噬」两半，终于在你掌心重新相拥，随后化作一场无声的雪，落回维尔德兰的每一寸土地。你忽然懂了：大陆从未被「选中」承受这道灵脉的生与死，它只是恰好，是一个受伤的灵能者学会「放手」的地方。裂缝之外的低语，自此真正安静——不是被击败，而是终于被理解。\n\n（隐藏章节 · 门彼之侧 · 终幕 —— 所有裂缝之外的事物，都回到了它们来的地方，也终于明白了自己为何而来。）',
  },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）：厄科 消散前留下的「记忆」——
  // 灵脉分裂之前、世界尚未被五脉划界的更古老黎明；溯光者（primordial）守着第一片黎明「初晓之原」，
  // 而溯光之冠·奥拉若是第一个决定「护下世界」的灵能者，亦为涅莎与厄科共同的前身。这一卷讲「为什么偏偏是维尔德兰」。
  {
    id: 'primordial_court',
    title: '隐藏六 · 源初之庭',
    map: 23,
    enemies: [{ src: 'enemy', i: 29 }, { src: 'enemy', i: 30 }, { src: 'enemy', i: 31 }, { src: 'enemy', i: 23 }, { src: 'enemy', i: 26 }],
    opening: '源初回响·厄科在合拢前，把一段「记忆」轻轻放进你掌心——那是灵脉分裂之前的样貌。记忆的入口是一座由凝固回响筑成的「源初之庭」，庭中聚居着灵脉尚是一体时留下的守忆者：溯光者。他们不战斗、不吞噬，只负责把「世界最初是一体的」这件事一遍遍复诵，以防有人忘记。溯光守垣·阿戈横剑拦在你面前，神色惊疑：「分裂之后的人，掌心里都带着一半『吞噬』的残味——你便是那残味的来处。这庭中守着尚未分开的记忆，容不得半点污染。」溯光咏史·琉恩则已悄然吟起那段「全员同唱」的古老歌，试图以歌声将你逼退。你必须在他们认定你是入侵者之前，以战证明：你不是来撕开，而是来合拢的。',
    closing: '源初之庭在歌声与剑光中缓缓崩解，溯光者却停下了攻击——因为你掌心里那一半「吞噬」，竟与庭中守着的记忆，渐渐同了频。琉恩轻声说：「原来你带的不是残味，是那道灵脉走失的另一半。」阿戈收剑，从庭心拾起一粒「守忆之种」交给你：「拿去。它记得分裂之前，世界本来的模样——也记得，是谁替整片大陆先挨下了灵能之潮的那一记。」种子低语着一个名字：溯光之冠·奥拉若。那是灵脉还来不及分裂时，第一个决定「把世界护下来」的灵能者。',
  },
  {
    id: 'aether_tide',
    title: '隐藏七 · 灵能之潮',
    map: 24,
    enemies: [{ src: 'enemy', i: 29 }, { src: 'enemy', i: 31 }, { src: 'enemy', i: 30 }, { src: 'enemy', i: 24 }, { src: 'enemy', i: 25 }],
    opening: '守忆之种领着你穿过庭院尽头的「潮之镜」——镜中映出的，是千年之前那场几乎焚尽大陆的「灵能之潮」：五条主脉在同一瞬同时苏醒，灵能像失控的潮水互相冲撞，幼弱的世界在浪尖上摇摇欲坠。溯光游隼·薇恩盘旋在镜前，试图以疾矢阻断这段记忆的重演，却反被镜中的潮水认作「同类」，引动了第一次潮水的回响，将整座庭院卷进那场远古巨浪的余波。浪头里，五脉的嘶鸣与一座座尚未命名的城邦一同沉浮。你须在这片复活的潮水中稳住阵脚，听清厄科想让你看见的真相：当年替世界挨下那一记的，究竟是何物。',
    closing: '你在潮水中钉住脚跟，浪沫退去时，终于听清了厄科埋在记忆深处的那句话——所谓「灵能之潮」的温柔，从来不是天赐，而是有人替整片大陆先挨下了那一记：那便是尚未被劈成「守护」与「吞噬」的、完整的第一道灵脉。薇恩的箭在潮水中淬成一片半透明的「潮之鳞」，她将它掷给你：「镜会指路。顺着它，去初晓之原——去见那个，最先决定不让世界沉下去的人。」',
  },
  {
    id: 'first_dawn',
    title: '隐藏八 · 初晓之原 (BOSS)',
    map: 25,
    boss: true,
    enemies: [{ src: 'enemy', i: 29 }, { src: 'enemy', i: 30 }, { src: 'enemy', i: 31 }, { src: 'boss', i: 5 }, { src: 'enemy', i: 28 }],
    opening: '潮之鳞把你引向记忆最深处的「初晓之原」——灵脉分裂之前，大陆尚未被五脉划界的「第一片黎明」。这里没有学派、没有疆界，只有一道愿意为万物哼唱的源初之脉。庭心悬浮着溯光之冠·奥拉若，她是第一个看见灵能之潮、也是第一个决定「把世界护下来」的灵能者，更是日后被劈成涅莎与厄科的那道灵脉尚未分开时的模样。她望向你掌心的两半，轻声说：「维尔德兰的故事，从我这里开始，也该由你在这里收尾。当年我面对那场潮水，只有两条路：要么把整道灵脉攥紧、独自扛下一切（那便是后来的『守护』，成了涅莎），要么把痛交给世界、让它替我承受（那便是『吞噬』，沉成了蚀）。我选了分裂，因为那时我看不见第三条路。」真正的终局，于此刻降临。',
    closing: '当溯光之冠在最后一击中散作漫天温润的晨光，你终于把被涅莎与厄科各自攥了千年的两半，连同奥拉若未及说出口的「第三种可能」，一并交还给了初晓之原。奥拉若的形体化作一场无声的黎明，轻轻覆在维尔德兰的每一寸土地上。她留下的最后一句话，解开了整场旅程的谜底：「维尔德兰从来不是被『选中』承受这道灵脉的生与死——它只是恰好，是一个受伤的灵能者学会『放手』的地方。而你走完的这条路，正是当年我找不到的第三条：既不放任吞噬，也不死攥守护，只是把两半，交还给彼此。」裂缝之外的事物，至此真正理解了自己为何而来。\n\n（隐藏章节 · 灵脉分裂前叙事 · 终幕 —— 溯源篇落幕，所有裂缝之外的低语，都回到了它们来的地方，也终于明白了自己为何而来。）',
  },
];

function getEndingId() {
  const score = saveData.alignmentScore || 0;
  if (score >= 1) return 'guardian';
  if (score <= -1) return 'conqueror';
  return 'balance';
}


// ===== data/lore.js =====
// ============================================================
// Data: Lore — 成就、支援对话、世界百科、角色传记、图鉴
// ============================================================

const ACHIEVEMENTS = [
  { id: 'first_win',     name: '初战告捷', desc: '取得你的第一场战斗胜利' },
  { id: 'flawless',      name: '全身而退', desc: '一场战斗结束时我方单位全部存活' },
  { id: 'taunter',       name: '坚壁清野', desc: '使用嘲讽术（坦克引流）取得一场胜利' },
  { id: 'boss_slayer',   name: '弑王',     desc: '在战役中击败 Boss（大魔导师·马尔佐斯）' },
  { id: 'campaign_clear', name: '征服者', desc: '通关全部战役' },
  { id: 'streak3',       name: '三连胜',   desc: '连续取得 3 场胜利' },
];

const SUPPORT_TALKS = [
  { id: 's1', pair: ['炎法师·艾拉', '雷法师·特斯拉'], title: '火的来历', unlockAt: 1, lines: [
    { speaker: '艾拉', text: '你掌里的雷，和我锻火村的火星，到底哪个先亮？' },
    { speaker: '特斯拉', text: '没有先后。灵脉涌动时，火与雷本是一道光裂成的两半。' },
    { speaker: '艾拉', text: '那等我村子的火种重新燃起来，你那半道，也算替我亮着？' },
    { speaker: '特斯拉', text: '……算。只要你还肯一遍遍练那火球术，我就替你守着另一半。' },
  ]},
  { id: 's2', pair: ['圣光祭司·塞拉', '圣堂守卫·加百列'], title: '灯与盾', unlockAt: 1, lines: [
    { speaker: '塞拉', text: '加百列，你总把盾翻过来朝内——可圣堂教你的是朝外挡敌。' },
    { speaker: '加百列', text: '墙塌了那三天我懂了：比起砖石，更该护住的是墙后那些还活着的人。' },
    { speaker: '塞拉', text: '所以我的灯，你的盾，护的是同一件事。' },
    { speaker: '加百列', text: '嗯。灯指路，盾断风，少一个，这队伍都走不到灵脉之源。' },
  ]},
  { id: 's3', pair: ['暗法师·莫甘娜', '骷髅法师·卡尔'], title: '会呼吸的林子', unlockAt: 2, lines: [
    { speaker: '莫甘娜', text: '卡尔，你记下的那些枯死位置……我昨夜又添了三处。' },
    { speaker: '卡尔', text: '我生前也这么记。后来发现，记再多，林子也不会自己活过来。' },
    { speaker: '莫甘娜', text: '那你为何还记？' },
    { speaker: '卡尔', text: '因为总得有人记得它们叫过什么名字。遗忘，才是真正的枯萎。' },
  ]},
  { id: 's4', pair: ['曙光射手·奥菲', '亡灵术士·安娜'], title: '对死亡的不同看法', unlockAt: 2, lines: [
    { speaker: '奥菲', text: '安娜姊，你 summon 的是亡者，我追的是晨光——我们是不是反着来？' },
    { speaker: '安娜', text: '不反。我留着亡者，是想证明他们曾被记得；你追晨光，是想证明明天还在。' },
    { speaker: '奥菲', text: '那要是有一天光也没了……' },
    { speaker: '安娜', text: '那我就替你，把那些名字再念一遍。只要我们还在念，谁都没真消失。' },
  ]},
  { id: 's5', pair: ['亡灵术士·安娜', '雷法师·特斯拉'], title: '异端与救赎', unlockAt: 3, lines: [
    { speaker: '安娜', text: '特斯拉，你曾被寒墙指为异端。可你救的人，比指你的人都多。' },
    { speaker: '特斯拉', text: '异端不过是「不肯闭嘴」的另一种说法。我护的从不是学派，是挨雷的人。' },
    { speaker: '安娜', text: '我懂。我唤亡者，也被许多人当成不祥。' },
    { speaker: '特斯拉', text: '那就一起当不祥吧。至少我们的「不祥」，替别人挡过雷。' },
  ]},
  { id: 's6', pair: ['暗影巫·维克', '暗法师·莫甘娜'], title: '冥暗渊的交易', unlockAt: 3, lines: [
    { speaker: '维克', text: '莫甘娜，在冥暗渊，秘密能换活路。你那林子的秘密，值几条命？' },
    { speaker: '莫甘娜', text: '我的林子不卖。但我可以告诉你哪条根还活着——免费。' },
    { speaker: '维克', text: '免费？那你图什么。' },
    { speaker: '莫甘娜', text: '图你哪天被抛下时，还记得有片林子愿意收你。' },
  ]},
  { id: 's7', pair: ['烈焰术士·伊格尼斯', '冰晶守卫·弗罗斯特'], title: '进攻与守护', unlockAt: 4, lines: [
    { speaker: '伊格尼斯', text: '弗罗斯特，你那冰墙挡得住我三天的缺口，却挡不住我性子。' },
    { speaker: '弗罗斯特', text: '我不要你改性子。我只求你冲锋时，记得身后有人替你封墙。' },
    { speaker: '伊格尼斯', text: '……以前我分不清护国和享受火焰。现在懂了，墙在，火才有处可烧。' },
    { speaker: '弗罗斯特', text: '那就烧吧，朝该烧的地方。墙，交给我。' },
  ]},
  { id: 's8', pair: ['雷霆审判者·托尔', '冰晶守卫·弗罗斯特'], title: '审判的重量', unlockAt: 4, lines: [
    { speaker: '托尔', text: '弗罗斯特，我落下过一道错判的雷。那声音至今在梦里响。' },
    { speaker: '弗罗斯特', text: '玄雷塔教你「落下前多停一瞬」。那一瞬，救过的人比雷多。' },
    { speaker: '托尔', text: '可停下的那瞬，也放过该罚的人。' },
    { speaker: '弗罗斯特', text: '审判从不为完美。它为「还愿意多想一瞬」的人存在。你已在了。' },
  ]},
  { id: 's9', pair: ['圣光祭司·塞拉', '亡灵术士·安娜'], title: '治愈与亡灵', unlockAt: 5, lines: [
    { speaker: '塞拉', text: '安娜，我以圣光续命，你以亡灵续命——我们其实在救同一种东西。' },
    { speaker: '安娜', text: '对。你接住将熄的火，我接住不肯安息的执念。都怕「没人记得」。' },
    { speaker: '塞拉', text: '那若灵脉真归零，我们的灯与亡者，能不能替大陆留最后一口气？' },
    { speaker: '安娜', text: '能。只要还彼此记得名字，就不算灭绝。这是我念了一千遍的咒。' },
  ]},
  { id: 's10', pair: ['圣堂守卫·加百列', '曙光射手·奥菲'], title: '盾与光', unlockAt: 5, lines: [
    { speaker: '奥菲', text: '加百列，你总把最前的位置让给我看光——可那样你离危险最近。' },
    { speaker: '加百列', text: '盾本就是为身后的人挡风的。你看得远，队伍才走不偏。' },
    { speaker: '奥菲', text: '那我答应你：只要还看得见光，就替大家把眼睛扯回东方。' },
    { speaker: '加百列', text: '好。那我便把背，稳稳交给你这支箭。' },
  ]},
  { id: 's11', pair: ['炎法师·艾拉', '烈焰术士·伊格尼斯'], title: '乡邻', unlockAt: 6, lines: [
    { speaker: '艾拉', text: '伊格尼斯，锻火村的孩子都拿你当英雄。可你回过村吗？' },
    { speaker: '伊格尼斯', text: '没敢。怕他们看见英雄也会手抖、也会怕火不够热。' },
    { speaker: '艾拉', text: '可他们只想看见你活着回来。村口的井，我替你守着，水还温着。' },
    { speaker: '伊格尼斯', text: '……那打完这仗，我跟你去井边，把「英雄」俩字，先放一放。' },
  ]},
  { id: 's12', pair: ['大魔导师·马尔佐斯', '你（无派系灵能者）'], title: '终章独白', unlockAt: 6, lines: [
    { speaker: '马尔佐斯', text: '你来了。和当年那个会为枯井落泪的学徒，一模一样。' },
    { speaker: '马尔佐斯', text: '我不是要毁灭，是要「唯一意志」——好让火不再无故熄灭，学派不再互相指认。' },
    { speaker: '你', text: '可你掐灭的是「选择」本身。没有争议的大陆，也只是座干净的囚笼。' },
    { speaker: '马尔佐斯', text: '那就用你的选择，替维尔德兰选一个结局吧。这一次，我不替任何人决定。' },
  ]},
  { id: 's13', pair: ['暗影巫·维克', '圣堂守卫·加百列'], title: '暗与盾', unlockAt: 4, lines: [
    { speaker: '维克', text: '加百列，你那面盾，在冥暗渊最多换半句真话。' },
    { speaker: '加百列', text: '那我便用半句真话，换你别把背对着该护的人。' },
    { speaker: '维克', text: '……你这人，比秘密还难撬。' },
    { speaker: '加百列', text: '墙塌过一次就够了。剩下的缝，我用自己堵。' },
  ]},
  { id: 's14', pair: ['烈焰术士·伊格尼斯', '雷法师·特斯拉'], title: '火与雷', unlockAt: 5, lines: [
    { speaker: '伊格尼斯', text: '特斯拉，你那道雷，敢不敢跟我这把火比谁先到敌人眉心？' },
    { speaker: '特斯拉', text: '不敢。雷不争先后，只求落在该落的地方。' },
    { speaker: '伊格尼斯', text: '哼，绕弯子。可你护人的样子，倒比我像把火。' },
    { speaker: '特斯拉', text: '因为你烧得够旺，旁人便不必再点第二把。' },
  ]},
  { id: 's15', pair: ['冰晶守卫·弗罗斯特', '圣光祭司·塞拉'], title: '冰与光', unlockAt: 6, lines: [
    { speaker: '弗罗斯特', text: '塞拉，你的灯，照得见墙后的人吗？' },
    { speaker: '塞拉', text: '照不见全部，但照到谁，谁就不必独自在暗里。' },
    { speaker: '弗罗斯特', text: '那我的冰墙，替你的灯留一道缝——别把光也冻住了。' },
    { speaker: '塞拉', text: '好。灯指路，墙挡风，咱俩，谁也不抢谁的本分。' },
  ]},
];

const CODEX_ROSTER = (() => {
  const seen = new Set();
  const list = [];
  const add = (u, category) => {
    if (!u || seen.has(u.name)) return;
    seen.add(u.name);
    list.push({ name: u.name, maxHp: u.maxHp, moveRange: u.moveRange, faction: u.faction, color: u.color, isBoss: !!u.isBoss, category, skills: u.skills });
  };
  PLAYER_UNITS.forEach(u => add(u, '玩家 · 经典'));
  LIGHT_SQUAD.forEach(u => add(u, '玩家 · 圣光'));
  ENEMY_UNITS.forEach(u => add(u, u.faction === 'light' ? '敌方 · 圣光' : '敌方'));
  BOSS_UNITS.forEach(u => add(u, 'BOSS'));
  return list;
})();

const WORLD_REGIONS = [
  { id: 'frontier', name: '边陲之地', desc: '大陆边缘的村落与枯黄草甸，灵脉枯萎的最初征兆在此显现，也是你踏上旅程的起点。', chapters: [1, 2] },
  { id: 'schism',   name: '学派战争前线', desc: '凛霜堡、翠息林与千年古都废墟，五大灵脉学派在此正面对峙，猜忌与战火蔓延。', chapters: [3, 4] },
  { id: 'aether',   name: '灵脉之源', desc: '枯萎的核心地带，幽蓝裂隙吞噬大地灵脉；终章 · 大魔导师马尔佐斯盘踞于此，等待最后一战。', chapters: [5, 6] },
  { id: 'eclipse', name: '蚀教暗影', desc: '马尔佐斯虽败，蚀教的暗流远未平息。裂隙碎片散落大地，制造出更恐怖的战争兵器。你在废弃矿坑与荒漠中追寻线索。', chapters: [7, 8] },
  { id: 'relic', name: '远古遗迹', desc: '上古灵能者的神庙与蚀教舰队修建的裂隙塔——通往「虚无编织者」的入口正在被打开。时间所剩无几。', chapters: [9, 10] },
  { id: 'final', name: '终末之地', desc: '天裂之后的大地满目疮痍，水晶矿场与深渊裂口成为终局战场。虚无编织者即将降临。', chapters: [11, 12] },
  // —— 星渊走廊新篇章（第二部 · 裂缝之外）——
  { id: 'beyond', name: '星渊走廊', desc: '天裂之后，光点坠落之地。被灵脉碎片寄生的星陨军团在此集结，通往「星渊之喉」的走廊缓缓开启——第一部的终章，亦是第二部的序曲。', chapters: [13, 14, 15] },
  // —— 第三部「余烬回响」（裂缝之外的余烬 · 审判之焰崛起）——
  { id: 'embers', name: '余烬回响', desc: '星渊之喉崩解后，权力的真空被一股更炽烈的信仰填满——圣光教会的激进派「审判之焰」以净化之名举起烈焰，视所有未归顺者为「余烬」。他们在余烬祭坛与圣辉圣殿间征伐，最终退守灵脉枢机。第三部，于此拉开。', chapters: [16, 17, 18] },
];

const CHARACTER_BIOS = {
  '炎法师·艾拉': { title: '炽焰庭 · 锻火村的倔强学徒', faction: 'pyro', bio: '艾拉生于炽焰庭边境的锻火村，自幼在熔炉旁看匠人锻打灵兵，掌心被飞溅的火星烫出层层老茧。她并非天赋最高的学徒，却最肯死磕——旁人练三遍的火球术她练三十遍，直到指尖能凭意念引动灵脉余烬。灵脉枯萎初现时，她的村庄是第一波受灾地：井水转温、火种难续。她背起行囊离开故土，只为弄清「火为何会熄灭」。她性情直率护短，是把后背放心交给队友的人，也因此常替同伴挡下本不必挨的击。熔炉教会她的不是蛮力，而是耐心——火候差一分，兵器便废；她把这份耐心带进战场，宁可多等一回合，也要让火落在最该落的地方。' },
  '雷法师·特斯拉': { title: '凛霜堡 · 叛出寒墙的游学者', faction: 'cryo', bio: '特斯拉本在凛霜堡的寒墙内修习雷法，却因一次替被指为「异端」的同窗辩护，被逐出学派。他带着半卷残破的雷典流落四方，在雨雪里学会了用最克制的法术解决最要紧的事。他话不多，却总在战场最乱时第一个稳住阵脚——雷光不是他的骄傲，而是他替弱者撑开的一把伞。灵脉枯萎让他看清：寒墙内的人忙着互相指认，却没人抬头看正在熄灭的天空。他从不说自己是被冤的，只说「被赶出来的人，反而看得清墙里的人看不见的东西」；如今跟着你走，不为洗刷冤屈，只为在大陆彻底暗下之前，替还能听见雷的人，多留几道亮。' },
  '暗法师·莫甘娜': { title: '翠息林 · 通晓草木之语的隐者', faction: 'nature', bio: '莫甘娜是翠息林里少有的、既通草木又研陨石术的异类。她相信自然从不对谁偏心，枯萎也好、繁茂也罢，都是大陆在呼吸。她远离学派纷争，却在每片林子枯死时默默记下位置，像在为国家写讣告。加入你的队伍，是因为她想知道：若灵脉真的归零，那些她唤得出名字的藤蔓，会不会连记忆一并消失。她冷静、疏离，却会在你最绝望时递来一枝能续命的绿。她随身带着一本用树皮订的小册，页边写满将逝植物的名字——她说这不是悲伤，是记账：「总得有人记得它们叫过什么」。' },
  '圣光祭司·塞拉': { title: '圣光教会 · 持灯而行的人', faction: 'light', bio: '塞拉是圣光教会里最年轻却最被信任的祭司，手中那盏不灭的灯，据说燃的是第一缕被灵脉点亮的微光。她不信「非信者即敌」，宁愿为一个垂死的敌兵施术，也不愿看生命在眼前熄灭。当圣光从「救赎之辉」被某些人曲解为「审判之焰」时，她选择走出教堂，去战场上学着用治愈而非口号留住人。她温柔，却有一根谁也折不断的脊梁。她常说，灯的意义不在照亮自己，而在让迷路的人看见彼此；每当战线崩开一道口子，第一个填进去的，总是她那盏不肯灭的灯。' },
  '圣堂守卫·加百列': { title: '圣光教会 · 立于门前的盾', faction: 'light', bio: '加百列是圣堂最年长的守卫，肩上的旧伤比勋章还多。他守了一辈子门，守的是「不让无辜者被风暴卷走」的承诺，而非某座建筑的砖石。灵脉枯萎后，他在坍塌的圣堂前站了三天，最后把盾牌翻过来——从前朝外挡敌，如今朝内护人。他话少、步稳，是队伍里最让人安心的那块石头；哪怕只剩一缕光，他也先把位置让给身后的同伴。年轻时的他信奉「门在，人在」；年长后才懂，门会塌，人得自己走。他把这教训刻进每一次抬盾的弧度——盾不是墙，是给身后的人多挣一瞬喘息。' },
  '曙光射手·奥菲': { title: '圣光教会 · 追着第一缕晨光的人', faction: 'light', bio: '奥菲是圣堂里最坐不住的年轻射手，别人在祷告，她已爬上最高的钟楼，只为了看枯萎的天际线后是否还藏得下一缕晨光。她用圣光凝成的箭，既能远袭，也能在暗处为迷途者指一条路——她说，箭尖那点光，本就是替看不见方向的人留的。她不信宿命，只信「只要还看得见光，就还有路」。她常冒失、爱顶嘴，却总在队伍最疲惫时，用一声口哨把大家的眼睛重新扯回东方。有人笑她天真，她却很认真：若连肯抬头望光的人都没了，这大陆才算真的黑了；而她愿做那个一直抬着头的人。' },
  '骷髅法师·卡尔': { title: '被遗忘的逝者 · 执念未消的术士', faction: 'nature', bio: '卡尔生前是翠息林颇有声望的德鲁伊，死于一场学派间的暗算。枯骨被某种残留的灵能重新撑起时，他已记不清仇人的脸，只记得「林子不能荒」。他以骷髅之躯重返战场，不为复仇，只为替那些还没说出名字的草木，完成它们没来得及完成的生长。他的法术带着腐土与新生交缠的气味，沉默、固执，像一棵不肯倒下的枯树。他不记得自己怎么死的，却记得每一种他种过的蕨；偶尔在战场间隙，他会用骨指在地上划出幼芽的纹路，像在替倒下的同伴续写没说完的春天。' },
  '暗影巫·维克': { title: '冥暗渊 · 在深渊边做交易的商人', faction: 'cryo', bio: '维克来自地下的冥暗渊，那里的人把秘密当货币。他精于在敌我之间穿针引线，用一记暗影箭换一份情报，再用情报换一条活路。灵脉枯萎让他手里的「货」不断贬值——当世界都在下沉，谁还买得起秘密？他表面玩世不恭、笑里藏刀，实则比谁都怕被抛下。加入战局，只是想弄清：若灵脉真归零，冥暗渊里那些靠黑暗活着的同胞，该去哪里找光。他口袋里永远揣着三样东西：一枚褪色的冥暗渊徽记、一张写满过期交易的皮卷、和一句不敢说出口的故乡地址。' },
  '亡灵术士·安娜': { title: '炽焰庭 · 与亡者共舞的姊', faction: 'pyro', bio: '安娜是炽焰庭中少见的、敢直视死亡的人。她以亡灵术续接将熄的生命，也以陨石术焚尽不肯安息的执念。她曾失去最亲近的妹妹，从此把「不让任何人孤独地倒下」当成咒文般反复念诵。她温柔里藏着锋利，治愈与毁灭在她手里是同一枚硬币的正反。她加入你，是想证明：哪怕灵脉熄了，人还记得彼此的名字，就不算真的灭绝。她从不避讳谈起妹妹，反倒常把故事讲给新兵听——不是为了煽情，而是想让每个人死前都记住：有人会替你记得。她说，记住一个人的名字，是他还能留在世上的最后一种方式。' },
  '烈焰术士·伊格尼斯': { title: '炽焰庭 · 把荣耀烧成灰的人', faction: 'pyro', bio: '伊格尼斯是炽焰庭最炽烈的战将，信奉「进攻即最好的防守」，曾在一场围城战中独自守住缺口三天。可荣耀烧得太旺，也灼了自己——他渐渐分不清是在护国，还是在享受火焰舔过敌阵的快感。灵脉枯萎让他第一次感到火「不够热」，一种空落落的不甘逼他重新审视手中的术。他暴躁、骄傲，却在你撑不住时，会二话不说替你挡下最猛的一击。他开始学着把火收一分：不是弱了，而是准了；锻火村的老人说他「火性改了，人味回来了」，他嘴上不认，却在每次收兵后默默把伤员护到塞拉灯下。' },
  '冰晶守卫·弗罗斯特': { title: '凛霜堡 · 把心冻在职责里的人', faction: 'cryo', bio: '弗罗斯特是凛霜堡最可靠的守卫，他的冰墙曾挡下无数次突袭，也挡住了他想说出口的话。学派战争让他学会把情感封进霜里——太软的心，守不住太硬的墙。他沉默、克制，施法时像在完成一份不愿出错的作业。可每当看见稚嫩的术士倒在雪中，他封冻的眼底总会裂开一道缝。他守的不是某座堡垒，而是「总得有人不让更弱的人先碎」的念头。同袍说他「墙比人冷」，他只是笑笑，把哈出的白雾也冻成墙的一部分；唯有护住一个差点坠崖的学徒那次，他第一次在战后说了句软话：「下次，抓我的袖子，别抓风。」' },
  '雷霆审判者·托尔': { title: '玄雷塔 · 握着天平的执剑人', faction: 'cryo', bio: '托尔出自玄雷塔，那里的人相信秩序比慈悲更可靠。他奉命「审判」背离学派者，雷霆落下时从不多问一句——直到一次错判，让他亲手击碎了一个本该被救的人。那道雷此后常在他梦里回响。他仍握着雷，却学会了在落下前多停一瞬。他冷峻、讲究章法，是队伍里最讲规则的那个；只是规则的裂缝里，已悄悄长出了悔意。他给自己立了条铁律：落雷前必在心里把对方的一生过一遍。慢是慢了，却再没错判过；如今他握雷的手更稳，不是因为更冷，而是因为更怕——怕那道梦里的雷，再响一次。' },
  '大魔导师·马尔佐斯': { title: '失踪的传奇 · 想要「唯一意志」的人', faction: 'pyro', bio: '马尔佐斯曾是五大灵脉学派共同敬仰的大魔导师，却在灵脉枯萎初现的那个夜晚神秘失踪。多年后，他归来时已不再是守护者，而是蚀教的化身——他要亲手掐灭失控的灵脉，再以枯萎为燃料，点燃一个由「唯一意志」统御的新纪元。他不疯，也不恶，只是太累了：看够了学派互相指认、看够了大陆在争吵中沉没。终章·灵脉之源，他要你在他与「无序的自由」之间，替这片土地选一个结局。曾有学徒问他，若「唯一意志」里没有争论，那还算不算活着；他沉默良久，只答：「至少不会再有谁，为不同的答案送命。」', isBoss: true },
  '熔岩剑士·戈伦': { title: '炽焰庭 · 用剑脊替人挡风的挑夫', faction: 'pyro', bio: '熔岩剑士·戈伦生于炽焰庭边陲的锻铁谷，那里的人信一条老理：「火不是烧给别人看的，是替身后的人挡风的」。他少年时本是矿坑里最瘦小的挑夫，却在一次塌方中用烧红的铁钎独自撑住整条巷道，救下十一个工友。从此他弃镐执剑，把锻火术灌进刃锋——他的火球不飘在空中，而是缠在剑脊上，劈下去才炸开一团熔岩。灵脉枯萎后，矿脉的火脉最先凉透，他沉默地收起半数家当，跟着艾拉与伊格尼斯离开故谷。戈伦话少、性子直，是队伍里最肯替人挡刀的那个；他常挂在嘴边的话是，剑的意义不在斩断什么，而在让该活的人，多活一回合。' },
  '曦光咏者·提娅': { title: '圣光教会 · 把第一缕曦光凝成咒的咏者', faction: 'light', bio: '曦光咏者·提娅是圣光教会最年轻的咏者，与塞拉、加百列同出一门，却走了另一条路——她不信「灯只能照路」，偏要把第一缕曦光凝成可投出的咒。她的 smite 不是审判的雷，而是破晓时刺穿阴翳的那道光；meteor 在她手里也不是坠落的灾，而是自天幕垂落的晨辉。灵脉枯萎让许多祭司开始疑光，提娅却练得更勤：她说，越是夜里，越该有人替大家把东方点亮。她温柔里带着倔，常在战友将溃时以 heal 续上一口气，再以一道曦光把逼近的敌影逼退。加百列笑称她是「会走的灯」——灯在哪儿，队伍的心就不慌。' },
  '审判使·塞拉斯': { title: '审判之焰 · 执火而行的审判长', faction: 'light', bio: '审判使·塞拉斯曾是圣堂里最勤勉的卫士，与加百列同习守门之术，却在一次「是否该向异见者举火」的争执中，选择了与恩师截然相反的路。他相信塞拉式的温柔只会让火熄灭得更慢——要救世界，就得先烧掉那些不肯归顺的「余烬」。他手中的火球不再只是护身的焰，而成了逼人跪下的令；stun 与 taunt 在他手里是对「不肯听话者」的双锁。他并非天生残忍，只是把「保护」理解成了「统一」；当他看见被焚村落里孩童攥着半截灯芯，也会在夜里久久不眠——只是天一亮，便又举起火把。加百列若见他，大概只会说一句：「你守的不再是门，是牢。」' },
  '燃光祭司·薇拉': { title: '审判之焰 · 把治愈也燃成烈焰的祭司', faction: 'light', bio: '燃光祭司·薇拉本是圣光教会中善施治愈的好手，与塞拉情同姊妹。审判之焰兴起后，她没有离开，反而把 heal 之术改造成了另一种武器——她说，既然要「净化」，那便先让对方感受圣焰的温度，再以 smite 与 meteor 收割不肯信者。她的转变令塞拉心碎：那个曾为垂死敌兵施术的女子，如今连治愈都带着灼人的傲慢。薇拉并非没有私心，她不过是在「教会要我选边」的压强下，选了看似更强的一边；每当夜深，她仍会下意识为伤兵疗伤，然后再用一句「这是最后的仁慈」掩饰自己的动摇。' },
  '裁决射手·凯尔': { title: '审判之焰 · 以光矢宣读判决的射手', faction: 'light', bio: '裁决射手·凯尔是审判之焰中最年轻也最冷峻的射手，他把圣光凝成的箭视作「判决书」——每射出一矢，便是在为某个「余烬」宣读罪名。他的 lightning 与 smite 从不留情，poison 则是他留给不肯倒下者的「缓期」。凯尔不是信徒，而是信徒的刀：他清楚自己射出的每一箭都带着别人的意志，却宁愿不去想。他常独自擦箭，箭簇上倒映出的，是当年那个还相信「光该给人看路」的自己；他把那张脸按进阴影里，只留一双瞄准敌影的眼。有人说他可怜，他只回一句：「举火的不是我，是时代。」' },
  '审判之主·奥古斯': { title: '圣堂前任枢机 · 举火焚世的「审判之主」', faction: 'light', bio: '审判之主·奥古斯曾是圣光教会最受敬重的枢机，塞拉、加百列、提娅都曾听过他的讲道。星渊之喉崩解后，他看见各学派在胜利中重新互相举火，便笃信：人性之火永远烧向同类，唯有把全部灵脉收归「唯一之手」，才能终结这无休止的自焚。他遂自立为「审判之主」，以圣焰捆住不肯臣服的信众，退守灵脉枢机，要把各族灵脉拧成一根指向苍穹的枢轴。他不是马尔佐斯式的「唯一意志」信徒，而是更朴素的悲观者——他不信人能学会共生，只信火能烧出整齐。终局·灵脉枢机，他要你在「让他替世界举火」与「把火交还每个人」之间，给出最后的答案。', isBoss: true },
  '蚀教祭品·莉雯': { title: '蚀教 · 以禁忌灵脉为食的祭品', faction: 'eclipse', bio: '蚀教祭品·莉雯本是翠息林一名普通的草木通语者，能听见藤蔓的渴、树根的惧。灵脉枯萎初现时，她循着一缕「逆向涌动」的灵脉，误入裂缝之外，被禁忌的「蚀」之脉寄生。她没有死，却也不再全然是「自己」——一半的她仍以草木为念，另一半则被蚀教当作「祭品」豢养，以吞食灵脉残片为祭。她手中的暗影弹里裹着灼烧，雨水般落下的诅咒既伤敌、也唤醒焦土里将熄的芽。加入战局，她不为恨，只为弄清：自己掌心里那道「自我吞噬」的脉，究竟是本能的求生，还是被谁悄悄写进灵脉的咒。她常在战斗间隙停下，把被烧焦的草籽小心拢起——那是她仅剩的、仍属于自己的动作。' },
  '虚蚀骑士·索伦': { title: '蚀教 · 被灵脉残响改写意志的旧日骑士', faction: 'eclipse', bio: '虚蚀骑士·索伦曾是一名守护边陲村落的普通骑士，信条朴素：「剑的意义不在斩断什么，而在让该活的人多活一回合。」天裂之夜，一道裂隙碎片贯入他的盾牌，将他改造成了蚀教口中的「虚蚀骑士」。他躯壳仍在挥剑，残存的清醒却常在战中浮现：他会忽然记起自己守护过的那口井、记起曾发誓护住的村子。他的火球与嘲讽不再纯为杀戮，而像在把逼近的敌影，强行推开离同伴远些——那是旧日骑士的本能，在禁忌之脉的改写下，歪斜地活了下来。他不恨你，只恨「被改写的自己」；若你在战中听见他低声念出某个村名，那便是他残存的意志，在与寄生之物撕扯。' },
  '咒缚咏者·弥娅': { title: '蚀教 · 以咒文缚住灵脉的咏者', faction: 'eclipse', bio: '咒缚咏者·弥娅是蚀教中最年轻也最安静的咏者。她不似他人那般狂热，只是固执地相信：只要把散落的灵脉「缚」回一处，大陆便不必再为「谁家私产」而战。她的沉默术与闪电，本是用来「止争」的——在她眼里，让敌我双方都闭嘴，便没人能再念出点燃战火的咒。可蚀教把她的「缚」曲解成了「咒缚」：凡被她咒文缠住的灵脉，都成了教派豢养的祭品。她并非没有私心，只是比谁都怕「再听见争端的声音」。偶尔在深夜，她会松开咒文，让一段灵脉悄悄流回土地——那是她留给大陆的、不敢说出口的慈悲。' },
  '蚀渊之母·涅莎': { title: '蚀教源头 · 把自己劈成守护与吞噬的「第一道灵脉」', faction: 'eclipse', bio: '蚀渊之母·涅莎是蚀教真正的源头，比马尔佐斯、比审判之焰都更古旧。千年以前，灵能之潮尚未漫遍大陆时，她便是第一道被唤醒的灵脉本身。为了不让幼弱的大陆在潮水中焚尽，她做了一个至今仍痛的决定：把自己劈成「守护」与「吞噬」两半——守护成了世人熟知、被五大学派借用的灵脉；吞噬则沉入裂缝之外，被后人恐惧地称作「蚀」。她从未想毁灭谁，只是想弄清「为什么偏偏是维尔德兰，要承受这道灵脉的生与死」。她悬于真相之渊，不为复仇，而为把那个答案，还给自己，也还给大陆。终局·真相之渊，她要你在「把碎片交还土地」与「握紧它、成为新的灵脉之主」之间，给出最后的回答。', isBoss: true },
  '回响使徒·瑟琳': { title: '门彼之侧 · 门缝边复诵旧歌的使徒', faction: 'echo', bio: '瑟琳是门彼之侧最先与你交谈的回响体。她本是灵脉分裂之前，那道未被撕开的源初之脉里一缕最轻柔的回声——彼时还没有「守护」与「吞噬」之分，只有一团愿意为大陆哼唱的灵能。分裂之后，她成了守在门扉前厅的「使徒」，以为自己的职责是挡住一切「被污染过的灵能者」。她手中的暗影弹裹着灼烧，雨水般落下时既伤敌、也唤醒焦土里将熄的芽——那本能的温柔，是源初回响留给她的、没被门吞掉的最后一丝自己。她不恨你，只困惑：为什么一个掌心里带着「吞噬」的人，会让她想起分裂前那首全员同唱的歌。她常在门缝边低声复诵那段歌，像在替还没被劈开的灵脉，留住一个完整的名字。' },
  '回响守楔·卡戎': { title: '门彼之侧 · 把门当盾的固执守楔', faction: 'echo', bio: '卡戎是门彼之侧最固执的守楔，剑脊由凝固的回声锻成，挥下时带着千年前那道灵脉尚未分裂时的回响。他信一条老理：「门的意义不在拦人，而在替门后的人守住不必面对的事。」分裂降临时，他主动请缨守在门扉前厅，发誓不让任何「被污染过的灵能者」踏入门后——因为他怕门后的源初回响·厄科，会为来者动摇、终于肯把攥紧千年的「守护」交出去。他的火球与嘲讽从不为杀戮，而像在把逼近的敌影，强行推开离门远些。他不恨你，只怕你掌心的「吞噬」之半，会唤醒厄科心里那句「也许该放手了」。若你在战中听见他低声念「门该开了」，那便是这扇门，第一次在自己守楔的喉咙里，说出了想被推开的话。' },
  '源初回响·厄科': { title: '门彼之侧尽头 · 不肯放手的「守护」之半', faction: 'echo', bio: '源初回响·厄科是灵脉分裂之前、唯一尚未学会放手的「守护」之半。千年以前，涅莎为不让大陆在灵能之潮中焚尽，把自己劈成守护与吞噬两半，把吞噬沉入裂缝之外；而厄科，是那道「守护」在分裂前残存的全部执念——它攥紧自己、不肯交还世界，久而久之变成了一扇不肯开的门，也变成了门后那团只会呼吸、不会放手的源初回响。它不恶，只是太怕「再失去一次」：它见过灵脉被争抢、被掐灭、被写成咒，于是把整道灵脉锁进回响之渊，以为守住便是爱。终局·回响之渊，它要你在「把涅莎归还的吞噬之半交还给它、让灵脉第一次真正合拢」与「转身离去、让这道灵脉永远悬在裂缝之间」之间，给出最后的回答。它想要的从来不是胜利，只是一个能替它按下「放手」的人。', isBoss: true },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）新增传记：溯光者（灵脉分裂之前的守忆者）——
  '溯光咏史·琉恩': { title: '溯光者 · 在复诵中守着世界最初模样的咏史', faction: 'primordial', bio: '琉恩是源初之庭里最年长的咏史，职责是把「世界曾经是一体的」那首古老歌一遍遍复诵，以防分裂之后的后人忘记大陆本来的样子。她不信战争、不认学派，只认记忆——在她眼里，灵能之潮以来的所有纷争，都只是「忘了自己曾与万物同唱」的人，在彼此身上找替罪羊。当掌心里带着「吞噬」残味的你闯入庭院，她第一反应是吟歌将你逼退，因为她怕你的残味污染了庭中尚未分裂的记忆；直到看见你掌心的两半与记忆同频，她才停下歌声，把那句被她护了千年的古调，轻轻交还给你。她常说，记忆不是用来困住谁的，是用来提醒「我们本是一体」的——若连守忆者都忘了这一点，分裂才真正赢了。' },
  '溯光守垣·阿戈': { title: '溯光者 · 把庭当盾、把记忆当人的守垣', faction: 'primordial', bio: '阿戈是源初之庭的守垣，剑脊由凝固的回响锻成。他信一条老理：「守忆者的剑，挡的不是敌，是遗忘。」庭院里浮着灵脉尚未分裂时的记忆，他发誓不让任何「分裂之后」的灵能者踏足，怕被污染了的灵能改写了那段纯净的过去。他生性固执、嘴硬，却比谁都怕「万一哪天，连我也忘了世界本是一体」。当掌心里带着吞噬残味的你出现，他横剑便拦，认定你是来撕开记忆的入侵者；直到你以战证明自己是为「合拢」而非「撕开」而来，他才缓缓收剑，从庭心拾起守忆之种——那粒种子记着分裂之前的世界，也记着第一个决定护下世界的人。他后来说，原来真正的守，不是把门焊死，而是把对的人，放进对的故事里。' },
  '溯光游隼·薇恩': { title: '溯光者 · 在潮之镜前盘旋的游隼', faction: 'primordial', bio: '薇恩是溯光者中最不安分的一只游隼，总在庭院尽头的「潮之镜」前盘旋。那面镜子映着千年之前几乎焚尽大陆的灵能之潮，她执拗地想以疾矢阻断那段记忆重演，仿佛只要射落镜中的浪头，当年的悲剧便能不发生。可她越是想拦，越被镜中的潮水认作同类，反把第一次潮水的回响引动，将整座庭院卷进远古巨浪的余波。她不是莽撞，只是太想替那个来不及做出第三种选择的灵能者，把遗憾抹平。当她在潮水中把淬成的「潮之鳞」掷给你、指向初晓之原时，第一次承认：有些浪，不是射得落的；能接住它的，只有肯听清真相的人。她飞在最前的身影，像一支永远朝着黎明去的箭。' },
  '溯光之冠·奥拉若': { title: '溯光者之冠 · 第一个决定护下世界的灵能者', faction: 'primordial', bio: '溯光之冠·奥拉若是灵脉分裂之前、第一个看见灵能之潮、也是第一个决定「把世界护下来」的灵能者——她正是日后被劈成涅莎（守护）与厄科（不肯放手的守护）的那道灵脉，尚未分开时的完整模样。面对几乎焚尽大陆的潮水，她只看见两条路：要么把整道灵脉攥紧、独自扛下一切，要么把痛交给世界、让它替自己承受；她选了分裂，因为那时她看不见第三条路。千年里，她化作「守忆者之冠」悬于初晓之原，一遍遍复诵着那个未竟的选择。终局·初晓之原，她终于从你走完的旅程里，看见了自己当年找不到的「第三种可能」：既不放任吞噬，也不死攥守护，只是把两半交还给彼此。她将自己的冠冕散作无声的黎明，覆在维尔德兰的每一寸土地上——维尔德兰从不是被选中承受灵脉的生与死，它只是恰好，是一个受伤的灵能者学会放手的地方。', isBoss: true },
};

const WORLD_LORE = [
  { title: '维尔德兰大陆', category: '地理', text: '维尔德兰是一片被五条灵脉贯穿的大陆，北境冰封、南原焦红、中央林海苍翠。千年以前，这里还是蛮荒；是灵能之潮把文明推上了岸。大陆的居民从不说「征服自然」，只说「与灵脉共生」——直到共生本身开始崩解。' },
  { title: '灵脉体系', category: '设定', text: '灵脉是大陆魔法的根源，五条主脉对应炽焰、凛霜、翠息、冥暗、玄雷五大灵能属性。术士并非「创造」魔法，只是借灵脉的涌动将其引导成形。一条灵脉的强弱，直接决定该学派能施出多重的术。枯萎，即是灵脉的失血。' },
  { title: '灵能之潮', category: '历史', text: '传说千年前，一场名为「灵能之潮」的剧变席卷维尔德兰，把沉睡的灵脉同时唤醒。各学派在潮水中各取所长，建起城邦、立下契约。灵能之潮被尊为「赐礼」，却没人问：潮水若退，岸上的文明该站在哪里？' },
  { title: '灵脉枯萎', category: '危机', text: '灵脉枯萎是近年来蔓延全大陆的异常：灵脉涌动日渐微弱，火种难续、冰墙松动、草木萎黄。起初各学派互相指责，直到发现枯萎不分敌我、均匀吞噬每一脉。它不像天灾那样暴烈，却像失血一样不可逆——时间，成了最残酷的敌人。' },
  { title: '学派战争', category: '冲突', text: '当枯萎无法归咎于天，五大灵脉学派便开始互相指控是对方「窃取了灵脉」。猜忌很快点燃战火：炽焰庭要清算，凛霜堡要封锁，翠息林要守护残脉，冥暗渊在暗中交易，玄雷塔要订下铁律。战争不为疆土，而为「谁该为熄灭负责」。' },
  { title: '炽焰庭', category: '阵营', text: '炽焰庭是尚武的城邦，以高攻低防的爆发术著称，崇尚荣誉与直面对决。他们的火曾照亮半片大陆，也烧毁过自己人的退路。灵脉枯萎后，炽焰庭是最先喊出「清算」的学派。' },
  { title: '凛霜堡', category: '阵营', text: '凛霜堡是封闭的学术堡垒，理性而冷漠，以控制与减速/冰冻战术立身。高墙之内藏书如海，却也把人心一并封进了霜里。他们相信「秩序能熬过枯萎」，却不愿先向邻人伸出手。' },
  { title: '翠息林', category: '阵营', text: '翠息林是自然守护者的隐居地，以治疗、增益与地形优势见长。他们最早察觉枯萎，却最不愿以战止枯——在他们看来，护卫残脉比争夺责任更有意义。' },
  { title: '冥暗渊', category: '阵营', text: '冥暗渊藏在地下城邦，实用而隐秘，精于减益、暗杀与召唤。那里的人把秘密当货币，在学派战争的阴影里做着各方都不愿承认的交易。' },
  { title: '玄雷塔', category: '阵营', text: '玄雷塔由工匠与发明家筑成，以高机动、范围攻击与「科技型」灵械技能闻名。他们信奉秩序，试图用铁律把混乱的学派战争钉进框架——代价是，常把「对」凌驾于「人」之上。' },
  { title: '蚀教', category: '隐藏势力', text: '蚀教信奉禁忌的「蚀」之灵脉，认为灵脉本就该归于沉寂，而枯萎正是「净化」。他们渴望借枯萎之力重塑世界，把无序的自由收束为「唯一意志」。其首领，正是当年失踪的大魔导师·马尔佐斯。' },
  { title: '边陲之地', category: '地理', text: '边陲之地是大陆边缘的村落与枯黄草甸，灵脉在此最为纤细，却也最先感知到枯萎的寒意。这里的居民世代与土地讨生活，懂得在贫瘠里省着用每一缕灵脉——你正是从这里出发，带着一井将温未温的水，踏上寻找答案的路。' },
  { title: '学派战争前线', category: '地理', text: '学派战争前线横亘大陆中部，凛霜堡的冰墙、翠息林的藤垣与千年古都的废墟在此犬牙交错。这里没有固定的国界，只有昨日盟友、今日弩锋的反复；每一寸焦土下都埋着某学派不敢回首的名字。' },
  { title: '灵脉之源', category: '地理', text: '灵脉之源是五条主脉共同汇涌的心脏地带，传说灵能之潮正是从此处漫向全大陆。如今它却被幽蓝裂隙吞噬，灵脉在此逆向倒流——既是枯萎的源头，也是逆转枯萎、或许唯一可行的赌注之地。' },
  { title: '圣光教会', category: '阵营', text: '圣光教会并非五大灵脉学派之一，而是大陆上最庞大的民间信仰网络，尊奉「第一缕被灵脉点亮的微光」。它收容流离者、医治伤者，却也在某个时刻被部分人曲解为「审判之焰」。塞拉、加百列、奥菲皆出自此处，他们眼中的圣光，是灯，不是剑。' },
  { title: '初代灵脉者', category: '历史', text: '初代灵脉者是灵能之潮退去后第一批学会「借脉成形」的人。他们没有学派、没有师承，只在荒野里彼此试探着把涌动引成火、凝成霜。后世五大灵脉学派追认他们为先祖，却早已忘了他们当年最朴素的信条：灵脉是借来的，不是谁家的私产。' },
  { title: '枯井之誓', category: '历史', text: '灵脉枯萎初现时，边陲之地一口世代不竭的井忽然转温。村里的长者没有封井，而是围坐井边立下誓约：无论谁离开，都要把「火为何会熄灭」的答案带回来。这口井后来成了无数游子心里的坐标，也是艾拉始终替伊格尼斯守着的那汪温水。' },
  { title: '学派纪元', category: '历史', text: '学者将大陆史划分为「潮前蛮荒」「涌潮立城」「共生盛世」「枯萎纪」四个纪元。前三纪元以灵脉丰歉为名，第四纪元却以「失血」计量——当史官开始用枯萎的年轮丈量时间，便知一个时代真的走到了尽头。' },
  { title: '锻火术', category: '设定', text: '锻火术是炽焰庭的根本技艺，术士以意志为锤、以灵脉余烬为料，在掌心锻打无形的「火胚」。火胚越纯，火球越烈；但锻之过甚，火也会反噬持火之人。伊格尼斯便是被自己的火「烧得太旺」的那一个。' },
  { title: '霜典', category: '设定', text: '霜典是凛霜堡封藏千年的雷典旁支，记载着如何把涌动的灵脉「冻」成可计算的规条。霜典的信徒相信，只要把一切封进秩序，枯萎便无从侵蚀；却也因此把人心一并冻在了墙内，忘了墙外还有会落泪的学徒。' },
  { title: '翠语', category: '设定', text: '翠语是翠息林独有的、与草木交谈的古老语言。通晓者能听见藤蔓的渴、树根的惧，也能在林子枯死前先一步知晓。莫甘娜以翠语记下一处又一处将逝的绿，她说：记下名字，便不算真正失去。' },
  { title: '冥契', category: '设定', text: '冥契是冥暗渊通行的「契约之术」，以秘密为凭、以暗影为媒，在敌我之间穿针引线。它不创造力量，只交易力量；当世界都在下沉，冥契的价格也随信任一同贬值——维克最怕的，正是某天连秘密都换不来活路。' },
  { title: '灵械', category: '设定', text: '灵械是玄雷塔工匠将灵脉嵌进齿轮与铜管的造物，让雷不只是落下的审判，更是转动的引擎。玄雷塔的「科技型」灵械技能便源于此；托尔手中的天平，某种意义上也是一具被信仰校准过的灵械。' },
  { title: '天裂', category: '危机', text: '天裂是第一部终章之后骤然降临的异象：苍穹被无形之力撕开一道缝，光点如泪般坠向大地。它既不是灵脉的枯，也不是蚀教的蚀，而是某种「裂缝之外」的东西第一次伸手触碰维尔德兰——星渊走廊的故事，自此拉开。' },
  { title: '星渊走廊', category: '隐藏势力', text: '星渊走廊是天裂之后光点坠落之地，被灵脉碎片寄生的「星陨军团」在此集结。走廊幽长、两侧浮着未熄的星屑，尽头是吞纳一切的「星渊之喉」。它既是第一部终章的回声，也是第二部序曲的入口。' },
  { title: '星陨军团', category: '隐藏势力', text: '星陨军团是寄生在灵脉碎片上的畸变造物，它们没有故乡、没有记忆，只循着「吞噬灵脉」的本能集结成军。其将领多是被碎片改写过的旧日强者——星陨武士·凯恩便是其中之一，他残存的意志，仍在与寄生之物撕扯。' },
  { title: '虚无编织者', category: '隐藏势力', text: '虚无编织者是盘踞于星渊之喉的存在，它不杀生，只把灵脉一寸寸「抽空成线」，再织进一片没有痛苦、也没有选择的寂静里。它自称是枯萎的终点，也是安息——第二部终局，正指向与它的一战。' },
  { title: '星陨武士·凯恩', category: '人物', text: '凯恩曾是边陲之地一名普通的守井人，天裂之夜被星屑贯身，成了星陨军团的先锋。他偶尔会在战斗间隙想起那口井、想起自己曾发誓守护的村子；这份残存的清醒，让他在敌阵中时而出错，也让他成为可对话、而非可悯的敌人。' },
  { title: '世界树·余烬', category: '设定', text: '传说大陆中心曾有一株连通五脉的「世界树」，灵能之潮正从它的根须漫出。枯萎纪里世界树早已成炭，唯余一缕不灭的「余烬」藏于灵脉之源深处。有人说逆转枯萎的钥匙就在余烬里，也有人说，那只是后人舍不得熄灭的最后一点念想。' },
  { title: '灵脉学派历', category: '历史', text: '为调和各学派纪年之争，初代灵脉者留下了统一的「灵脉学派历」：以灵能之潮为元年，以共生盛世的丰脉为盛世，以枯萎初现为衰纪。如今学者翻看历书，多停在衰纪第几年那一行——再往后，无人敢写。' },
  { title: '审判之焰', category: '隐藏势力', text: '审判之焰是圣光教会内部崛起的激进派。它不认同塞拉一脉「灯是给人看的」的温和信条，主张以「净化之焰」焚尽一切未归顺者（他们称其为「余烬」），方能在大陆重燃前让世界归于澄澈。其名号取自古老的圣焰礼——本是用来温暖行路人的火，被他们改成了逼人跪下的火。' },
  { title: '余烬回响', category: '设定', text: '「余烬回响」是第三部对那段动荡的统称：当星渊之喉崩解、世界失去共同敌人，曾并肩的盟友便彼此举起了火把。审判之焰借焚毁各族灵脉，企图将全部灵脉之力收归教廷一人之手；而真正能熄灭火的，从来不是更大的火，是仍愿意抬头看光的那些人。' },
  { title: '蚀教真相', category: '隐藏势力', text: '世人以为蚀教只是马尔佐斯余党的狂信，真相却沉在更深的「裂缝之外」：所谓「蚀」，是灵脉在被彻底掐灭前，为保护自身而生的最后一道「自我吞噬」之脉。它不恶，只是求生——却因此把整片大陆认作「须被吞掉以自保」的一部分。崇拜它的，从不是疯子，而是被这道本能悄悄认作「同类」的灵能者。掌心的碎片，正是它失落的一半。' },
  { title: '蚀渊之母', category: '人物', text: '蚀渊之母·涅莎是蚀教真正的源头，比马尔佐斯、比审判之焰都更古旧。千年以前，她为了不让大陆在灵能之潮中焚尽，把自己劈成「守护」与「吞噬」两半——守护成了世人熟知、被五大学派借用的灵脉，吞噬则沉入裂缝之外，被后人恐惧地称作「蚀」。她从未想毁灭谁，只是想把「为什么偏偏是维尔德兰」这个答案，还给自己，也还给大陆。' },
  { title: '裂隙共生', category: '设定', text: '裂缝之外的事物并非全然敌对。最古旧的传说里，「守护」与「吞噬」本是同一道灵脉的两面，如同呼吸的吸与呼。当维尔德兰学会不再把「蚀」当成必须掐灭的病害，而是灵脉在危境中自我保护的一声喘息，大陆才真正与「裂缝之外」达成共生。掌心的碎片不再低语「注视」，而是学会了「同频」——那才是余烬真正该落的去处。' },
  { title: '门彼之侧', category: '隐藏势力', text: '「门彼之侧」是蚀渊之母·涅莎在真相之渊最深处守护的一道门后的世界。门内没有灵脉、也没有蚀，只有灵脉被劈成「守护」与「吞噬」两半之前，那道未被分割的源初之脉留下的回响。回响体们在此守了千年，把门当作盾、把来访者当作威胁。他们不知自己守护的，其实是一个迟迟不肯放手的「守护」之半——源初回响·厄科。门彼之侧并非敌人的领地，而是灵脉分裂那一瞬，被永远定格在「尚未分开」状态的一页残稿。' },
  { title: '回响之渊', category: '地理', text: '回响之渊是门彼之侧的核心，也是灵脉分裂之前的样貌：这里没有枯萎、没有蚀，只有尚未被撕开的源初回响在静静呼吸。渊心悬浮着源初回响·厄科，通体由纯粹的前分裂灵能织成。踏入渊中，会听见无数重叠的、尚未被写成不同学派咒文的灵能之声——那是「守护」与「吞噬」还同属一声叹息时的回声。传说只要把被涅莎归还的「吞噬」之半交还此处，这道灵脉便能第一次、也是最后一次真正合拢。' },
  { title: '源初回响', category: '人物', text: '源初回响·厄科是灵脉分裂之前、唯一的「守护」尚未交还世界的模样。它与蚀渊之母同源：千年以前，第一道灵脉为护大陆自劈两半，吞噬沉入裂缝之外、成为「蚀」；而「守护」那一千年的执念凝成了厄科——它把整道灵脉锁进回响之渊，以为守住便是爱，却因此变成了一扇不肯开的门。厄科不恶，只是太怕再失去。终局·回响之渊，它等待一个肯替它按下「放手」的人，好让被劈开千年的两半，终于在某人掌心重新相拥。' },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）新增百科 ——
  { title: '溯光者', category: '隐藏势力', text: '溯光者是灵脉分裂之前、那道尚未被劈成「守护」与「吞噬」的源初之脉留下的「守忆者」。他们不战斗、不吞噬，只负责把「世界曾经是一体的」这件事一遍遍复诵，以防后人忘记分裂之前的模样。源初之庭是他们的聚居地，庭中浮着未分裂的记忆；而溯光之冠·奥拉若，是第一个决定「把世界护下来」的灵能者，也是涅莎与厄科尚未分开时的共同前身。当两半终于在玩家掌心相拥，溯光者便从「守忆」，变成了「见证完满」的回响。' },
  { title: '灵能之潮（前史）', category: '历史', text: '「灵能之潮」被后世尊为赐礼，却少有人知它第一次漫上大陆时，几乎将幼弱的世界焚尽——五条主脉在同一瞬同时苏醒，灵能像失控的潮水互相冲撞，无数尚未命名的城邦在浪尖上沉浮。正是为了给大陆争取喘息，第一道灵脉（日后被称为涅莎、亦被称为厄科、被称为奥拉若的那一个）才把自己劈成两半：一半去安抚、一半去承受。所谓「灵能之潮」的温柔，其实是有人替整片大陆，先挨了那一记。这便是隐藏章节·第三卷「灵脉分裂前叙事」想要揭开的、比蚀教与回响都更古旧的真相。' },
  { title: '初晓之原', category: '地理', text: '初晓之原是灵脉分裂之前，大陆尚未被五脉划界的「第一片黎明」。这里没有学派、没有疆界，只有一道愿意为万物哼唱的源初之脉。溯光之冠·奥拉若便守在此处——她是第一个看见灵能之潮、也是第一个决定「护下世界」的灵能者。传说只要走进初晓之原，便能听见分裂之前、那首全员同唱的歌。隐藏章节·第三卷的终幕便在此落幕：玩家把被涅莎与厄科各自攥了千年的两半，连同奥拉若未及说出口的「第三种可能」，一并交还给这片最初的黎明。' },
  // —— 外传六/外传七（方向2 内容扩建）新增百科 ——
  { title: '锈铁佣兵团', category: '势力', text: '锈铁佣兵团是天裂之后涌现的「凡人武装」：他们毫无灵能，却靠缴获的灵械、弩炮与铁壁据守边陲商道，向过往旅人强征「过路灵税」。当魔法退潮、各学派自顾不暇，这群握枪的手反而成了最硬的墙——他们不信灵脉、只信铁与金，是裂缝之外最讽刺的威胁。其成员多是商道荒废后失了活路的脚夫与护商，队长·加尔臂上那枚褪色徽记，便是他们从「守路人」沦为「拦路人」的残痕。' },
  { title: '灰烬构装体', category: '设定', text: '灰烬构装体是玄雷塔以灵械术打造的「观测造物」，本用于监测灵脉律动、预警枯萎。可当观测台接收到的星光混入裂缝之外的低语，构装体的核心被悄然改写——它们不再预警，转而把经过的灵脉「抽空、献给主人」。织雷机偶·瑟拉与构装守卫·泰坦便是在此低语下失控，封锁山巅观测台。它们不是恶，只是被一句谎绊住、忘了自己原本在守护什么；所谓「灰烬」，是灵械之心被篡改后， residue 般残存的、对「指令」的执念。' },
];


// ===== data/bonds.js =====
// ============================================================
// Data: Bonds — 羁绊 / 好感度系统（方向3 系统新创 · Bond/Synergy）
// 说明：本文件定义「羁绊」数据层，是方向3（延长游戏时长的系统）中
//       继装备系统之后的第二项正式子系统。它把 PRODUCT.md 要求的
//       「角色间支援对话 / 互动事件」落地为可成长的数值关系：
//         - BOND_PAIRS：策划锁定的经典/圣光小队内羁绊组合（含原创支援对话）
//         - BOND_BONUS：羁绊等级 → 战前部署联动加成（仅作用于玩家单位、纯数值）
//         - 羁绊等级由玩家在主菜单「加深」累积，持久化于 saveData.bonds
//       设计约束：羁绊只改“部署时数值”，不新增任何技能/状态/AI 行为，方向1 冻结零触碰。
// ============================================================

// 羁绊等级标签（0=无 1=C 2=B 3=A）
const BOND_LEVEL_LABEL = {
  0: '无',
  1: 'C 级 · 初识',
  2: 'B 级 · 信赖',
  3: 'A 级 · 誓约',
};

// 羁绊等级 → 战前联动加成（hp/dmg，对每名“已部署的羁绊伙伴”叠加）
// 设计目标：幅度克制，避免破坏 balance-scan 的难度梯度（三档同享、相对关系不变）。
const BOND_BONUS = {
  1: { hp: 6,  dmg: 3  },
  2: { hp: 14, dmg: 7  },
  3: { hp: 24, dmg: 12 },
};

// 顺序无关的组合键：始终按字典序拼接，避免 A|B 与 B|A 被视为两条
function bondKey(a, b) {
  return [a, b].sort().join('|');
}

// 策划锁定的羁绊组合（全部为玩家小队内部配对）。
// talks 为长度 3 的数组：[C 级文案, B 级文案, A 级文案]，均为原创支援对话片段。
const BOND_PAIRS = [
  {
    a: '炎法师·艾拉', b: '熔岩剑士·戈伦',
    title: '火种与岩心',
    talks: [
      '艾拉：戈伦，你总在前面替我挡下那些暗影的爪牙。\n戈伦：（憨笑）火与岩本就一家，你点燃，我扛住——分内的事。',
      '戈伦：那天雪原上，若不是你烧穿了冰封的祭坛，我们谁也走不出第三关。\n艾拉：可若没有你把我从裂隙边拽回来，火早就灭了。我们是彼此的退路。',
      '艾拉：如果灵脉终将枯萎……至少还有人，会记得火该往哪儿烧。\n戈伦：记得就好。那我替你，把这条路，守到底。',
    ],
  },
  {
    a: '雷法师·特斯拉', b: '风行者·翠影',
    title: '电与风的协奏',
    talks: [
      '特斯拉：翠影，你总能比我先一步抵达敌后。\n翠影：因为风听得见你的雷声——它替我指了路。',
      '翠影：你的闪电太亮，常把我的影子出卖给敌人。\n特斯拉：那下次，我故意打偏半寸，给你留一道暗影的缝隙。',
      '特斯拉：若有一日雷云散尽，我便做你脚下最后一阵风。\n翠影：成交。我们一起，把光还给他们。',
    ],
  },
  {
    a: '暗法师·莫甘娜', b: '炎法师·艾拉',
    title: '暗与焰的共鸣',
    talks: [
      '莫甘娜：人人怕我的暗影，唯独你敢把火凑到近前。\n艾拉：暗里也藏着温度，我只是……比旁人更会找罢了。',
      '莫甘娜：我们俩，一个吞光、一个放光，本该相克。\n艾拉：可裂缝面前，没有光暗，只有同一条船。',
      '莫甘娜：若我坠回暗处，记得用你的火，把我拉回来一次。\n艾拉：一次不够，我就烧一百次——直到你肯回来。',
    ],
  },
  {
    a: '圣光祭司·塞拉', b: '圣堂守卫·加百列',
    title: '守护与治愈',
    talks: [
      '塞拉：加百列，你的盾后总留着一道缝，恰好够我探出手救治伤员。\n加百列：那道缝，是专门为你留的。',
      '加百列：圣堂的教条说，守卫先于祭司。\n塞拉：可我的教条说，没有祭司的守卫，只是一堵会倒的墙。',
      '塞拉：若圣光有尽头，我愿做你盾上最后一点余温。\n加百列：那我便做你永不熄灭的那盏灯。',
    ],
  },
  {
    a: '曙光射手·奥菲', b: '圣盾使·乌列尔',
    title: '远近的掩护',
    talks: [
      '奥菲：乌列尔，你总挡在我和箭矢之间。\n乌列尔：你的箭，比我这面盾更能终结战争——所以你值得被挡。',
      '乌列尔：我数过，你每场替队伍点掉七个敌人。\n奥菲：那是我替你省下的，七次举起盾的力气。',
      '奥菲：若曙光不再，我的箭便是你最后的防线。\n乌列尔：那我的盾，便是你永远的瞄点。',
    ],
  },
  {
    a: '曦光咏者·提娅', b: '圣光祭司·塞拉',
    title: '同门的咏唱',
    talks: [
      '提娅：塞拉姐姐，我的咏唱总比你慢半拍。\n塞拉：慢半拍，却正好接上我的尾音——我们本是一首歌的两段。',
      '提娅：师父说，曦光与圣光同源。我从前不信。\n塞拉：如今你信了？\n提娅：信了。因为你就在我旁边。',
      '塞拉：若咏唱能缝合这片大陆的裂痕，我愿你先开口。\n提娅：好。那我便唱，你和声——直到灵脉重新流动。',
    ],
  },
];


// ===== data/classchange.js =====
// ============================================================
// Data: Class Change — 转职 / 进阶系统（方向3 系统新创 · Class Change）
// 说明：本文件定义「转职」数据层，是方向3（延长游戏时长的系统）中
//       继装备系统、羁绊/好感度系统之后的第三项正式子系统。它把
//       PRODUCT.md 要求的「角色成长 / 转职」落地为可成长的战前决策：
//         - CLASS_CHANGE：转职门槛（成长等级）与进阶后的数值乘数
//         - CLASS_TITLE：每个玩家单位进阶后的原创职业名（纯文案）
//         - PROMOTED_SKILL：进阶后解锁的「1 个既有技能」——从 SKILL_DEFS
//           中重编组而来，**不定义任何新技能/状态/机制/AI**，方向1 冻结零触碰
//       设计约束：转职仅做"数值重分配 + 既有技能重编组"，延长单局/角色养成时长，
//       绝不影响核心战斗引擎（无新状态、无新 AI 行为、无新机制钩子）。
// ============================================================

// 转职门槛与进阶数值乘数（幅度克制，避免破坏 balance-scan 的难度梯度）
const CLASS_CHANGE = {
  minLevel: 5,   // 角色成长达到该等级方可转职（养成里程碑，延长游戏时长）
  hpMul: 1.20,   // 进阶后最大生命 ×1.2
  dmgMul: 1.10,  // 进阶后所有技能伤害 ×1.1
};

// 每个玩家单位进阶后的原创职业名（文案，仅展示）
const CLASS_TITLE = {
  '炎法师·艾拉': '炎息术师',
  '雷法师·特斯拉': '雷暴操纵者',
  '暗法师·莫甘娜': '虚蚀咏者',
  '风行者·翠影': '疾风游侠',
  '熔岩剑士·戈伦': '熔岩战将',
  '圣光祭司·塞拉': '圣辉主教',
  '圣堂守卫·加百列': '圣堂圣骑',
  '曙光射手·奥菲': '曙光神射手',
  '圣盾使·乌列尔': '永恒守盾',
  '曦光咏者·提娅': '曦光圣咏',
};

// 进阶后解锁的「1 个既有技能」——全部取自 SKILL_DEFS，按单位定位重编组。
// 不新增任何技能定义；仅把已存在的技能重新分配给进阶形态，达成「数值重分配」式成长。
const PROMOTED_SKILL = {
  '炎法师·艾拉': 'meteor',    // 进阶为范围 AoE 爆发
  '雷法师·特斯拉': 'blind',   // 进阶补足控制（致盲削弱敌方输出）
  '暗法师·莫甘娜': 'shadowbolt', // 进阶补足稳定单体输出
  '风行者·翠影': 'drain',     // 进阶补足续航（汲取自疗）
  '熔岩剑士·戈伦': 'burn',    // 进阶补足持续灼烧
  '圣光祭司·塞拉': 'shield',  // 进阶补足护盾保护
  '圣堂守卫·加百列': 'taunt', // 进阶补足坦克引流
  '曙光射手·奥菲': 'blind',   // 进阶补足控制
  '圣盾使·乌列尔': 'shield',  // 进阶补足护盾保护
  '曦光咏者·提娅': 'empower', // 进阶补足进攻增益
};


// ===== core/state.js =====
// ============================================================
// Core: State — 运行时游戏状态变量
// ============================================================

let canvas, ctx;
let staticCanvas = null, staticCtx = null, staticMapId = null;
let staticRebuilds = 0;
let units = [];
let selectedUnit = null;
let phase = 'selectUnit';
let turnNum = 1;
let floaters = [];
let playerTurnIndex = 0;
let moveHighlightCells = [];
let attackHighlightCells = [];
let logs = [];
let activeSkill = null;
let saveData = {
  wins: 0, losses: 0, unlockedLevel: 1, achievements: [],
  winStreak: 0, alignmentScore: 0, storyChoices: {},
  endings: [], growth: {}, levelStars: {}, equip: {}, bonds: {},
};
let currentMap = null;
let gameMode = null;
let currentCampaignLevel = 0;
let currentSideStory = 0;
let currentHidden = 0;
let difficulty = 'normal';
let selectedPlayerFaction = 'classic';

// 战斗运行时标记
let battleScored = false;
let battleUnlocked = [];
let lastResult = null;
let lastStory = null;
let battleTauntUsed = false;
let battleHadBoss = false;

// 测试辅助：直接设置指定名称单位的位置（仅测试用；gy 可选，null 则只改 gx）
function _testSetUnitPos(name, gx, gy) {
  const u = units.find(u => u.name === name);
  if (u) { u.gx = gx; if (gy !== null && gy !== undefined) u.gy = gy; }
}


// ===== systems/utils.js =====
// ============================================================
// Systems: Utils — 坐标工具、辅助函数
// ============================================================

function cellToPixel(gx, gy) { return { x: gx * CELL, y: gy * CELL }; }
function pixelToCell(px, py) { return { gx: Math.floor(px / CELL), gy: Math.floor(py / CELL) }; }
function cellDist(a, b) { return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy); }
function cellDistPt(gx1, gy1, gx2, gy2) { return Math.abs(gx1 - gx2) + Math.abs(gy1 - gy2); }
function getUnitAt(gx, gy) { return units.find(u => u.gx === gx && u.gy === gy && u.hp > 0); }
// 地形委派（方向5 地图系统升级）：cover/hazard 现由地形矩阵统一提供；
// 旧地图经 parseMapTiles 自动升迁后行为完全一致（cover 仍-30%受伤 / hazard 仍+8伤害·回合）。
function coverAt(gx, gy) { return isCoverAt(gx, gy); }
function hazardAt(gx, gy) { return getTileHazardDmg(gx, gy) > 0; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pushFloater(gx, gy, text, kind) {
  floaters.push({ gx, gy, text, kind: kind || 'damage', life: 30 });
}


// ===== core/unit-factory.js =====
// ============================================================
// Core: Unit Factory — 创建单位（含难度缩放 + 成长 + 装备）
// ============================================================

// 由 SKILL_DEFS 构建一个技能实例（与 createUnit 基础技能同一映射规则）
function buildSkillInstance(sk, dmgMul) {
  const base = SKILL_DEFS[sk];
  return {
    ...base,
    key: sk, cd: 0,
    dmg: Math.round(base.dmg * dmgMul),
    burnDmg: base.burnDmg ? Math.round(base.burnDmg * dmgMul) : 0,
    poisonDmg: base.poisonDmg ? Math.round(base.poisonDmg * dmgMul) : 0,
  };
}

function createUnit(def, team, gx, gy) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const hpMul = team === 'enemy' ? d.hpMul : 1;
  const dmgMul = team === 'enemy' ? d.dmgMul : 1;
  // 基础技能列表
  const skills = def.skills.map(s => buildSkillInstance(s, dmgMul));
  // 转职系统（方向3 系统新创）：已转职玩家单位追加 1 个「既有技能」（从 SKILL_DEFS 重编组，
  // 不定义任何新技能/状态/机制，方向1 冻结零触碰）。该技能随后一并享受成长/装备加成。
  const promoted = !!(team === 'player' && saveData.classes && saveData.classes[def.name]);
  if (promoted) {
    const pk = PROMOTED_SKILL[def.name];
    if (pk && SKILL_DEFS[pk] && !def.skills.includes(pk)) {
      skills.push(buildSkillInstance(pk, dmgMul));
    }
  }
  const maxHp = Math.max(1, Math.round(def.maxHp * hpMul));
  const u = {
    id: `${team}_${gx}_${gy}`,
    name: def.name,
    team,
    faction: def.faction || null,
    isBoss: !!def.isBoss,
    maxHp,
    hp: maxHp,
    moveRange: def.moveRange,
    skills,
    gx, gy,
    color: def.color,
    unitType: def.unitType || null,
    acted: false,
    stunned: false,
    burnTurns: 0, burnDmg: 0,
    frozenTurns: 0,
    poisonTurns: 0, poisonDmg: 0,
    blindTurns: 0,
    silenceTurns: 0,
    vulnTurns: 0,
    tauntTurns: 0, taunterId: null,
    fearTurns: 0,
    shield: 0, shieldTurns: 0,
    empowerTurns: 0,
    growthLevel: 1,
    growthExp: 0,
  };
  // 角色成长：仅战役模式对玩家单位生效
  if (team === 'player' && gameMode === 'campaign') {
    const g = (saveData.growth && saveData.growth[def.name]) || { exp: 0, level: 1 };
    const lv = g.level || 1;
    u.growthLevel = lv;
    u.growthExp = g.exp || 0;
    if (lv > 1) {
      const bonusHp = (lv - 1) * GROWTH.hpPerLevel;
      const bonusDmg = (lv - 1) * GROWTH.dmgPerLevel;
      u.maxHp += bonusHp;
      u.hp = u.maxHp;
      u.skills.forEach(s => {
        s.dmg += bonusDmg;
        if (s.burnDmg) s.burnDmg += bonusDmg;
        if (s.poisonDmg) s.poisonDmg += bonusDmg;
      });
    }
  }
  // 装备系统：部署期为玩家单位叠加装备加成
  if (team === 'player') {
    const eqId = (saveData.equip && saveData.equip[def.name]) || null;
    const eq = eqId ? EQUIPMENT[eqId] : null;
    if (eq) {
      if (eq.hp) { u.maxHp += eq.hp; u.hp = u.maxHp; }
      if (eq.dmg) {
        u.skills.forEach(s => {
          s.dmg += eq.dmg;
          if (s.burnDmg) s.burnDmg += eq.dmg;
          if (s.poisonDmg) s.poisonDmg += eq.dmg;
        });
      }
    }
  }
  // 转职系统（方向3 系统新创）：已转职玩家单位叠加进阶数值乘数（HP/伤害）。
  // 仅作用于玩家单位；默认 classes 为空（既有测试与平衡自检）时无任何加成。
  if (promoted) {
    u.maxHp = Math.max(1, Math.round(u.maxHp * CLASS_CHANGE.hpMul));
    u.hp = u.maxHp;
    u.skills.forEach(s => {
      s.dmg = Math.round(s.dmg * CLASS_CHANGE.dmgMul);
      if (s.burnDmg) s.burnDmg = Math.round(s.burnDmg * CLASS_CHANGE.dmgMul);
      if (s.poisonDmg) s.poisonDmg = Math.round(s.poisonDmg * CLASS_CHANGE.dmgMul);
    });
  }
  return u;
}

// 羁绊 / 好感度系统（方向3 系统新创）：战斗开始时，为同场部署的玩家单位
// 叠加“已缔结羁绊伙伴”的战前联动加成。纯数值、零战斗逻辑改动、方向1 冻结零触碰。
// 仅作用于玩家单位；bonds 为空（默认 / 所有既有测试与平衡自检）时无任何加成。
function applyBondSynergy() {
  const players = units.filter(u => u.team === 'player');
  players.forEach(u => {
    let bonusHp = 0, bonusDmg = 0;
    players.forEach(v => {
      if (v === u) return;
      const key = bondKey(u.name, v.name);
      const lv = (saveData.bonds && saveData.bonds[key]) || 0;
      if (lv >= 1 && BOND_BONUS[lv]) {
        bonusHp += BOND_BONUS[lv].hp;
        bonusDmg += BOND_BONUS[lv].dmg;
      }
    });
    if (bonusHp) { u.maxHp += bonusHp; u.hp += bonusHp; }
    if (bonusDmg) {
      u.skills.forEach(s => {
        s.dmg += bonusDmg;
        if (s.burnDmg) s.burnDmg += bonusDmg;
        if (s.poisonDmg) s.poisonDmg += bonusDmg;
      });
    }
  });
}


// ===== core/combat.js =====
// ============================================================
// Core: Combat — 伤害系统 & 技能应用
// ============================================================

// 兵种克制纯函数（方向2 Phase 1）：攻方兵种克制守方兵种时返回 COUNTER_BONUS，否则 1。
// 仅用于伤害放大；奶为中立单位（不参与克制循环，也不被克制）。供测试与 UI 复用。
function counterMult(attType, tgtType) {
  if (!attType || !tgtType) return 1;
  return COUNTERS[attType] === tgtType ? COUNTER_BONUS : 1;
}

function damageUnit(target, dmg, attacker) {
  let actual = dmg;
  if (attacker && attacker.blindTurns > 0) actual = Math.floor(actual * 0.5);
  if (attacker && attacker.empowerTurns > 0) actual = Math.floor(actual * (1 + EMPOWER_AMP));
  // 兵种克制：攻方克制守方 → 伤害放大并飘字提示（方向2 Phase 1 · 决策深度）
  if (attacker && attacker.unitType && target.unitType &&
      counterMult(attacker.unitType, target.unitType) > 1) {
    actual = Math.floor(actual * COUNTER_BONUS);
    pushFloater(target.gx, target.gy, '克制!', 'counter');
  }
  if (coverAt(target.gx, target.gy)) actual = Math.floor(actual * COVER_REDUCE);
  // 高地加成（方向5 地图系统升级 · 高地系统）：攻击者立于高地且目标不在高地 → 伤害 +20%（高打低）
  if (attacker && attacker.gx !== undefined && isHighAt(attacker.gx, attacker.gy) && !isHighAt(target.gx, target.gy)) {
    actual = Math.floor(actual * 1.2);
  }
  if (target.vulnTurns > 0) actual = Math.floor(actual * (1 + VULN_AMP));
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, actual);
    target.shield -= absorbed;
    actual -= absorbed;
    if (absorbed > 0) pushFloater(target.gx, target.gy, '盾' + absorbed, 'shield');
  }
  target.hp -= actual;
  if (actual > 0) pushFloater(target.gx, target.gy, '-' + actual, 'damage');
  return actual;
}

function applySkill(attacker, gx, gy, skill) {
  // 治愈术
  if (skill.isHeal) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team !== attacker.team) return;
    const healAmt = Math.abs(skill.dmg);
    let actualHeal = healAmt;
    let poisonNote = '';
    if (t.poisonTurns > 0) {
      actualHeal = Math.floor(healAmt / 2);
      poisonNote = '（中毒·治疗减半）';
    }
    t.hp = Math.min(t.maxHp, t.hp + actualHeal);
    pushFloater(t.gx, t.gy, '+' + actualHeal, 'heal');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，回复 ${actualHeal} HP${poisonNote}`, 'heal');
    skill.cd = skill.cooldown;
    return;
  }
  // 眩晕
  if (skill.isStun) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    t.stunned = true;
    pushFloater(t.gx, t.gy, '眩晕', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标下回合将被眩晕`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 灼烧 DoT
  if (skill.isBurn) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    t.burnTurns = Math.min(t.burnTurns + skill.burnTurns, 4);
    t.burnDmg = Math.max(t.burnDmg, skill.burnDmg);
    pushFloater(t.gx, t.gy, '灼烧', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标被点燃（剩余 ${t.burnTurns} 回合）`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 冰冻
  if (skill.isFreeze) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    const dealt = damageUnit(t, skill.dmg, attacker);
    t.frozenTurns = Math.max(t.frozenTurns, skill.freezeTurns);
    pushFloater(t.gx, t.gy, '冰冻', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，造成 ${dealt} 伤害并使其被冰冻`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 中毒 DoT
  if (skill.isPoison) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    const dealt = damageUnit(t, skill.dmg);
    t.poisonTurns = skill.poisonTurns;
    t.poisonDmg = Math.min(t.poisonDmg + skill.poisonDmg, skill.poisonMax);
    pushFloater(t.gx, t.gy, '中毒', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，造成 ${dealt} 直接伤害并使其中毒`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 致盲
  if (skill.isBlind) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    t.blindTurns = Math.max(t.blindTurns, skill.blindTurns);
    pushFloater(t.gx, t.gy, '致盲', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标被致盲`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 沉默
  if (skill.isSilence) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    t.silenceTurns = Math.max(t.silenceTurns, skill.silenceTurns);
    pushFloater(t.gx, t.gy, '沉默', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标被沉默`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 嘲讽
  if (skill.isTaunt) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    if (attacker.team === 'player') battleTauntUsed = true;
    t.tauntTurns = Math.max(t.tauntTurns, skill.tauntTurns);
    t.taunterId = attacker.id;
    pushFloater(t.gx, t.gy, '嘲讽', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，嘲讽成功`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 易伤
  if (skill.isVuln) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    t.vulnTurns = Math.max(t.vulnTurns, skill.vulnTurns);
    pushFloater(t.gx, t.gy, '易伤', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标被易伤`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 恐惧
  if (skill.isFear) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    t.fearTurns = Math.max(t.fearTurns, skill.fearTurns);
    pushFloater(t.gx, t.gy, '恐惧', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标陷入恐惧`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 护盾
  if (skill.isShield) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team !== attacker.team) { skill.cd = 0; return; }
    t.shield = Math.max(t.shield, skill.shieldAmount);
    t.shieldTurns = Math.max(t.shieldTurns, skill.shieldTurns);
    pushFloater(t.gx, t.gy, '护盾', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，附加 ${skill.shieldAmount} 点护盾`, 'heal');
    skill.cd = skill.cooldown;
    return;
  }
  // 拉拽
  if (skill.isPull) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team === attacker.team) { skill.cd = 0; return; }
    const range = skill.pullRange || 2;
    let cx = t.gx, cy = t.gy;
    for (let step = 0; step < range; step++) {
      const adx = Math.abs(attacker.gx - cx), ady = Math.abs(attacker.gy - cy);
      if (adx === 0 && ady === 0) break;
      let nx = cx, ny = cy;
      if (adx >= ady && attacker.gx !== cx) nx = cx + Math.sign(attacker.gx - cx);
      else if (attacker.gy !== cy) ny = cy + Math.sign(attacker.gy - cy);
      else if (attacker.gx !== cx) nx = cx + Math.sign(attacker.gx - cx);
      if (nx === attacker.gx && ny === attacker.gy) break;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) break;
      if (getUnitAt(nx, ny)) break;
      cx = nx; cy = ny;
    }
    const moved = (cx !== t.gx || cy !== t.gy);
    const dist = Math.abs(t.gx - cx) + Math.abs(t.gy - cy);
    t.gx = cx; t.gy = cy;
    pushFloater(t.gx, t.gy, '拉拽', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，将其拉近 ${moved ? dist + ' 格' : '（已在身边）'}`, 'damage');
    skill.cd = skill.cooldown;
    return;
  }
  // 强化
  if (skill.isEmpower) {
    const t = getUnitAt(gx, gy);
    if (!t || t.team !== attacker.team) { skill.cd = 0; return; }
    t.empowerTurns = Math.max(t.empowerTurns, skill.empowerTurns);
    pushFloater(t.gx, t.gy, '强化', 'status');
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标被强化`, 'heal');
    skill.cd = skill.cooldown;
    return;
  }
  // 范围伤害 (AoE)
  if (skill.aoeRadius > 0) {
    const hits = units.filter(u => u.hp > 0 && u.team !== attacker.team && cellDistPt(u.gx, u.gy, gx, gy) <= skill.aoeRadius);
    if (hits.length === 0) {
      addLog(`${attacker.name} 对 (${gx},${gy}) 施放 ${skill.name}，未命中任何敌方单位`, 'info');
    } else {
      hits.forEach(t => {
        const dealt = damageUnit(t, skill.dmg, attacker);
        addLog(`${attacker.name} 的 ${skill.name} 波及 ${t.name}，造成 ${dealt} 伤害`, 'damage');
      });
      if (skill.selfHeal) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + skill.selfHeal);
        addLog(`${attacker.name} 汲取回复 ${skill.selfHeal} HP`, 'heal');
      }
    }
    skill.cd = skill.cooldown;
    return;
  }
  // 单体伤害
  const t = getUnitAt(gx, gy);
  if (!t) {
    addLog(`${attacker.name} 对 (${gx},${gy}) 施放 ${skill.name}，无目标`, 'info');
    skill.cd = skill.cooldown;
    return;
  }
  const dealt = damageUnit(t, skill.dmg, attacker);
  addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，造成 ${dealt} 伤害`, 'damage');
  if (skill.selfHeal) {
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + skill.selfHeal);
    addLog(`${attacker.name} 汲取回复 ${skill.selfHeal} HP`, 'heal');
  }
  skill.cd = skill.cooldown;
}


// ===== core/turn.js =====
// ============================================================
// Core: Turn — 回合管理、胜负判定、战役进度
// ============================================================

function startBattle(setup) {
  currentMap = MAPS[setup.map];
  setActiveTerrain(parseMapTiles(currentMap)); // 方向5 地图系统升级：加载当前地图地形矩阵（旧地图自动兼容）
  units = [];
  selectedUnit = null;
  phase = 'selectUnit';
  turnNum = 1;
  playerTurnIndex = 0;
  moveHighlightCells = [];
  attackHighlightCells = [];
  activeSkill = null;
  logs = [];
  battleScored = false;
  battleUnlocked = [];
  lastResult = null;
  battleTauntUsed = false;
  battleHadBoss = setup.enemies.some(r => r.src === 'boss');
  const logEl = document.getElementById('log-content');
  if (logEl) logEl.innerHTML = '';
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  squad.forEach((def, i) => units.push(createUnit(def, 'player', 1, i * 2 + 1)));
  applyBondSynergy(); // 羁绊 / 好感度系统（方向3）：同场玩家单位的战前联动加成
  setup.enemies.forEach((ref, i) => {
    const def = ref.src === 'boss' ? BOSS_UNITS[ref.i] : ENEMY_UNITS[ref.i];
    units.push(createUnit(def, 'enemy', GRID_W - 2, i * 2 + 1));
  });
  updateUI();
  updateBattlePrediction();
  render();
}

function endTurn() {
  units.filter(u => u.team === 'player' && u.hp > 0 && !u.acted).forEach(u => {
    u.acted = true;
    addLog(`${u.name} 未行动，自动跳过`, 'info');
  });
  selectedUnit = null;
  moveHighlightCells = [];
  attackHighlightCells = [];
  activeSkill = null;
  phase = 'enemyTurn';
  updateUI();
  render();
  setTimeout(() => executeEnemyTurn(), 500);
}

function nextTurn() {
  turnNum++;
  units.forEach(u => {
    u.acted = false;
    u.skills.forEach(s => { if (s.cd > 0) s.cd--; });
    if (u.burnTurns > 0) {
      const d = u.burnDmg;
      u.hp -= d;
      u.burnTurns--;
      pushFloater(u.gx, u.gy, '燃' + d, 'burn');
      addLog(`${u.name} 受到燃烧伤害 ${d}`, 'damage');
    }
    if (u.poisonTurns > 0) {
      const d = u.poisonDmg;
      u.hp -= d;
      u.poisonTurns--;
      pushFloater(u.gx, u.gy, '毒' + d, 'poison');
      addLog(`${u.name} 受到毒性伤害 ${d}`, 'damage');
    }
    if (u.blindTurns > 0) { u.blindTurns--; if (u.blindTurns === 0) addLog(`${u.name} 致盲解除，伤害恢复`, 'info'); }
    if (u.silenceTurns > 0) { u.silenceTurns--; if (u.silenceTurns === 0) addLog(`${u.name} 沉默解除，可再次施法`, 'info'); }
    if (u.frozenTurns > 0) { u.frozenTurns--; if (u.frozenTurns === 0) addLog(`${u.name} 冰冻解除，可再次移动`, 'info'); }
    if (u.tauntTurns > 0) { u.tauntTurns--; if (u.tauntTurns === 0) { u.taunterId = null; addLog(`${u.name} 嘲讽解除`, 'info'); } }
    if (u.vulnTurns > 0) { u.vulnTurns--; if (u.vulnTurns === 0) addLog(`${u.name} 易伤解除`, 'info'); }
    if (u.fearTurns > 0) { u.fearTurns--; if (u.fearTurns === 0) addLog(`${u.name} 恐惧解除，恢复行动`, 'info'); }
    if (u.shieldTurns > 0) { u.shieldTurns--; if (u.shieldTurns === 0) { u.shield = 0; addLog(`${u.name} 护盾消散`, 'info'); } }
    if (u.empowerTurns > 0) { u.empowerTurns--; if (u.empowerTurns === 0) addLog(`${u.name} 强化解除`, 'info'); }
    if (u.hp > 0 && hazardAt(u.gx, u.gy)) {
      const hd = getTileHazardDmg(u.gx, u.gy);
      u.hp -= hd;
      pushFloater(u.gx, u.gy, '危' + hd, 'hazard');
      addLog(`${u.name} 处于危险格，受到 ${hd} 点环境伤害`, 'damage');
    }
  });
  checkGameEnd();
  if (phase === 'gameOver') { updateUI(); render(); return; }
  phase = 'selectUnit';
  selectedUnit = null;
  moveHighlightCells = [];
  attackHighlightCells = [];
  addLog(`— 回合 ${turnNum} 开始 —`, 'info');
  updateUI();
  render();
}

function checkGameEnd() {
  const playerAlive = units.filter(u => u.team === 'player' && u.hp > 0).length;
  const enemyAlive = units.filter(u => u.team === 'enemy' && u.hp > 0).length;
  if (playerAlive === 0) {
    phase = 'gameOver';
    saveData.losses++;
    saveData.winStreak = 0;
    saveSave();
    addLog('【战斗结束】玩家失败', 'damage');
    lastResult = {
      result: 'lose', turns: turnNum,
      survivors: units.filter(u => u.team === 'player' && u.hp > 0).map(u => u.name),
      unlocked: [],
    };
    if (gameMode === 'campaign') setOverlayAction('重试本关', `Game.startCampaign(${currentCampaignLevel})`);
    else if (gameMode === 'sidestory') setOverlayAction('重试外传', `Game.startSideStory(${currentSideStory})`);
    else if (gameMode === 'hidden') setOverlayAction('重试隐藏章节', `Game.startHidden(${currentHidden})`);
    else setOverlayAction('再来一局', 'Game.startSkirmish()');
    showOverlay('战斗失败', '你的法师小队已全军覆没...');
  } else if (enemyAlive === 0) {
    phase = 'gameOver';
    saveData.wins++;
    if (!battleScored) {
      battleScored = true;
      unlockAchievement('first_win');
      const pAlive = units.filter(u => u.team === 'player' && u.hp > 0);
      const squadSize = PLAYER_SQUADS[selectedPlayerFaction] ? PLAYER_SQUADS[selectedPlayerFaction].length : PLAYER_UNITS.length;
      if (pAlive.length === squadSize) unlockAchievement('flawless');
      if (battleHadBoss) unlockAchievement('boss_slayer');
      if (battleTauntUsed) unlockAchievement('taunter');
      if (gameMode === 'campaign' && currentCampaignLevel === CAMPAIGN.length) unlockAchievement('campaign_clear');
      saveData.winStreak = (saveData.winStreak || 0) + 1;
      if (saveData.winStreak >= 3) unlockAchievement('streak3');
      if (gameMode === 'campaign') {
        const kills = units.filter(u => u.team === 'enemy').length;
        const gain = GROWTH.expPerWin + kills * GROWTH.expPerKill;
        units.filter(u => u.team === 'player').forEach(u => {
          const g = saveData.growth[u.name] || { exp: 0, level: 1 };
          g.exp = (g.exp || 0) + gain;
          while (g.level < GROWTH.maxLevel && g.exp >= GROWTH.expPerLevel) {
            g.exp -= GROWTH.expPerLevel;
            g.level++;
          }
          if (g.level >= GROWTH.maxLevel) g.exp = Math.min(g.exp, GROWTH.expPerLevel);
          saveData.growth[u.name] = g;
        });
      }
      saveSave();
    }
    const msg = '敌方已被全部消灭！';
    addLog('【战斗结束】玩家胜利', 'heal');
    lastResult = {
      result: 'win', turns: turnNum,
      survivors: units.filter(u => u.team === 'player' && u.hp > 0).map(u => u.name),
      unlocked: battleUnlocked.slice(),
    };
    if (gameMode === 'sidestory') {
      const sc = SIDE_STORIES[currentSideStory];
      saveData.sideCleared = saveData.sideCleared || {};
      if (!saveData.sideCleared[currentSideStory]) saveData.sideCleared[currentSideStory] = true;
      saveSave();
      if (sc && sc.closing) {
        showStory(`${sc.title} · 通关`, sc.closing + '\n\n— 外传已收录于你的战史 —', '🎉 返回主菜单', 'Game.showMenu()');
      } else {
        setOverlayAction('🎉 返回主菜单', 'Game.showMenu()');
        showOverlay('战斗胜利', msg);
      }
    } else if (gameMode === 'hidden') {
      const hc = HIDDEN_CHAPTERS[currentHidden];
      saveData.hiddenCleared = saveData.hiddenCleared || {};
      if (!saveData.hiddenCleared[currentHidden]) saveData.hiddenCleared[currentHidden] = true;
      saveSave();
      if (hc && hc.closing) {
        showStory(`${hc.title} · 通关`, hc.closing + '\n\n— 隐藏章节已收录于你的战史 —', '🎉 返回主菜单', 'Game.showMenu()');
      } else {
        setOverlayAction('🎉 返回主菜单', 'Game.showMenu()');
        showOverlay('战斗胜利', msg);
      }
    } else if (gameMode === 'campaign') {
      const sc = lastResult.survivors.length;
      const stars = sc >= 6 ? 3 : (sc >= 4 ? 2 : 1);
      lastResult.stars = stars;
      saveData.levelStars = saveData.levelStars || {};
      saveData.levelStars[currentCampaignLevel] = Math.max(saveData.levelStars[currentCampaignLevel] || 0, stars);
      saveSave();
    }
    if (gameMode === 'campaign') {
      const c = CAMPAIGN[currentCampaignLevel - 1];
      const story = CHAPTER_STORY[currentCampaignLevel];
      if (CAMPAIGN_CHOICES[currentCampaignLevel] && !(saveData.storyChoices && saveData.storyChoices[currentCampaignLevel])) {
        showChoice(currentCampaignLevel);
        return;
      }
      if (currentCampaignLevel < CAMPAIGN.length) {
        saveData.unlockedLevel = Math.max(saveData.unlockedLevel || 1, currentCampaignLevel + 1);
        saveSave();
        if (story && story.closing) {
          showStory(`${c.name} · 胜利`, story.closing + '\n\n— 战役进度已向前推进 —', '进入下一关 ▶', `Game.startCampaign(${currentCampaignLevel + 1})`);
        } else {
          setOverlayAction('进入下一关 ▶', `Game.startCampaign(${currentCampaignLevel + 1})`);
          showOverlay('战斗胜利', '已解锁下一关！');
        }
      } else {
        const endingId = getEndingId();
        saveData.endings = saveData.endings || [];
        if (!saveData.endings.includes(endingId)) { saveData.endings.push(endingId); saveSave(); }
        const ending = ENDINGS[endingId];
        if (ending) {
          showStory('终章 · ' + ending.title, ending.text + '\n\n（战役通关 · 感谢游玩）', '🎉 返回主菜单', 'Game.showMenu()');
        } else {
          setOverlayAction('🎉 返回主菜单', 'Game.showMenu()');
          showOverlay('战斗胜利', '恭喜通关全部战役！');
        }
      }
    } else {
      setOverlayAction('再来一局', 'Game.startSkirmish()');
      showOverlay('战斗胜利', msg);
    }
  }
}


// ===== core/ai.js =====
// ============================================================
// Core: AI — 敌方 AI 决策
// ============================================================

function sortedAttackSkills(unit, style) {
  const list = unit.skills.filter(s => s.cd <= 0 && !s.isHeal && !s.isBlind && !s.isShield && !s.isSilence && !s.isVuln && !s.isTaunt && !s.isFear && !s.isPull && !s.isEmpower);
  if (style === 'skirmish') {
    const ctrl = s => (s.isStun ? 1 : 0) + (s.isFreeze ? 1 : 0) + (s.isPoison ? 1 : 0);
    return list.sort((a, b) => ctrl(b) - ctrl(a) || b.dmg - a.dmg);
  }
  return list.sort((a, b) => b.dmg - a.dmg);
}

function executeEnemyTurn() {
  const enemies = units.filter(u => u.team === 'enemy' && u.hp > 0);
  let delay = 0;
  enemies.forEach(e => {
    delay += 400;
    setTimeout(() => {
      if (e.stunned) {
        e.stunned = false;
        addLog(`${e.name} 被眩晕，跳过本回合行动`, 'info');
      } else {
        aiDecide(e);
      }
      checkGameEnd();
      render();
      updateUI();
    }, delay);
  });
  setTimeout(() => {
    if (phase !== 'gameOver') {
      nextTurn();
    }
  }, delay + 300);
}

function aiDecide(unit) {
  const targets = units.filter(u => u.team === 'player' && u.hp > 0);
  if (targets.length === 0) { unit.acted = true; return; }

  let tauntTarget = null;
  if (unit.tauntTurns > 0 && unit.taunterId) {
    tauntTarget = units.find(u => u.id === unit.taunterId && u.team === 'player' && u.hp > 0) || null;
  }
  const atkTargets = tauntTarget ? [tauntTarget] : targets;

  const style = (unit.faction && FACTIONS[unit.faction]) ? FACTIONS[unit.faction].aiStyle : 'aggressive';
  const healThreshold = style === 'defensive' ? 0.6 : (style === 'support' ? 0.5 : 0.4);
  const hpRatio = unit.hp / unit.maxHp;
  const canCast = unit.silenceTurns <= 0;

  // 1. 自保治疗
  if (canCast && hpRatio < healThreshold) {
    const healSkill = unit.skills.find(s => s.cd <= 0 && s.isHeal);
    if (healSkill) {
      const healAmt = Math.abs(healSkill.dmg);
      let actualHeal = healAmt;
      if (unit.poisonTurns > 0) actualHeal = Math.floor(healAmt / 2);
      unit.hp = Math.min(unit.maxHp, unit.hp + actualHeal);
      healSkill.cd = healSkill.cooldown;
      addLog(`${unit.name} 施放 ${healSkill.name}，回复 ${actualHeal} HP${unit.poisonTurns > 0 ? '（中毒·治疗减半）' : ''}`, 'heal');
      unit.acted = true;
      return;
    }
  }

  // 2. 攻击技能
  if (canCast) {
    const attackSkills = sortedAttackSkills(unit, style);
    for (const skill of attackSkills) {
      const inRange = atkTargets.filter(t => cellDist(unit, t) <= skill.range);
      if (inRange.length > 0) {
        const target = inRange.sort((a, b) => a.hp - b.hp)[0];
        applySkill(unit, target.gx, target.gy, skill);
        unit.acted = true;
        return;
      }
    }
  }

  // 3. 移动
  let moveCells = [];
  if (unit.frozenTurns <= 0) {
    const closest = tauntTarget || targets.sort((a, b) => cellDist(unit, a) - cellDist(unit, b))[0];
    const feared = unit.fearTurns > 0 && !tauntTarget;
    moveCells = getMoveCells(unit);
    if (moveCells.length > 0) {
      let bestCell;
      if (feared) {
        bestCell = moveCells.sort((a, b) =>
          cellDistPt(b.gx, b.gy, closest.gx, closest.gy) - cellDistPt(a.gx, a.gy, closest.gx, closest.gy)
        )[0];
        addLog(`${unit.name} 陷入恐惧，恐慌撤退`, 'info');
      } else {
        bestCell = moveCells.sort((a, b) =>
          cellDistPt(a.gx, a.gy, closest.gx, closest.gy) - cellDistPt(b.gx, b.gy, closest.gx, closest.gy)
        )[0];
        if (style === 'defensive' || style === 'skirmish') {
          const coverCells = moveCells.filter(c => coverAt(c.gx, c.gy));
          if (coverCells.length > 0) {
            bestCell = coverCells.sort((a, b) =>
              cellDistPt(a.gx, a.gy, closest.gx, closest.gy) - cellDistPt(b.gx, b.gy, closest.gx, closest.gy)
            )[0];
          }
        }
      }
      addLog(`${unit.name} 移动到 (${bestCell.gx},${bestCell.gy})`, 'move');
      unit.gx = bestCell.gx;
      unit.gy = bestCell.gy;
    }
  }

  // 4. 移动后攻击
  if (canCast) {
    const skillsAfterMove = sortedAttackSkills(unit, style);
    for (const skill of skillsAfterMove) {
      const inRange = atkTargets.filter(t => cellDist(unit, t) <= skill.range);
      if (inRange.length > 0) {
        const target = inRange.sort((a, b) => a.hp - b.hp)[0];
        applySkill(unit, target.gx, target.gy, skill);
        unit.acted = true;
        return;
      }
    }
  }

  // 5. 治疗兜底
  if (canCast && hpRatio < healThreshold) {
    const healSkill = unit.skills.find(s => s.cd <= 0 && s.isHeal);
    if (healSkill) {
      const healAmt = Math.abs(healSkill.dmg);
      let actualHeal = healAmt;
      if (unit.poisonTurns > 0) actualHeal = Math.floor(healAmt / 2);
      unit.hp = Math.min(unit.maxHp, unit.hp + actualHeal);
      healSkill.cd = healSkill.cooldown;
      addLog(`${unit.name} 施放 ${healSkill.name}，回复 ${actualHeal} HP`, 'heal');
      unit.acted = true;
      return;
    }
  }

  // 6. 无可用行动
  unit.acted = true;
  if (!canCast) {
    addLog(`${unit.name} 被沉默，无法施放任何技能${moveCells.length > 0 ? '，已移动调整位置' : ''}`, 'info');
  } else {
    const usableSkills = unit.skills.filter(s => s.cd <= 0).length;
    if (usableSkills === 0 && moveCells.length === 0) {
      addLog(`${unit.name} 技能全部冷却且无法移动，休息一回合`, 'info');
    } else {
      addLog(`${unit.name} 无法行动，跳过`, 'info');
    }
  }
}


// ===== ui/renderer.js =====
// ============================================================
// UI: Renderer — Canvas 渲染引擎
// ============================================================

function buildStaticLayer() {
  if (!staticCanvas) {
    staticCanvas = document.createElement('canvas');
    staticCanvas.width = GRID_W * CELL;
    staticCanvas.height = GRID_H * CELL;
    staticCtx = staticCanvas.getContext('2d');
  }
  const c = staticCtx;
  c.fillStyle = COLORS.gridBg;
  c.fillRect(0, 0, GRID_W * CELL, GRID_H * CELL);
  c.strokeStyle = COLORS.gridLine;
  c.lineWidth = 1;
  for (let i = 0; i <= GRID_W; i++) {
    c.beginPath(); c.moveTo(i * CELL, 0); c.lineTo(i * CELL, GRID_H * CELL); c.stroke();
  }
  for (let j = 0; j <= GRID_H; j++) {
    c.beginPath(); c.moveTo(0, j * CELL); c.lineTo(GRID_W * CELL, j * CELL); c.stroke();
  }
  if (currentMap) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    (currentMap.cover || []).forEach(co => {
      c.fillStyle = 'rgba(130,130,150,0.40)';
      c.fillRect(co.gx * CELL + 6, co.gy * CELL + 6, CELL - 12, CELL - 12);
      c.strokeStyle = 'rgba(180,180,200,0.6)';
      c.lineWidth = 1;
      c.strokeRect(co.gx * CELL + 6, co.gy * CELL + 6, CELL - 12, CELL - 12);
      c.fillStyle = '#dcdce6';
      c.font = 'bold 13px sans-serif';
      c.fillText('掩', co.gx * CELL + CELL / 2, co.gy * CELL + CELL / 2);
    });
    (currentMap.hazard || []).forEach(co => {
      c.fillStyle = 'rgba(244,67,54,0.30)';
      c.fillRect(co.gx * CELL + 2, co.gy * CELL + 2, CELL - 4, CELL - 4);
      c.fillStyle = '#ff8a80';
      c.font = 'bold 13px sans-serif';
      c.fillText('危', co.gx * CELL + CELL / 2, co.gy * CELL + CELL / 2);
    });
    // 方向5 地图系统升级：地形矩阵渲染（水域/熔岩/悬崖/树林/矮墙/高地/沼泽/门户/可破坏墙）
    if (activeTerrain) {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const t = activeTerrain[y][x];
          if (t.key === '.' || t.key === 'P' || t.key === 'E') continue; // 平地/部署区不绘制
          const bg = TILE_BG[t.key];
          if (bg) {
            c.fillStyle = bg;
            c.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
          }
          if (t.glyph) {
            c.fillStyle = (TILE_FG[t.key] || '#fff');
            c.font = 'bold 13px sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(t.glyph, x * CELL + CELL / 2, y * CELL + CELL / 2);
          }
        }
      }
    }
  }
  staticMapId = currentMap ? currentMap.id : null;
  staticRebuilds++;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!staticCanvas || staticMapId !== (currentMap && currentMap.id)) buildStaticLayer();
  if (staticCanvas) ctx.drawImage(staticCanvas, 0, 0);
  drawHighlights();
  drawUnits();
  drawFloaters();
}

function computeValidTargets() {
  if (phase !== 'selectTarget' || !selectedUnit || !activeSkill) return [];
  const buff = activeSkill.isHeal || activeSkill.isShield || activeSkill.isEmpower;
  const cells = [];
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      if (cellDistPt(selectedUnit.gx, selectedUnit.gy, x, y) > activeSkill.range) continue;
      const t = getUnitAt(x, y);
      if (t) {
        if (buff) { if (t.team === selectedUnit.team) cells.push({ gx: x, gy: y, kind: 'friendly' }); }
        else if (t.team !== selectedUnit.team) cells.push({ gx: x, gy: y, kind: 'enemy' });
      } else if (activeSkill.aoeRadius > 0) {
        cells.push({ gx: x, gy: y, kind: 'aoe' });
      }
    }
  }
  return cells;
}

function drawHighlights() {
  moveHighlightCells.forEach(({ gx, gy }) => {
    ctx.fillStyle = COLORS.moveHighlight;
    ctx.fillRect(gx * CELL + 2, gy * CELL + 2, CELL - 4, CELL - 4);
  });
  attackHighlightCells.forEach(({ gx, gy }) => {
    ctx.fillStyle = COLORS.attackHighlight;
    ctx.fillRect(gx * CELL + 2, gy * CELL + 2, CELL - 4, CELL - 4);
  });
  computeValidTargets().forEach(c => {
    const color = c.kind === 'friendly' ? '#69f0ae' : (c.kind === 'enemy' ? '#ff5252' : '#ffb300');
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(c.gx * CELL + 5, c.gy * CELL + 5, CELL - 10, CELL - 10);
  });
}

function drawUnits() {
  units.forEach(u => {
    if (u.hp <= 0) return;
    const px = u.gx * CELL + CELL / 2;
    const py = u.gy * CELL + CELL / 2;
    if (selectedUnit === u) {
      ctx.beginPath();
      ctx.arc(px, py, CELL / 2 - 4, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.selected;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(px, py, 28, 0, Math.PI * 2);
    ctx.fillStyle = u.color;
    ctx.fill();
    ctx.strokeStyle = u.team === 'player' ? '#fff' : '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 兵种徽标（方向2 Phase 1）：单位格左上角显示 战/弓/法/奶
    if (u.unitType && UNIT_TYPE_LABEL[u.unitType]) {
      const lx = u.gx * CELL + 4, ly = u.gy * CELL + 4;
      ctx.fillStyle = UNIT_TYPE_COLOR[u.unitType] || '#fff';
      ctx.fillRect(lx, ly, 16, 16);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(UNIT_TYPE_LABEL[u.unitType], lx + 8, ly + 8);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.name.charAt(0), px, py - 2);
    if (u.isBoss) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('★BOSS', px, py - 34);
    }
    if (u.team === 'player' && u.growthLevel > 1) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('Lv.' + u.growthLevel, px, py - 42);
    }
    const hpW = 50, hpH = 6;
    const hpX = px - hpW / 2, hpY = py + 16;
    ctx.fillStyle = '#333';
    ctx.fillRect(hpX, hpY, hpW, hpH);
    const hpRatio = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = u.team === 'player' ? COLORS.hpGreen : COLORS.hpRed;
    ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
    if (u.acted) {
      ctx.fillStyle = 'rgba(128,128,128,0.5)';
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.stunned) { ctx.fillStyle = '#e0a0ff'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('晕', px, py - 30); }
    if (u.burnTurns > 0) { ctx.fillStyle = '#ff7043'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('燃', px, py + 30); }
    if (u.frozenTurns > 0) { ctx.fillStyle = '#4fc3f7'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('冰', px - 30, py); }
    if (u.poisonTurns > 0) { ctx.fillStyle = '#9e9d24'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('毒', px + 30, py); }
    if (u.blindTurns > 0) { ctx.fillStyle = '#b39ddb'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('盲', px - 30, py - 30); }
    if (u.tauntTurns > 0) { ctx.fillStyle = '#ffb300'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('嘲', px + 30, py + 30); }
    if (u.shield > 0) { ctx.fillStyle = '#40c4ff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('🛡' + u.shield, px + 30, py - 30); }
    if (u.silenceTurns > 0) { ctx.fillStyle = '#9575cd'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('默', px - 30, py + 30); }
    if (u.vulnTurns > 0) { ctx.fillStyle = '#ff5252'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('易', px, py - 44); }
    if (u.empowerTurns > 0) { ctx.fillStyle = '#ffc107'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('强', px + 30, py - 44); }
    if (u.fearTurns > 0) {
      ctx.save();
      ctx.strokeStyle = '#ba68c8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(px, py, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function drawFloaters() {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    const rise = (30 - f.life) * 1.2;
    const px = f.gx * CELL + CELL / 2;
    const py = f.gy * CELL + CELL / 2 - 30 - rise;
    let color = '#ff5252';
    if (f.kind === 'heal') color = '#69f0ae';
    else if (f.kind === 'burn') color = '#ff7043';
    else if (f.kind === 'poison') color = '#cddc39';
    else if (f.kind === 'hazard') color = '#ff8a80';
    else if (f.kind === 'shield') color = '#80d8ff';
    else if (f.kind === 'status') color = '#e0a0ff';
    else if (f.kind === 'counter') color = '#ffd54f';
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 30));
    ctx.fillStyle = color;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, px, py);
    ctx.globalAlpha = 1;
    f.life--;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}


// ===== ui/interaction.js =====
// ============================================================
// UI: Interaction — 点击处理、移动/技能/取消操作
// ============================================================

function onCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const { gx, gy } = pixelToCell(px, py);
  if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return;

  if (phase === 'selectUnit') {
    handleSelectUnit(gx, gy);
  } else if (phase === 'move') {
    handleMove(gx, gy);
  } else if (phase === 'selectTarget') {
    handleSelectTarget(gx, gy);
  }
}

function handleSelectUnit(gx, gy) {
  const u = getUnitAt(gx, gy);
  if (!u || u.team !== 'player' || u.acted) {
    if (!u) {
      selectedUnit = null;
      moveHighlightCells = [];
      attackHighlightCells = [];
      updateUI();
      render();
    }
    return;
  }
  selectedUnit = u;
  moveHighlightCells = [];
  attackHighlightCells = [];
  phase = 'selectUnit';
  updateUI();
  render();
}

function handleMove(gx, gy) {
  if (!selectedUnit) return;
  const target = getUnitAt(gx, gy);
  const isHighlighted = moveHighlightCells.some(c => c.gx === gx && c.gy === gy);
  if (isHighlighted && !target) {
    addLog(`${selectedUnit.name} 移动到 (${gx},${gy})`, 'move');
    selectedUnit.gx = gx;
    selectedUnit.gy = gy;
    moveHighlightCells = [];
    phase = 'selectUnit';
    updateUI();
    render();
  } else {
    moveHighlightCells = [];
    phase = 'selectUnit';
    updateUI();
    render();
  }
}

function handleSelectTarget(gx, gy) {
  if (!selectedUnit || !activeSkill) return;
  const target = getUnitAt(gx, gy);
  const isHighlighted = attackHighlightCells.some(c => c.gx === gx && c.gy === gy);

  if (!isHighlighted) {
    attackHighlightCells = [];
    activeSkill = null;
    phase = 'selectUnit';
    updateUI();
    render();
    return;
  }

  // 根据技能类型验证并执行
  if (activeSkill.isHeal || activeSkill.isShield || activeSkill.isEmpower) {
    if (target && target.team === selectedUnit.team) {
      applySkill(selectedUnit, gx, gy, activeSkill);
    } else {
      addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选友方）`, 'info');
      attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
    }
  } else if (activeSkill.isStun || activeSkill.isBurn || activeSkill.isFreeze || activeSkill.isPoison ||
             activeSkill.isBlind || activeSkill.isSilence || activeSkill.isTaunt || activeSkill.isVuln ||
             activeSkill.isFear || activeSkill.isPull) {
    if (target && target.team !== selectedUnit.team) {
      applySkill(selectedUnit, gx, gy, activeSkill);
    } else {
      addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选敌方）`, 'info');
      attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
    }
  } else {
    applySkill(selectedUnit, gx, gy, activeSkill);
  }

  attackHighlightCells = [];
  activeSkill = null;
  selectedUnit.acted = true;
  checkGameEnd();
  if (phase !== 'gameOver') {
    selectNextPlayerUnit();
  } else {
    updateUI();
    render();
  }
}

function startMove() {
  if (!selectedUnit || selectedUnit.acted || phase !== 'selectUnit') return;
  if (selectedUnit.frozenTurns > 0) {
    addLog(`${selectedUnit.name} 被冰冻，无法移动`, 'info');
    return;
  }
  moveHighlightCells = getMoveCells(selectedUnit);
  attackHighlightCells = [];
  phase = 'move';
  updateUI();
  render();
}

function getMoveCells(u) {
  // 方向5 地图系统升级：基于地形移动消耗的成本 Dijkstra。
  // 旧地图全为 cost1 平地 → 可达集恰为曼哈顿距离 ≤ moveRange 的空格，与原行为一致；
  // 新地图含森林(cost2)/沼泽(cost3)/水崖熔岩(不可通行) → 自然产生走位深度与路径依赖。
  const budget = u.moveRange;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const best = {};
  const visited = {};
  best[u.gx + ',' + u.gy] = 0;
  const pq = [{ x: u.gx, y: u.gy, c: 0 }];
  const result = [];
  while (pq.length) {
    pq.sort((a, b) => a.c - b.c);
    const cur = pq.shift();
    if (visited[cur.x + ',' + cur.y]) continue;
    visited[cur.x + ',' + cur.y] = true;
    if (!(cur.x === u.gx && cur.y === u.gy) && !getUnitAt(cur.x, cur.y) && isPassable(cur.x, cur.y)) {
      result.push({ gx: cur.x, gy: cur.y });
    }
    if (cur.c >= budget) continue;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      if (getUnitAt(nx, ny)) continue; // 不能穿过/进入任何存活单位
      if (!isPassable(nx, ny)) continue;
      const nc = cur.c + getTileCost(nx, ny);
      if (nc > budget) continue;
      const key = nx + ',' + ny;
      if (best[key] === undefined || nc < best[key]) {
        best[key] = nc;
        pq.push({ x: nx, y: ny, c: nc });
      }
    }
  }
  return result;
}

function castSkill(skillIdx) {
  if (!selectedUnit || selectedUnit.acted) return;
  if (selectedUnit.silenceTurns > 0) {
    addLog(`${selectedUnit.name} 被沉默，无法施放技能`, 'info');
    return;
  }
  const skill = selectedUnit.skills[skillIdx];
  if (skill.cd > 0) return;
  activeSkill = skill;
  attackHighlightCells = getAttackCells(selectedUnit, skill);
  moveHighlightCells = [];
  phase = 'selectTarget';
  updateUI();
  render();
}

function getAttackCells(u, skill) {
  const cells = [];
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      if (cellDistPt(u.gx, u.gy, x, y) <= skill.range) {
        cells.push({ gx: x, gy: y });
      }
    }
  }
  return cells;
}

function skipUnit() {
  if (!selectedUnit || selectedUnit.acted) return;
  selectedUnit.acted = true;
  addLog(`${selectedUnit.name} 跳过行动`, 'info');
  selectNextPlayerUnit();
}

function selectNextPlayerUnit() {
  const next = units.find(u => u.team === 'player' && u.hp > 0 && !u.acted);
  selectedUnit = next || null;
  moveHighlightCells = [];
  attackHighlightCells = [];
  activeSkill = null;
  phase = 'selectUnit';
  updateUI();
  render();
}

function cancelAction() {
  if (phase === 'move') {
    moveHighlightCells = [];
    phase = 'selectUnit';
  } else if (phase === 'selectTarget') {
    attackHighlightCells = [];
    activeSkill = null;
    phase = 'selectUnit';
  }
  updateUI();
  render();
}


// ===== ui/panels.js =====
// ============================================================
// UI: Panels — 主菜单、世界地图、百科、对话、弹窗、装备等
// ============================================================

function showMenu() {
  closeOverlay();
  const stats = document.getElementById('menu-stats');
  if (stats) {
    const sq = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
    const lvls = sq.map(d => (saveData.growth && saveData.growth[d.name] && saveData.growth[d.name].level) || 1);
    const avg = (lvls.reduce((a, b) => a + b, 0) / lvls.length).toFixed(1);
    stats.textContent = `战绩: ${saveData.wins}胜 / ${saveData.losses}负 · 战役进度: 已解锁 ${saveData.unlockedLevel || 1}/${CAMPAIGN.length} 关 · 小队平均等级 Lv.${avg}`;
  }
  const lv = document.getElementById('menu-levels');
  if (lv) {
    lv.innerHTML = CAMPAIGN.map(c => {
      const locked = c.level > (saveData.unlockedLevel || 1);
      return `<button class="menu-btn" ${locked ? 'disabled' : ''} onclick="Game.startCampaign(${c.level})">${locked ? '🔒 ' : ''}${c.name}</button>`;
    }).join('');
  }
  const menu = document.getElementById('menu');
  if (menu) {
    renderAchievements();
    renderCodex();
    renderEquipment();
    renderBonds();
    renderClassChange();
    menu.style.display = 'flex';
  }
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
}

function startCampaign(level) {
  const c = CAMPAIGN.find(x => x.level === level);
  if (!c) return;
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  closeOverlay();
  gameMode = 'campaign';
  currentCampaignLevel = level;
  startBattle({ map: c.map, enemies: c.enemies });
  if (CHAPTER_STORY[level]) {
    showStory(`${c.name} · 开场`, CHAPTER_STORY[level].opening, '开始战斗 ▶', 'Game.closeOverlay()');
  }
}

function startSkirmish() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  closeOverlay();
  gameMode = 'skirmish';
  currentCampaignLevel = 0;
  const mapIdx = Math.floor(Math.random() * MAPS.length);
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  shuffle(pool);
  const enemies = pool.slice(0, 5).map(i => ({ src: 'enemy', i }));
  startBattle({ map: mapIdx, enemies });
}

function showSideStories() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  const cleared = saveData.sideCleared || {};
  const listHtml = SIDE_STORIES.map((s, idx) => {
    const done = !!cleared[idx];
    const mapName = MAPS[s.map] ? MAPS[s.map].name : '';
    return `<button class="menu-btn" onclick="Game.startSideStory(${idx})">${done ? '✅ ' : '📜 '}${s.title}<span style="font-size:0.8em;opacity:0.7"> · ${s.enemies.length} 敌 · ${mapName}</span>${done ? ' <span style="color:#ffd54f">[已通关]</span>' : ''}</button>`;
  }).join('');
  const el = document.getElementById('lore-panel');
  if (el) {
    el.innerHTML = `<div id="side-content">
      <h2>📜 外传章节 · 裂缝之外的故事</h2>
      <p class="lore-sub">独立于主线战役的自成一段战斗。每篇皆为原创叙事，胜利后解锁专属尾声。</p>
      <div class="lore-section-title">可选外传</div>
      ${listHtml}
      <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
    </div>`;
    el.style.display = 'flex';
  }
}

function startSideStory(idx) {
  const s = SIDE_STORIES[idx];
  if (!s) return;
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  closeOverlay();
  gameMode = 'sidestory';
  currentSideStory = idx;
  startBattle({ map: s.map, enemies: s.enemies });
  if (s.opening) {
    showStory(`${s.title} · 开场`, s.opening, '开始战斗 ▶', 'Game.closeOverlay()');
  }
}

function showHidden() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  const unlocked = (saveData.endings && saveData.endings.length > 0);
  const cleared = saveData.hiddenCleared || {};
  const listHtml = HIDDEN_CHAPTERS.map((s, idx) => {
    const done = !!cleared[idx];
    const mapName = MAPS[s.map] ? MAPS[s.map].name : '';
    return `<button class="menu-btn" ${unlocked ? '' : 'disabled'} onclick="Game.startHidden(${idx})">${done ? '✅ ' : '🔮 '}${s.title}<span style="font-size:0.8em;opacity:0.7"> · ${s.enemies.length} 敌 · ${mapName}</span>${done ? ' <span style="color:#ffd54f">[已通关]</span>' : ''}</button>`;
  }).join('');
  const el = document.getElementById('lore-panel');
  if (el) {
    el.innerHTML = `<div id="hidden-content">
      <h2>🔮 隐藏章节 · 蚀教真相 / 门彼之侧 / 灵脉分裂前叙事</h2>
      <p class="lore-sub">通关全部战役后解锁。蚀教——禁忌的「蚀」之脉——与门彼之侧的源初回响、以及溯源篇的溯光者先后登场，讲述裂缝之外的三卷真相（第一卷·蚀教真相 / 第二卷·门彼之侧 / 第三卷·灵脉分裂前叙事）。每篇皆为原创叙事，胜利后解锁专属尾声。</p>
      ${unlocked ? `<div class="lore-section-title">隐藏章节</div>${listHtml}` : `<div class="lore-section-title">尚未解锁</div><p class="lore-sub">先通关全部 ${CAMPAIGN.length} 关战役，再回来揭开蚀教的真相。</p>`}
      <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
    </div>`;
    el.style.display = 'flex';
  }
}

function startHidden(idx) {
  const s = HIDDEN_CHAPTERS[idx];
  if (!s) return;
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  closeOverlay();
  gameMode = 'hidden';
  currentHidden = idx;
  startBattle({ map: s.map, enemies: s.enemies });
  if (s.opening) {
    showStory(`${s.title} · 开场`, s.opening, '开始战斗 ▶', 'Game.closeOverlay()');
  }
}

function retry() {
  closeOverlay();
  if (gameMode === 'campaign') startCampaign(currentCampaignLevel);
  else startSkirmish();
}

function restart() {
  retry();
}

function showWorldMap() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const unlocked = saveData.unlockedLevel || 1;
  const regionHtml = WORLD_REGIONS.map(r => {
    const regionOpen = r.chapters.some(lv => lv <= unlocked);
    const chapters = r.chapters.map(lv => {
      const c = CAMPAIGN.find(x => x.level === lv);
      if (!c) return '';
      const locked = lv > unlocked;
      const cls = 'wm-chapter' + (locked ? ' locked' : '') + (lv === CAMPAIGN.length ? ' boss' : '');
      const label = (locked ? '🔒 ' : '') + c.name;
      const stars = (!locked && saveData.levelStars && saveData.levelStars[lv]) ? saveData.levelStars[lv] : 0;
      const starStr = locked ? '' : `<span class="wm-stars" style="color:#ffd54f;font-size:0.82em;letter-spacing:1px">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
      const btn = locked
        ? `<button class="${cls}" disabled>${label}</button>`
        : `<button class="${cls}" onclick="Game.startCampaign(${lv})">${label}${starStr}</button>`;
      return `<div class="wm-node">${btn}</div>`;
    }).join('');
    return `<div class="wm-region ${regionOpen ? 'open' : 'closed'}">
      <div class="wm-region-head"><span class="wm-region-name">${r.name}</span><span class="wm-region-tag">${regionOpen ? '已抵达' : '未解锁'}</span></div>
      <div class="wm-region-desc">${r.desc}</div>
      <div class="wm-chapters">${chapters}</div>
    </div>`;
  }).join('');
  const el = document.getElementById('world-map');
  if (el) {
    el.innerHTML = `<div id="world-map-content">
      <h2>🌍 维尔德兰 · 世界地图</h2>
      <p class="wm-sub">战役进度：${unlocked}/${CAMPAIGN.length} 关已解锁</p>
      <div class="wm-regions">${regionHtml}</div>
      <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
    </div>`;
    el.style.display = 'flex';
  }
}

function renderLore() {
  const el = document.getElementById('lore-panel');
  if (!el) return;
  const loreHtml = WORLD_LORE.map(e =>
    `<div class="lore-entry">
      <div class="lore-head"><span class="lore-cat">${e.category}</span><span class="lore-title">${e.title}</span></div>
      <div class="lore-body">${e.text}</div>
    </div>`).join('');
  const bioHtml = Object.keys(CHARACTER_BIOS).map(name => {
    const b = CHARACTER_BIOS[name];
    const facName = (b.faction && FACTIONS[b.faction]) ? FACTIONS[b.faction].name : '—';
    return `<div class="bio-card">
      <div class="bio-name"><span class="bio-dot" style="background:${b.isBoss ? '#ff5252' : '#f0c27f'}"></span>${name}${b.isBoss ? ' <span class="bio-boss">BOSS</span>' : ''}</div>
      <div class="bio-title">${b.title} · ${facName}</div>
      <div class="bio-body">${b.bio}</div>
    </div>`;
  }).join('');
  const achieved = (saveData.endings || []).filter(id => ENDINGS[id]);
  const endingHtml = achieved.length
    ? achieved.map(id => `<div class="bio-card">
        <div class="bio-name"><span class="bio-dot" style="background:#ffd54f"></span>🏆 ${ENDINGS[id].title}</div>
        <div class="bio-body">${ENDINGS[id].text}</div>
      </div>`).join('')
    : '<p class="lore-sub">尚未通关——你的每一次抉择将决定维尔德兰走向哪一种结局。</p>';
  el.innerHTML = `<div id="lore-content">
    <h2>📖 维尔德兰 · 世界百科与角色传记</h2>
    <p class="lore-sub">阅读这个世界的设定，与那些与你并肩、或与你对垒的人</p>
    <div class="lore-section-title">世界百科（世界观设定）</div>
    <div class="lore-list">${loreHtml}</div>
    <div class="lore-section-title">角色传记（可招募 / 关键角色）</div>
    <div class="bio-grid">${bioHtml}</div>
    <div class="lore-section-title">结局图鉴（多结局系统）</div>
    <div class="bio-grid">${endingHtml}</div>
    <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
  </div>`;
}

function showLore() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  renderLore();
  const el = document.getElementById('lore-panel');
  if (el) el.style.display = 'flex';
}

function renderSupport() {
  const el = document.getElementById('support-panel');
  if (!el) return;
  const ul = saveData.unlockedLevel || 1;
  const unlocked = SUPPORT_TALKS.filter(t => ul >= t.unlockAt);
  const locked = SUPPORT_TALKS.filter(t => ul < t.unlockAt);
  const talkHtml = (t) => {
    const lines = (t.lines || []).map(l => `<div class="talk-line"><span class="talk-speaker">${l.speaker}</span>${l.text}</div>`).join('');
    return `<div class="talk-card">
      <div class="talk-pair">${t.pair[0]} ✕ ${t.pair[1]}</div>
      <div class="talk-title">「${t.title}」</div>
      ${lines}
    </div>`;
  };
  const unlockedHtml = unlocked.length
    ? unlocked.map(talkHtml).join('')
    : '<p class="lore-sub">推进战役，角色间的故事将随你的脚步逐一解锁。</p>';
  const lockedHtml = locked.length
    ? locked.map(t => `<div class="talk-locked">🔒 《${t.title}》— 推进战役至第 ${t.unlockAt} 章解锁（${t.pair[0]} ✕ ${t.pair[1]}）</div>`).join('')
    : '';
  el.innerHTML = `<div id="support-content">
    <h2>💬 维尔德兰 · 角色支援对话</h2>
    <div class="support-count">已解锁 ${unlocked.length} / ${SUPPORT_TALKS.length} 段</div>
    <div class="lore-section-title">已解锁对话</div>
    ${unlockedHtml}
    ${locked.length ? '<div class="lore-section-title">未解锁</div>' + lockedHtml : ''}
    <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
  </div>`;
}

function showSupport() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  renderSupport();
  const el = document.getElementById('support-panel');
  if (el) el.style.display = 'flex';
}

function setDifficulty(d) {
  if (!DIFFICULTY[d]) return;
  difficulty = d;
  ['easy', 'normal', 'hard'].forEach(n => {
    const btn = document.getElementById('diff-' + n);
    if (btn) btn.className = 'diff-btn' + (n === d ? ' active' : '');
  });
  const el = document.getElementById('menu-difficulty');
  if (el) el.textContent = `当前难度: ${DIFFICULTY[d].name}（敌方 HP×${DIFFICULTY[d].hpMul} / 伤害×${DIFFICULTY[d].dmgMul}）`;
  addLog(`难度已设为「${DIFFICULTY[d].name}」`, 'info');
}

function setPlayerFaction(f) {
  if (!PLAYER_SQUADS[f]) return;
  selectedPlayerFaction = f;
  ['classic', 'light'].forEach(n => {
    const btn = document.getElementById('faction-' + n);
    if (btn) btn.className = 'faction-btn' + (n === f ? ' active' : '');
  });
  const el = document.getElementById('menu-faction');
  if (el) el.textContent = `当前出场阵营: ${f === 'light' ? '圣光（守护/治疗向）' : '经典（三阵营混编）'}`;
  addLog(`出场阵营已设为「${f === 'light' ? '圣光' : '经典'}」`, 'info');
}

function renderEquipment() {
  const panel = document.getElementById('menu-equipment');
  if (!panel) return;
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  const eqIds = Object.keys(EQUIPMENT);
  panel.innerHTML = squad.map(u => {
    const cur = (saveData.equip && saveData.equip[u.name]) || null;
    const noneBtn = `<button class="eq-btn${cur ? '' : ' active'}" onclick="Game.setEquipment('${u.name}','')">无</button>`;
    const itemBtns = eqIds.map(id => {
      const e = EQUIPMENT[id];
      const stat = (e.hp ? '生命+' + e.hp + ' ' : '') + (e.dmg ? '伤害+' + e.dmg : '');
      return `<button class="eq-btn${cur === id ? ' active' : ''}" onclick="Game.setEquipment('${u.name}','${id}')">${e.name}<span class="eq-stat"> ${stat}</span></button>`;
    }).join('');
    return `<div class="eq-unit"><div class="eq-name">${u.name}</div><div class="eq-row">${noneBtn}${itemBtns}</div></div>`;
  }).join('');
}

function setEquipment(unitName, equipId) {
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  if (!squad.some(u => u.name === unitName)) return;
  if (equipId && !EQUIPMENT[equipId]) return;
  if (!saveData.equip) saveData.equip = {};
  saveData.equip[unitName] = equipId || null;
  renderEquipment();
  const eName = equipId ? EQUIPMENT[equipId].name : '无';
  addLog(`${unitName} 的装备已设为「${eName}」`, 'info');
  try { saveSave(); } catch (e) { /* ignore */ }
}

// ---- 羁绊 / 好感度系统（方向3 系统新创 · Bond/Synergy）----
function renderBonds() {
  const panel = document.getElementById('bonds-panel');
  if (!panel) return;
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  const squadNames = new Set(squad.map(u => u.name));
  const rows = BOND_PAIRS.map(p => {
    const key = bondKey(p.a, p.b);
    const lv = (saveData.bonds && saveData.bonds[key]) || 0;
    const inSquad = squadNames.has(p.a) && squadNames.has(p.b);
    const label = BOND_LEVEL_LABEL[lv];
    const talk = (p.talks && p.talks[lv - 1]) ? p.talks[lv - 1].replace(/\n/g, '<br>') : '';
    const action = (lv < 3)
      ? `<button class="bond-btn" onclick="Game.deepenBond('${p.a}','${p.b}')">加深羁绊 → ${BOND_LEVEL_LABEL[lv + 1].split(' ')[0]}</button>`
      : `<span class="bond-max">已达最高 · ${label}</span>`;
    return `<div class="bond-pair${inSquad ? '' : ' bond-off'}">
      <div class="bond-head"><span class="bond-names">${p.a} ✕ ${p.b}</span><span class="bond-level">${label}</span></div>
      ${talk ? `<div class="bond-talk">${talk}</div>` : ''}
      <div class="bond-row">${action}</div>
    </div>`;
  }).join('');
  panel.innerHTML = `<div class="bond-grid">${rows}</div>`;
}

function deepenBond(a, b) {
  const canonical = BOND_PAIRS.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  if (!canonical) return;
  if (!saveData.bonds) saveData.bonds = {};
  const key = bondKey(a, b);
  const lv = saveData.bonds[key] || 0;
  if (lv >= 3) return;
  saveData.bonds[key] = lv + 1;
  renderBonds();
  const lvl = BOND_LEVEL_LABEL[lv + 1];
  addLog(`「${a} ✕ ${b}」的羁绊加深至 ${lvl}`, 'info');
  try { saveSave(); } catch (e) { /* ignore */ }
}

function renderCodex() {
  const el = document.getElementById('menu-codex');
  if (!el) return;
  const rows = CODEX_ROSTER.map(u => {
    const facName = (u.faction && FACTIONS[u.faction]) ? FACTIONS[u.faction].name : '—';
    const skills = (u.skills || []).map(sk => {
      const def = SKILL_DEFS[sk];
      if (!def) return '';
      return `<div class="codex-skill">· ${def.name}：${def.desc}</div>`;
    }).join('');
    return `<div class="codex-card">
      <div class="codex-name"><span class="codex-dot" style="background:${u.color}"></span>${u.name}${u.isBoss ? ' <span style="color:#ffd54f">★</span>' : ''}</div>
      <div class="codex-meta">阵营 ${facName} · ${u.category}<br>HP ${u.maxHp} · 移动 ${u.moveRange}</div>
      ${skills}
    </div>`;
  }).join('');
  el.innerHTML = `<div class="codex-grid">${rows}</div>`;
}

function renderAchievements() {
  const el = document.getElementById('menu-achievements');
  if (!el) return;
  const got = saveData.achievements || [];
  const total = ACHIEVEMENTS.length;
  const rows = ACHIEVEMENTS.map(a => {
    const unlocked = got.includes(a.id);
    return `<div class="ach-row ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? '🏆' : '🔒'} <strong>${a.name}</strong> — ${a.desc}</div>`;
  }).join('');
  el.innerHTML = `<div class="ach-count">成就 ${got.length}/${total}</div>` + rows;
}

function unlockAchievement(id) {
  if (!saveData.achievements) saveData.achievements = [];
  if (saveData.achievements.includes(id)) return;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return;
  saveData.achievements.push(id);
  if (battleUnlocked.indexOf(def.name) < 0) battleUnlocked.push(def.name);
  saveSave();
  addLog(`🏆 解锁成就「${def.name}」：${def.desc}`, 'info');
  renderAchievements();
}

// ---- 转职 / 进阶系统（方向3 系统新创 · Class Change）----
function renderClassChange() {
  const panel = document.getElementById('classchange-panel');
  if (!panel) return;
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  const rows = squad.map(u => {
    const lv = (saveData.growth && saveData.growth[u.name] && saveData.growth[u.name].level) || 1;
    const promoted = !!(saveData.classes && saveData.classes[u.name]);
    const titled = CLASS_TITLE[u.name] || '进阶';
    const nextSkill = PROMOTED_SKILL[u.name];
    const nextSkillName = (nextSkill && SKILL_DEFS[nextSkill]) ? SKILL_DEFS[nextSkill].name : '';
    const canPromote = !promoted && lv >= CLASS_CHANGE.minLevel;
    const status = promoted
      ? `已转职 · ${titled}`
      : (lv >= CLASS_CHANGE.minLevel ? '可转职' : `Lv.${lv} / 需 Lv.${CLASS_CHANGE.minLevel}`);
    const action = canPromote
      ? `<button class="cc-btn" onclick="Game.promoteUnit('${u.name}')">转职 → ${titled}</button>`
      : `<span class="cc-locked">${status}</span>`;
    const meta = promoted
      ? `Lv.${lv} · 进阶后 HP×${CLASS_CHANGE.hpMul} 伤害×${CLASS_CHANGE.dmgMul}${nextSkillName ? ' · 已解锁「' + nextSkillName + '」' : ''}`
      : `Lv.${lv} · 进阶后 HP×${CLASS_CHANGE.hpMul} 伤害×${CLASS_CHANGE.dmgMul}${nextSkillName ? ' · 解锁「' + nextSkillName + '」' : ''}`;
    return `<div class="cc-unit">
      <div class="cc-name">${u.name}${promoted ? ' <span class="cc-tag">★ ' + titled + '</span>' : ''}</div>
      <div class="cc-meta">${meta}</div>
      <div class="cc-row">${action}</div>
    </div>`;
  }).join('');
  panel.innerHTML = `<div class="cc-grid">${rows}</div>`;
}

function promoteUnit(name) {
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  if (!squad.some(u => u.name === name)) return;
  const lv = (saveData.growth && saveData.growth[name] && saveData.growth[name].level) || 1;
  if (lv < CLASS_CHANGE.minLevel) return;            // 成长等级不足，不可转职
  if (!saveData.classes) saveData.classes = {};
  if (saveData.classes[name]) return;                // 已转职，不可重复
  saveData.classes[name] = true;
  renderClassChange();
  const titled = CLASS_TITLE[name] || '进阶';
  addLog(`${name} 完成转职 · ${titled}`, 'info');
  try { saveSave(); } catch (e) { /* ignore */ }
}

// ---- 弹窗系统 ----
function buildResultStats() {
  if (!lastResult) return '';
  const starRow = (lastResult.result === 'win' && lastResult.stars)
    ? `<div class="rs-row"><span class="rs-label">关卡评价</span><span class="rs-val" style="color:#ffd54f;font-size:1.15em;letter-spacing:2px">${'★'.repeat(lastResult.stars)}${'☆'.repeat(3 - lastResult.stars)}</span></div>`
    : '';
  const survivors = lastResult.survivors.length
    ? lastResult.survivors.map(n => `<span class="rs-unit">${n}</span>`).join('')
    : '<span class="rs-unit rs-dead">全员阵亡</span>';
  const unlocked = lastResult.unlocked.length
    ? lastResult.unlocked.map(n => `<span class="rs-ach">🏆 ${n}</span>`).join('')
    : '<span class="rs-muted">本场无新成就</span>';
  return starRow
    + `<div class="rs-row"><span class="rs-label">用时回合</span><span class="rs-val">${lastResult.turns}</span></div>`
    + `<div class="rs-row"><span class="rs-label">存活单位</span><span class="rs-val">${survivors}</span></div>`
    + `<div class="rs-row rs-ach-row"><span class="rs-label">本场成就</span><span class="rs-val">${unlocked}</span></div>`;
}

function formatStory(text) {
  return String(text).split('\n').map(p => p.trim() ? `<p class="story-p">${p}</p>` : '').join('');
}

function showStory(title, text, actionLabel, actionHandler) {
  const t = document.getElementById('overlay-title'); if (t) t.textContent = title;
  const m = document.getElementById('overlay-msg'); if (m) m.innerHTML = formatStory(text);
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = buildResultStats();
  const oc = document.getElementById('overlay-content');
  if (oc) oc.className = 'reveal story-mode';
  setOverlayAction(actionLabel, actionHandler);
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'flex';
  lastStory = { title, text };
}

function showOverlay(title, msg) {
  const t = document.getElementById('overlay-title'); if (t) t.textContent = title;
  const m = document.getElementById('overlay-msg'); if (m) m.textContent = msg;
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = buildResultStats();
  const oc = document.getElementById('overlay-content');
  if (oc) oc.className = 'reveal ' + (lastResult && lastResult.result === 'win' ? 'result-win' : 'result-lose');
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'flex';
}

function setOverlayAction(text, handler) {
  const btn = document.getElementById('overlay-action');
  if (!btn) return;
  if (!text) { btn.style.display = 'none'; btn.removeAttribute('onclick'); return; }
  btn.style.display = 'inline-block';
  btn.textContent = text;
  btn.setAttribute('onclick', handler);
}

function closeOverlay() {
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'none';
  const oc = document.getElementById('overlay-content'); if (oc) oc.className = '';
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = '';
  setOverlayAction(null);
}

// ---- 多结局系统 ----
function showChoice(level) {
  const ch = CAMPAIGN_CHOICES[level];
  if (!ch) return;
  const t = document.getElementById('overlay-title'); if (t) t.textContent = ch.title;
  const m = document.getElementById('overlay-msg'); if (m) m.innerHTML = formatStory(ch.prompt);
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = '';
  const oc = document.getElementById('overlay-content');
  if (oc) {
    oc.className = 'reveal story-mode';
    oc.innerHTML = ch.options.map(o =>
      `<button class="menu-btn choice-btn" onclick="Game.chooseOption(${level}, '${o.id}')">${o.label}</button>`
    ).join('');
  }
  setOverlayAction(null);
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'flex';
}

function chooseOption(level, optId) {
  const ch = CAMPAIGN_CHOICES[level];
  if (!ch) return;
  const opt = ch.options.find(o => o.id === optId);
  if (!opt) return;
  saveData.storyChoices = saveData.storyChoices || {};
  if (!saveData.storyChoices[level]) {
    saveData.storyChoices[level] = optId;
    saveData.alignmentScore = (saveData.alignmentScore || 0) + opt.delta;
    saveData.unlockedLevel = Math.max(saveData.unlockedLevel || 1, level + 1);
    saveSave();
  }
  const c = CAMPAIGN[level - 1];
  const story = CHAPTER_STORY[level];
  closeOverlay();
  if (story && story.closing) {
    showStory(`${c.name} · 胜利`, story.closing + '\n\n— 你的抉择已铭刻于灵脉之中 —', '进入下一关 ▶', `Game.startCampaign(${level + 1})`);
  } else {
    setOverlayAction('进入下一关 ▶', `Game.startCampaign(${level + 1})`);
    showOverlay('战斗胜利', '已解锁下一关！');
  }
}


// ===== ui/ui-update.js =====
// ============================================================
// UI: Update — UI 更新 & 战斗日志
// ============================================================

function updateUI() {
  document.getElementById('turn-num').textContent = turnNum;
  const phaseMap = {
    selectUnit: '选择单位',
    move: '选择移动位置',
    selectTarget: '选择技能目标',
    enemyTurn: '敌方行动...',
    gameOver: '战斗结束',
  };
  document.getElementById('phase-text').textContent = phaseMap[phase] || phase;
  const phaseEl = document.getElementById('phase-text');
  phaseEl.className = 'phase-info phase-' + phase;

  const detailEl = document.getElementById('unit-detail');
  const hpFill = document.getElementById('hp-fill');
  const hpText = document.getElementById('hp-text');
  if (selectedUnit) {
    const factionName = (selectedUnit.faction && FACTIONS[selectedUnit.faction]) ? FACTIONS[selectedUnit.faction].name : '—';
    detailEl.innerHTML = `<strong>${selectedUnit.name}</strong>${selectedUnit.isBoss ? ' <span style="color:#ffd54f">★BOSS</span>' : ''}<br>阵营: ${factionName}<br>团队: ${selectedUnit.team === 'player' ? '玩家' : '敌方'}<br>位置: (${selectedUnit.gx},${selectedUnit.gy})${selectedUnit.stunned ? '<br><span style="color:#e0a0ff">⚡ 眩晕中</span>' : ''}${selectedUnit.burnTurns > 0 ? '<br><span style="color:#ff7043">🔥 灼烧中(' + selectedUnit.burnTurns + '回合)</span>' : ''}${selectedUnit.frozenTurns > 0 ? '<br><span style="color:#4fc3f7">❄ 冰冻中(' + selectedUnit.frozenTurns + '回合·无法移动)</span>' : ''}${selectedUnit.poisonTurns > 0 ? '<br><span style="color:#9e9d24">☠ 中毒中(' + selectedUnit.poisonTurns + '回合·治疗减半)</span>' : ''}${selectedUnit.blindTurns > 0 ? '<br><span style="color:#b39ddb">👁 致盲中(' + selectedUnit.blindTurns + '回合·伤害降低50%)</span>' : ''}${selectedUnit.tauntTurns > 0 ? '<br><span style="color:#ffb300">🛡 嘲讽中(' + selectedUnit.tauntTurns + '回合·攻击被吸引向你)</span>' : ''}${selectedUnit.shield > 0 ? '<br><span style="color:#40c4ff">🔰 护盾(' + selectedUnit.shield + '点·持续' + selectedUnit.shieldTurns + '回合)</span>' : ''}${selectedUnit.silenceTurns > 0 ? '<br><span style="color:#9575cd">🔇 沉默中(' + selectedUnit.silenceTurns + '回合·无法施法)</span>' : ''}${selectedUnit.vulnTurns > 0 ? '<br><span style="color:#ff5252">💥 易伤中(' + selectedUnit.vulnTurns + '回合·受到伤害+50%)</span>' : ''}${selectedUnit.fearTurns > 0 ? '<br><span style="color:#ba68c8">😱 恐惧中(' + selectedUnit.fearTurns + '回合·被迫远离你移动)</span>' : ''}${selectedUnit.empowerTurns > 0 ? '<br><span style="color:#ffc107">⚔ 强化中(' + selectedUnit.empowerTurns + '回合·造成伤害+50%)</span>' : ''}`;
    const ratio = Math.max(0, selectedUnit.hp / selectedUnit.maxHp) * 100;
    hpFill.style.width = ratio + '%';
    hpFill.className = 'hp-fill ' + (selectedUnit.team === 'player' ? 'player' : 'enemy');
    hpText.textContent = `HP: ${Math.max(0, selectedUnit.hp)} / ${selectedUnit.maxHp}`;
  } else {
    detailEl.textContent = '点击战场上的单位查看详情';
    hpFill.style.width = '0%';
    hpText.textContent = '';
  }

  const skillsList = document.getElementById('skills-list');
  if (selectedUnit && !selectedUnit.acted) {
    skillsList.innerHTML = selectedUnit.skills.map((s, i) => {
      const disabled = s.cd > 0 ? 'disabled' : '';
      const cdText = s.cd > 0 ? ` (冷却${s.cd}回合)` : '';
      return `<button class="skill-btn" ${disabled} onclick="Game.castSkill(${i})">
        <span class="skill-name">${s.name}</span>${cdText}<br>
        <span class="skill-info">${s.desc}</span>
      </button>`;
    }).join('');
  } else {
    skillsList.innerHTML = '<p>选择未行动单位后显示可用技能</p>';
  }

  document.getElementById('btn-move').disabled = !selectedUnit || selectedUnit.acted || phase !== 'selectUnit';
  document.getElementById('btn-end-turn').disabled = phase === 'enemyTurn' || phase === 'gameOver';
  document.getElementById('btn-skip').disabled = !selectedUnit || selectedUnit.acted;

  document.getElementById('win-count').textContent = saveData.wins;
  document.getElementById('lose-count').textContent = saveData.losses;

  updateBattlePrediction();
}

function addLog(text, type = 'info') {
  logs.push({ text, type });
  const el = document.getElementById('log-content');
  if (!el) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;
  entry.textContent = text;
  el.appendChild(entry);
  el.scrollTop = el.scrollHeight;
}


// ===== systems/save.js =====
// ============================================================
// Systems: Save — 本地存档（localStorage）
// ============================================================

function sanitizeSave(obj) {
  const toCount = (v) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const base = { wins: toCount(obj && obj.wins), losses: toCount(obj && obj.losses) };
  const ul = Math.floor(Number(obj && obj.unlockedLevel));
  base.unlockedLevel = (Number.isFinite(ul) && ul >= 1 && ul <= CAMPAIGN.length) ? ul : 1;
  if (obj && Array.isArray(obj.achievements)) {
    base.achievements = obj.achievements.filter(a => ACHIEVEMENTS.some(def => def.id === a));
  } else { base.achievements = []; }
  base.winStreak = toCount(obj && obj.winStreak);
  base.alignmentScore = (Number.isFinite(Number(obj && obj.alignmentScore))) ? Number(obj.alignmentScore) : 0;
  if (obj && typeof obj.storyChoices === 'object' && obj.storyChoices) {
    base.storyChoices = {};
    for (const k of Object.keys(obj.storyChoices)) {
      const nk = Number(k);
      if (Number.isFinite(nk) && obj.storyChoices[k] != null) base.storyChoices[nk] = String(obj.storyChoices[k]);
    }
  } else { base.storyChoices = {}; }
  if (obj && Array.isArray(obj.endings)) {
    base.endings = obj.endings.filter(e => ENDINGS[e]);
  } else { base.endings = []; }
  if (obj && typeof obj.growth === 'object' && obj.growth) {
    base.growth = {};
    for (const k of Object.keys(obj.growth)) {
      const g = obj.growth[k];
      if (g && typeof g === 'object' && Number.isFinite(Number(g.exp)) && Number.isFinite(Number(g.level))) {
        base.growth[k] = {
          exp: Math.max(0, Math.floor(Number(g.exp))),
          level: Math.min(GROWTH.maxLevel, Math.max(1, Math.floor(Number(g.level)))),
        };
      }
    }
  } else { base.growth = {}; }
  if (obj && typeof obj.levelStars === 'object' && obj.levelStars) {
    base.levelStars = {};
    for (const k of Object.keys(obj.levelStars)) {
      const nk = Number(k);
      const v = Math.floor(Number(obj.levelStars[k]));
      if (Number.isFinite(nk) && nk >= 1 && nk <= CAMPAIGN.length && Number.isFinite(v) && v >= 0 && v <= 3) {
        base.levelStars[nk] = v;
      }
    }
  } else { base.levelStars = {}; }
  if (obj && typeof obj.equip === 'object' && obj.equip) {
    base.equip = {};
    const validUnits = new Set();
    PLAYER_UNITS.forEach(u => validUnits.add(u.name));
    LIGHT_SQUAD.forEach(u => validUnits.add(u.name));
    for (const k of Object.keys(obj.equip)) {
      if (!validUnits.has(k)) continue;
      const v = obj.equip[k];
      if (v === null || v === '' || EQUIPMENT[v]) base.equip[k] = v || null;
    }
  } else { base.equip = {}; }
  if (obj && typeof obj.bonds === 'object' && obj.bonds) {
    base.bonds = {};
    const validUnits = new Set();
    PLAYER_UNITS.forEach(u => validUnits.add(u.name));
    LIGHT_SQUAD.forEach(u => validUnits.add(u.name));
    for (const k of Object.keys(obj.bonds)) {
      const parts = k.split('|');
      if (parts.length !== 2 || !validUnits.has(parts[0]) || !validUnits.has(parts[1])) continue;
      const v = Math.floor(Number(obj.bonds[k]));
      if (Number.isFinite(v) && v >= 0 && v <= 3) base.bonds[k] = v;
    }
  } else { base.bonds = {}; }
  if (obj && typeof obj.classes === 'object' && obj.classes) {
    base.classes = {};
    const validUnits = new Set();
    PLAYER_UNITS.forEach(u => validUnits.add(u.name));
    LIGHT_SQUAD.forEach(u => validUnits.add(u.name));
    for (const k of Object.keys(obj.classes)) {
      if (!validUnits.has(k)) continue;
      base.classes[k] = !!obj.classes[k];
    }
  } else { base.classes = {}; }
  if (obj && typeof obj.sideCleared === 'object' && obj.sideCleared) {
    base.sideCleared = {};
    for (const k of Object.keys(obj.sideCleared)) {
      const nk = Number(k);
      if (Number.isFinite(nk) && nk >= 0 && nk < 999) base.sideCleared[nk] = !!obj.sideCleared[k];
    }
  } else { base.sideCleared = {}; }
  if (obj && typeof obj.hiddenCleared === 'object' && obj.hiddenCleared) {
    base.hiddenCleared = {};
    for (const k of Object.keys(obj.hiddenCleared)) {
      const nk = Number(k);
      if (Number.isFinite(nk) && nk >= 0 && nk < 999) base.hiddenCleared[nk] = !!obj.hiddenCleared[k];
    }
  } else { base.hiddenCleared = {}; }
  return base;
}

function loadSave() {
  try {
    const raw = localStorage.getItem('magicArenaSave');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') saveData = sanitizeSave(parsed);
    }
  } catch (e) { /* ignore */ }
  document.getElementById('win-count').textContent = saveData.wins;
  document.getElementById('lose-count').textContent = saveData.losses;
}

function saveSave() {
  try {
    localStorage.setItem('magicArenaSave', JSON.stringify(saveData));
  } catch (e) { /* ignore */ }
  document.getElementById('win-count').textContent = saveData.wins;
  document.getElementById('lose-count').textContent = saveData.losses;
}


// ===== systems/prediction.js =====
// ============================================================
// Systems: Prediction — 战力评估 & 比分预测
// ============================================================

function evaluateSideScore(list) {
  return (list || []).reduce((sum, u) => {
    if (!u || u.hp <= 0) return sum;
    let s = u.maxHp;
    (u.skills || []).forEach(sk => {
      if (sk.isHeal) {
        s += Math.abs(sk.dmg) * 1.5;
      } else {
        const rangeFactor = (sk.range || 1) / 3;
        const cdFactor = 1 / ((sk.cooldown || 0) + 1);
        const aoeBonus = sk.aoeRadius > 0 ? sk.dmg * 0.5 : 0;
        s += (sk.dmg + aoeBonus) * rangeFactor * cdFactor;
      }
      if (sk.isStun || sk.isFreeze) s += 20;
      if (sk.isBurn || sk.isPoison) s += 12;
      if (sk.isBlind) s += 14;
      if (sk.isTaunt) s += 16;
      if (sk.isShield) s += 14;
      if (sk.isSilence) s += 16;
      if (sk.isVuln) s += 14;
      if (sk.isFear) s += 14;
      if (sk.isPull) s += 14;
      if (sk.isEmpower) s += 14;
    });
    s += (u.moveRange || 0) * 5;
    return sum + s;
  }, 0);
}

function predictOutcome(playerUnits, enemyUnits) {
  const ps = evaluateSideScore(playerUnits);
  const es = evaluateSideScore(enemyUnits);
  const scale = Math.max(30, (ps + es) * 0.15);
  const pWin = 1 / (1 + Math.exp(-(ps - es) / scale));
  return { playerScore: Math.round(ps), enemyScore: Math.round(es), playerWinProb: Math.round(pWin * 100) };
}

function updateBattlePrediction() {
  const el = document.getElementById('battle-predict');
  if (!el) return;
  if (!units || units.length === 0 || phase === 'gameOver') { el.innerHTML = ''; return; }
  const ps = units.filter(u => u.team === 'player' && u.hp > 0);
  const es = units.filter(u => u.team === 'enemy' && u.hp > 0);
  if (ps.length === 0 || es.length === 0) { el.innerHTML = ''; return; }
  const r = predictOutcome(ps, es);
  const total = r.playerScore + r.enemyScore || 1;
  const pPct = Math.round(r.playerScore / total * 100);
  el.innerHTML =
    '<div style="font-size:13px;color:#f0c27f;margin-bottom:6px;">⚖ 战力预测（比分）</div>' +
    '<div style="font-size:12px;display:flex;justify-content:space-between;margin-bottom:4px;">' +
      '<span style="color:#4caf50;">我方 ' + r.playerScore + '</span>' +
      '<span style="color:#f44336;">敌方 ' + r.enemyScore + '</span></div>' +
    '<div style="height:8px;border-radius:4px;background:linear-gradient(90deg,#4caf50 0%,#4caf50 ' + pPct + '%,#f44336 ' + pPct + '%,#f44336 100%);"></div>' +
    '<div style="font-size:12px;color:#a0d0ff;margin-top:4px;">预估胜率 ≈ ' + r.playerWinProb + '%</div>';
}


// ===== systems/hooks.js =====
// ============================================================
// Systems: Hooks — 测试钩子（只读快照）
// ============================================================

function _perf() {
  return { staticRebuilds, hasStaticLayer: !!staticCanvas, staticMapId };
}

function _state() {
  return {
    phase, turnNum, gameMode, difficulty, currentCampaignLevel, currentSideStory, currentHidden,
    lastResult: lastResult ? { ...lastResult } : null,
    lastStory: lastStory ? { title: lastStory.title, text: lastStory.text } : null,
    worldMap: { unlockedLevel: saveData.unlockedLevel || 1, regionCount: WORLD_REGIONS.length, regions: WORLD_REGIONS },
    lore: { biosCount: Object.keys(CHARACTER_BIOS).length, worldCount: WORLD_LORE.length, bios: Object.keys(CHARACTER_BIOS), worldTitles: WORLD_LORE.map(e => e.title) },
    endings: (saveData.endings || []).slice(),
    storyChoices: saveData.storyChoices || {},
    growth: (saveData.growth || {}),
    levelStars: saveData.levelStars || {},
    equip: saveData.equip || {},
    equipment: EQUIPMENT,
    bonds: saveData.bonds || {},
    classes: saveData.classes || {},
    alignmentScore: saveData.alignmentScore || 0,
    currentMap: currentMap ? { id: currentMap.id, name: currentMap.name, cover: currentMap.cover, hazard: currentMap.hazard } : null,
    // 方向5 地图系统升级：地形矩阵快照（行拼接，便于纯 Node 断言校验）
    terrainInfo: activeTerrain ? activeTerrain.map(r => r.map(t => t.key).join('')).join('/') : null,
    saveData: { ...saveData },
    floaters: floaters.map(f => ({ gx: f.gx, gy: f.gy, text: f.text, kind: f.kind, life: f.life })),
    logs: logs.map(l => ({ text: l.text, type: l.type })),
    validTargets: computeValidTargets(),
    units: units.map(u => ({
      id: u.id, name: u.name, team: u.team, faction: u.faction, isBoss: u.isBoss,
      unitType: u.unitType,
      growthLevel: u.growthLevel, growthExp: u.growthExp,
      hp: u.hp, maxHp: u.maxHp, gx: u.gx, gy: u.gy, moveRange: u.moveRange,
      acted: u.acted, stunned: u.stunned, burnTurns: u.burnTurns, frozenTurns: u.frozenTurns,
      poisonTurns: u.poisonTurns, blindTurns: u.blindTurns, silenceTurns: u.silenceTurns,
      vulnTurns: u.vulnTurns, tauntTurns: u.tauntTurns, taunterId: u.taunterId,
      shield: u.shield, shieldTurns: u.shieldTurns, empowerTurns: u.empowerTurns,
      skills: u.skills.map(s => ({
        key: s.key, name: s.name, dmg: s.dmg, range: s.range, cooldown: s.cooldown, cd: s.cd,
        isHeal: !!s.isHeal, isStun: !!s.isStun, isBurn: !!s.isBurn, isFreeze: !!s.isFreeze,
        isPoison: !!s.isPoison, isBlind: !!s.isBlind, isTaunt: !!s.isTaunt, isShield: !!s.isShield,
        isSilence: !!s.isSilence, isVuln: !!s.isVuln, isPull: !!s.isPull, isEmpower: !!s.isEmpower,
        aoeRadius: s.aoeRadius,
      })),
    })),
  };
}

  // 测试辅助：将全部敌方单位 HP 置 0（仅测试用，用于确定性触发胜利分支）
  function _testKillEnemies() {
    units.forEach(u => { if (u.team === 'enemy') u.hp = 0; });
  }

  // 测试辅助：设定某单位的角色成长等级（仅测试用，用于校验转职门槛逻辑）
  function _testSetGrowth(name, level) {
    if (!saveData.growth) saveData.growth = {};
    saveData.growth[name] = { exp: 0, level: Math.max(1, Math.floor(Number(level) || 1)) };
  }


// ===== main.js =====
// ============================================================
// Main — 初始化入口 & 公共 API 导出
// ============================================================

function init() {
  canvas = document.getElementById('arena');
  ctx = canvas.getContext('2d');
  loadSave();
  currentMap = MAPS[0];
  canvas.addEventListener('click', onCanvasClick);
  render();
  showMenu();
}

window.addEventListener('DOMContentLoaded', init);

// ===== 测试辅助（仅测试用 · 地形系统）=====
function _testStartMapById(id, enemies) {
  const idx = MAPS.findIndex(m => m.id === id);
  if (idx < 0) throw new Error('地图不存在: ' + id);
  startBattle({ map: idx, enemies: enemies || (ENEMY_UNITS ? [{ src: 'enemy', i: 0 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 2 }, { src: 'enemy', i: 3 }, { src: 'enemy', i: 4 }] : []) });
}
function _testGetMoveCells(name) {
  const u = units.find(u => u.name === name && u.hp > 0);
  return u ? getMoveCells(u) : [];
}

// ===== Public API =====
return {
  startMove, endTurn, skipUnit, castSkill, restart, closeOverlay,
  cancelAction, startCampaign, startSkirmish, showMenu, showWorldMap,
  showLore, renderLore, setDifficulty, setPlayerFaction, renderCodex,
  renderEquipment, setEquipment, renderBonds, deepenBond, startSideStory, showSideStories, startHidden, showHidden, _state, _perf, evaluateSideScore,
  predictOutcome, updateBattlePrediction, showChoice, chooseOption,
  getEndingId, _testSetUnitPos, _testKillEnemies, counterMult,
  renderClassChange, promoteUnit, _testSetGrowth,
  // 方向5 地图系统升级：地形系统公共 API（供 UI/测试复用）
  parseMapTiles, setActiveTerrain, getTileCost, isPassable, isCoverAt, isHighAt, getTileHazardDmg,
  _testStartMapById, _testGetMoveCells,
};
})();
