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
