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
