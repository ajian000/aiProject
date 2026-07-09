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
