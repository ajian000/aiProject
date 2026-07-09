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
