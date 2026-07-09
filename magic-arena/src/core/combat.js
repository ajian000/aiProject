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
