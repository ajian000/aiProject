// ============================================================
// Magic Arena — 魔法竞技场 · 单机回合制战术战斗游戏
// MVP: F1~F6 全部核心功能
// ============================================================

const Game = (() => {
  // ---- 常量 ----
  const GRID = 8;
  const CELL = 80; // 像素
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

  // ---- 技能定义 ----
  const SKILL_DEFS = {
    fireball: { name: '火球术', dmg: 25, range: 3, cooldown: 0, desc: '范围3格，25伤害', aoeRadius: 0 },
    frostbolt: { name: '冰霜箭', dmg: 15, range: 4, cooldown: 1, desc: '范围4格，15伤害，CD1回合', aoeRadius: 0 },
    heal: { name: '治愈术', dmg: -20, range: 2, cooldown: 2, desc: '回复20HP，范围2格，CD2回合', aoeRadius: 0, isHeal: true },
    lightning: { name: '闪电链', dmg: 18, range: 3, cooldown: 2, desc: '范围3格，18伤害，CD2回合', aoeRadius: 0 },
    shadowbolt: { name: '暗影弹', dmg: 22, range: 3, cooldown: 0, desc: '范围3格，22伤害', aoeRadius: 0 },
    drain: { name: '生命汲取', dmg: 12, range: 2, cooldown: 1, desc: '范围2格，12伤害+自回8HP，CD1', aoeRadius: 0, selfHeal: 8 },
  };

  // ---- 单位模板 ----
  const PLAYER_UNITS = [
    { name: '炎法师·艾拉', maxHp: 80, moveRange: 2, skills: ['fireball', 'frostbolt', 'heal'], color: '#66bb6a' },
    { name: '雷法师·特斯拉', maxHp: 70, moveRange: 3, skills: ['lightning', 'frostbolt', 'heal'], color: '#43a047' },
    { name: '暗法师·莫甘娜', maxHp: 65, moveRange: 2, skills: ['shadowbolt', 'drain', 'frostbolt'], color: '#81c784' },
  ];
  const ENEMY_UNITS = [
    { name: '骷髅法师·卡尔', maxHp: 75, moveRange: 2, skills: ['shadowbolt', 'frostbolt', 'drain'], color: '#ef5350' },
    { name: '暗影巫·维克', maxHp: 65, moveRange: 3, skills: ['lightning', 'shadowbolt'], color: '#e53935' },
    { name: '亡灵术士·安娜', maxHp: 60, moveRange: 2, skills: ['fireball', 'drain', 'heal'], color: '#c62828' },
  ];

  // ---- 游戏状态 ----
  let canvas, ctx;
  let units = [];
  let selectedUnit = null;
  let phase = 'selectUnit'; // selectUnit | move | selectTarget | enemyTurn | gameOver
  let turnNum = 1;
  let playerTurnIndex = 0;
  let moveHighlightCells = [];
  let attackHighlightCells = [];
  let logs = [];
  let activeSkill = null;
  let saveData = { wins: 0, losses: 0 };

  // ---- 初始化 ----
  function init() {
    canvas = document.getElementById('arena');
    ctx = canvas.getContext('2d');
    loadSave();
    startNewGame();
    canvas.addEventListener('click', onCanvasClick);
    render();
  }

  function startNewGame() {
    units = [];
    selectedUnit = null;
    phase = 'selectUnit';
    turnNum = 1;
    playerTurnIndex = 0;
    moveHighlightCells = [];
    attackHighlightCells = [];
    activeSkill = null;
    logs = [];
    // 放置玩家单位（左侧）
    PLAYER_UNITS.forEach((def, i) => {
      units.push(createUnit(def, 'player', i, 1));
    });
    // 放置敌方单位（右侧）
    ENEMY_UNITS.forEach((def, i) => {
      units.push(createUnit(def, 'enemy', 7, 6 - i));
    });
    updateUI();
    render();
  }

  function createUnit(def, team, gx, gy) {
    return {
      id: `${team}_${gx}_${gy}`,
      name: def.name,
      team,
      maxHp: def.maxHp,
      hp: def.maxHp,
      moveRange: def.moveRange,
      skills: def.skills.map(s => ({ ...SKILL_DEFS[s], key: s, cd: 0 })),
      gx, gy,
      color: def.color,
      acted: false,
    };
  }

  // ---- 坐标工具 ----
  function cellToPixel(gx, gy) { return { x: gx * CELL, y: gy * CELL }; }
  function pixelToCell(px, py) { return { gx: Math.floor(px / CELL), gy: Math.floor(py / CELL) }; }
  function cellDist(a, b) { return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy); }
  function cellDistPt(gx1, gy1, gx2, gy2) { return Math.abs(gx1 - gx2) + Math.abs(gy1 - gy2); }
  function getUnitAt(gx, gy) { return units.find(u => u.gx === gx && u.gy === gy && u.hp > 0); }

  // ---- 渲染 ----
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawHighlights();
    drawUnits();
  }

  function drawGrid() {
    // 背景
    ctx.fillStyle = COLORS.gridBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 网格线
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID * CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(GRID * CELL, i * CELL); ctx.stroke();
    }
  }

  function drawHighlights() {
    // 移动高亮
    moveHighlightCells.forEach(({ gx, gy }) => {
      ctx.fillStyle = COLORS.moveHighlight;
      ctx.fillRect(gx * CELL + 2, gy * CELL + 2, CELL - 4, CELL - 4);
    });
    // 攻击高亮
    attackHighlightCells.forEach(({ gx, gy }) => {
      ctx.fillStyle = COLORS.attackHighlight;
      ctx.fillRect(gx * CELL + 2, gy * CELL + 2, CELL - 4, CELL - 4);
    });
  }

  function drawUnits() {
    units.forEach(u => {
      if (u.hp <= 0) return;
      const px = u.gx * CELL + CELL / 2;
      const py = u.gy * CELL + CELL / 2;
      // 选中光环
      if (selectedUnit === u) {
        ctx.beginPath();
        ctx.arc(px, py, CELL / 2 - 4, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      // 单位圆形
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.fillStyle = u.color;
      ctx.fill();
      ctx.strokeStyle = u.team === 'player' ? '#fff' : '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 名称首字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(u.name.charAt(0), px, py - 2);
      // HP 条
      const hpW = 50, hpH = 6;
      const hpX = px - hpW / 2, hpY = py + 16;
      ctx.fillStyle = '#333';
      ctx.fillRect(hpX, hpY, hpW, hpH);
      const hpRatio = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = u.team === 'player' ? COLORS.hpGreen : COLORS.hpRed;
      ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
      // 已行动标记
      if (u.acted) {
        ctx.fillStyle = 'rgba(128,128,128,0.5)';
        ctx.beginPath();
        ctx.arc(px, py, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // ---- 点击处理 ----
  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { gx, gy } = pixelToCell(px, py);
    if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) return;

    if (phase === 'selectUnit') {
      handleSelectUnit(gx, gy);
    } else if (phase === 'move') {
      handleMove(gx, gy);
    } else if (phase === 'selectTarget') {
      handleSelectTarget(gx, gy);
    }
    // enemyTurn / gameOver 阶段忽略点击
  }

  function handleSelectUnit(gx, gy) {
    const u = getUnitAt(gx, gy);
    if (!u || u.team !== 'player' || u.acted) {
      // 点击空地或已行动单位 → 取消选中
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
      // 执行移动
      addLog(`${selectedUnit.name} 移动到 (${gx},${gy})`, 'move');
      selectedUnit.gx = gx;
      selectedUnit.gy = gy;
      moveHighlightCells = [];
      phase = 'selectUnit';
      updateUI();
      render();
    } else {
      // 取消移动模式，回到选择
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

    // 治愈术可对友方施放
    if (activeSkill.isHeal && target && target.team === selectedUnit.team) {
      applySkill(selectedUnit, target, activeSkill);
    } else if (!activeSkill.isHeal && target && target.team !== selectedUnit.team) {
      applySkill(selectedUnit, target, activeSkill);
    } else if (!activeSkill.isHeal && !target) {
      // 对空地施放（仍消耗技能）
      addLog(`${selectedUnit.name} 对 (${gx},${gy}) 施放 ${activeSkill.name}，无目标`, 'info');
      activeSkill.cd = activeSkill.cooldown;
    } else {
      // 无效目标：取消施法，不消耗技能，不算行动
      addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标）`, 'info');
      attackHighlightCells = [];
      activeSkill = null;
      phase = 'selectUnit';
      updateUI();
      render();
      return;
    }

    attackHighlightCells = [];
    activeSkill = null;
    phase = 'selectUnit';
    selectedUnit.acted = true;
    checkGameEnd();
    updateUI();
    render();
  }

  function applySkill(attacker, target, skill) {
    if (skill.isHeal) {
      const healAmt = Math.abs(skill.dmg);
      target.hp = Math.min(target.maxHp, target.hp + healAmt);
      addLog(`${attacker.name} 对 ${target.name} 施放 ${skill.name}，回复 ${healAmt} HP`, 'heal');
    } else {
      target.hp -= skill.dmg;
      addLog(`${attacker.name} 对 ${target.name} 施放 ${skill.name}，造成 ${skill.dmg} 伤害（剩余 ${Math.max(0, target.hp)} HP）`, 'damage');
      if (skill.selfHeal) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + skill.selfHeal);
        addLog(`${attacker.name} 汲取回复 ${skill.selfHeal} HP`, 'heal');
      }
    }
    skill.cd = skill.cooldown;
  }

  // ---- 行动按钮 ----
  function startMove() {
    if (!selectedUnit || selectedUnit.acted || phase !== 'selectUnit') return;
    moveHighlightCells = getMoveCells(selectedUnit);
    attackHighlightCells = [];
    phase = 'move';
    updateUI();
    render();
  }

  function getMoveCells(u) {
    const cells = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (cellDistPt(u.gx, u.gy, x, y) <= u.moveRange && !getUnitAt(x, y)) {
          cells.push({ gx: x, gy: y });
        }
      }
    }
    return cells;
  }

  function castSkill(skillIdx) {
    if (!selectedUnit || selectedUnit.acted) return;
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
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
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
    moveHighlightCells = [];
    attackHighlightCells = [];
    activeSkill = null;
    phase = 'selectUnit';
    selectedUnit = null;
    updateUI();
    render();
  }

  function endTurn() {
    // 标记所有未行动玩家单位为已行动
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
    // 敌方 AI
    setTimeout(() => executeEnemyTurn(), 500);
  }

  // ---- 敌方 AI (F5) ----
  function executeEnemyTurn() {
    const enemies = units.filter(u => u.team === 'enemy' && u.hp > 0);
    let delay = 0;
    enemies.forEach(e => {
      delay += 400;
      setTimeout(() => {
        aiDecide(e);
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
    // 0. 获取所有存活玩家目标
    const targets = units.filter(u => u.team === 'player' && u.hp > 0);
    if (targets.length === 0) { unit.acted = true; return; }

    const hpRatio = unit.hp / unit.maxHp;

    // 1. 自保治疗（HP < 40% 且有可用治愈术）
    if (hpRatio < 0.4) {
      const healSkill = unit.skills.find(s => s.cd <= 0 && s.isHeal);
      if (healSkill) {
        const healAmt = Math.abs(healSkill.dmg);
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmt);
        healSkill.cd = healSkill.cooldown;
        addLog(`${unit.name} 施放 ${healSkill.name}，回复 ${healAmt} HP`, 'heal');
        unit.acted = true;
        return;
      }
    }

    // 2. 攻击技能（按伤害降序，优先斩杀低HP目标）
    const attackSkills = unit.skills
      .filter(s => s.cd <= 0 && !s.isHeal)
      .sort((a, b) => b.dmg - a.dmg); // 高伤害优先
    for (const skill of attackSkills) {
      const inRange = targets.filter(t => cellDist(unit, t) <= skill.range);
      if (inRange.length > 0) {
        const target = inRange.sort((a, b) => a.hp - b.hp)[0];
        applySkill(unit, target, skill);
        unit.acted = true;
        return;
      }
    }

    // 3. 移动靠近最近目标
    const closest = targets.sort((a, b) => cellDist(unit, a) - cellDist(unit, b))[0];
    const moveCells = getMoveCells(unit);
    if (moveCells.length > 0) {
      const bestCell = moveCells.sort((a, b) =>
        cellDistPt(a.gx, a.gy, closest.gx, closest.gy) - cellDistPt(b.gx, b.gy, closest.gx, closest.gy)
      )[0];
      addLog(`${unit.name} 移动到 (${bestCell.gx},${bestCell.gy})`, 'move');
      unit.gx = bestCell.gx;
      unit.gy = bestCell.gy;
    }

    // 4. 移动后攻击（同2逻辑）
    const skillsAfterMove = unit.skills
      .filter(s => s.cd <= 0 && !s.isHeal)
      .sort((a, b) => b.dmg - a.dmg);
    for (const skill of skillsAfterMove) {
      const inRange = targets.filter(t => cellDist(unit, t) <= skill.range);
      if (inRange.length > 0) {
        const target = inRange.sort((a, b) => a.hp - b.hp)[0];
        applySkill(unit, target, skill);
        unit.acted = true;
        return;
      }
    }

    // 5. 治疗兜底：移动后若 HP < 40% 且治愈可用
    if (hpRatio < 0.4) {
      const healSkill = unit.skills.find(s => s.cd <= 0 && s.isHeal);
      if (healSkill) {
        const healAmt = Math.abs(healSkill.dmg);
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmt);
        healSkill.cd = healSkill.cooldown;
        addLog(`${unit.name} 施放 ${healSkill.name}，回复 ${healAmt} HP（移动后）`, 'heal');
        unit.acted = true;
        return;
      }
    }

    // 6. 无可用行动，跳过
    unit.acted = true;
    const skillCount = unit.skills.length;
    const usableSkills = unit.skills.filter(s => s.cd <= 0).length;
    if (usableSkills === 0 && moveCells.length === 0) {
      addLog(`${unit.name} 技能全部冷却且无法移动，休息一回合`, 'info');
    } else {
      addLog(`${unit.name} 无法行动，跳过`, 'info');
    }
  }

  // ---- 回合管理 ----
  function nextTurn() {
    turnNum++;
    // 重置所有单位的行动状态和技能冷却
    units.forEach(u => {
      u.acted = false;
      u.skills.forEach(s => { if (s.cd > 0) s.cd--; });
    });
    phase = 'selectUnit';
    selectedUnit = null;
    moveHighlightCells = [];
    attackHighlightCells = [];
    addLog(`— 回合 ${turnNum} 开始 —`, 'info');
    updateUI();
    render();
  }

  // ---- 胜负判定 (F4) ----
  function checkGameEnd() {
    const playerAlive = units.filter(u => u.team === 'player' && u.hp > 0).length;
    const enemyAlive = units.filter(u => u.team === 'enemy' && u.hp > 0).length;
    if (playerAlive === 0) {
      phase = 'gameOver';
      saveData.losses++;
      saveSave();
      showOverlay('战斗失败', '你的法师小队已全军覆没...');
      addLog('【战斗结束】玩家失败', 'damage');
    } else if (enemyAlive === 0) {
      phase = 'gameOver';
      saveData.wins++;
      saveSave();
      showOverlay('战斗胜利', '敌方已被全部消灭！');
      addLog('【战斗结束】玩家胜利', 'heal');
    }
  }

  // ---- 本地存档 (F6) ----
  function loadSave() {
    try {
      const raw = localStorage.getItem('magicArenaSave');
      if (raw) saveData = JSON.parse(raw);
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

  // ---- UI 更新 ----
  function updateUI() {
    // 回合 & 阶段
    document.getElementById('turn-num').textContent = turnNum;
    const phaseMap = {
      selectUnit: '选择单位',
      move: '选择移动位置',
      selectTarget: '选择技能目标',
      enemyTurn: '敌方行动...',
      gameOver: '战斗结束',
    };
    document.getElementById('phase-text').textContent = phaseMap[phase] || phase;
    // 阶段颜色类（移除旧类、添加新类）
    const phaseEl = document.getElementById('phase-text');
    phaseEl.className = 'phase-info phase-' + phase;

    // 单位信息
    const detailEl = document.getElementById('unit-detail');
    const hpFill = document.getElementById('hp-fill');
    const hpText = document.getElementById('hp-text');
    if (selectedUnit) {
      detailEl.innerHTML = `<strong>${selectedUnit.name}</strong><br>团队: ${selectedUnit.team === 'player' ? '玩家' : '敌方'}<br>位置: (${selectedUnit.gx},${selectedUnit.gy})`;
      const ratio = Math.max(0, selectedUnit.hp / selectedUnit.maxHp) * 100;
      hpFill.style.width = ratio + '%';
      hpFill.className = 'hp-fill ' + (selectedUnit.team === 'player' ? 'player' : 'enemy');
      hpText.textContent = `HP: ${Math.max(0, selectedUnit.hp)} / ${selectedUnit.maxHp}`;
    } else {
      detailEl.textContent = '点击战场上的单位查看详情';
      hpFill.style.width = '0%';
      hpText.textContent = '';
    }

    // 技能面板
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

    // 行动按钮状态
    document.getElementById('btn-move').disabled = !selectedUnit || selectedUnit.acted || phase !== 'selectUnit';
    document.getElementById('btn-end-turn').disabled = phase === 'enemyTurn' || phase === 'gameOver';
    document.getElementById('btn-skip').disabled = !selectedUnit || selectedUnit.acted;

    // 战绩
    document.getElementById('win-count').textContent = saveData.wins;
    document.getElementById('lose-count').textContent = saveData.losses;
  }

  // ---- 日志 ----
  function addLog(text, type = 'info') {
    logs.push({ text, type });
    const el = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.textContent = text;
    el.appendChild(entry);
    el.scrollTop = el.scrollHeight;
  }

  // ---- 弹窗 ----
  function showOverlay(title, msg) {
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-msg').textContent = msg;
    document.getElementById('overlay').style.display = 'flex';
  }

  function closeOverlay() {
    document.getElementById('overlay').style.display = 'none';
  }

  function restart() {
    closeOverlay();
    startNewGame();
  }

  // ---- 取消操作 (Esc) ----
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

  // ---- 启动 ----
  window.addEventListener('DOMContentLoaded', init);

  // 暴露给 HTML onclick 的方法
  return { startMove, endTurn, skipUnit, castSkill, restart, closeOverlay, cancelAction };
})();
