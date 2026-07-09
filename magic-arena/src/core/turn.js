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
