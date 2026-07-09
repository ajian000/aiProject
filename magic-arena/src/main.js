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

// ===== Public API =====
return {
  startMove, endTurn, skipUnit, castSkill, restart, closeOverlay,
  cancelAction, startCampaign, startSkirmish, showMenu, showWorldMap,
  showLore, renderLore, setDifficulty, setPlayerFaction, renderCodex,
  renderEquipment, setEquipment, renderBonds, deepenBond, startSideStory, showSideStories, startHidden, showHidden, _state, _perf, evaluateSideScore,
  predictOutcome, updateBattlePrediction, showChoice, chooseOption,
  getEndingId, _testSetUnitPos, _testKillEnemies, counterMult,
};
})();
