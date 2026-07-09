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
