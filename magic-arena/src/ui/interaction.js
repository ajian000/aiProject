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
