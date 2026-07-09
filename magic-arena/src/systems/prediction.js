// ============================================================
// Systems: Prediction — 战力评估 & 比分预测
// ============================================================

function evaluateSideScore(list) {
  return (list || []).reduce((sum, u) => {
    if (!u || u.hp <= 0) return sum;
    let s = u.maxHp;
    (u.skills || []).forEach(sk => {
      if (sk.isHeal) {
        s += Math.abs(sk.dmg) * 1.5;
      } else {
        const rangeFactor = (sk.range || 1) / 3;
        const cdFactor = 1 / ((sk.cooldown || 0) + 1);
        const aoeBonus = sk.aoeRadius > 0 ? sk.dmg * 0.5 : 0;
        s += (sk.dmg + aoeBonus) * rangeFactor * cdFactor;
      }
      if (sk.isStun || sk.isFreeze) s += 20;
      if (sk.isBurn || sk.isPoison) s += 12;
      if (sk.isBlind) s += 14;
      if (sk.isTaunt) s += 16;
      if (sk.isShield) s += 14;
      if (sk.isSilence) s += 16;
      if (sk.isVuln) s += 14;
      if (sk.isFear) s += 14;
      if (sk.isPull) s += 14;
      if (sk.isEmpower) s += 14;
    });
    s += (u.moveRange || 0) * 5;
    return sum + s;
  }, 0);
}

function predictOutcome(playerUnits, enemyUnits) {
  const ps = evaluateSideScore(playerUnits);
  const es = evaluateSideScore(enemyUnits);
  const scale = Math.max(30, (ps + es) * 0.15);
  const pWin = 1 / (1 + Math.exp(-(ps - es) / scale));
  return { playerScore: Math.round(ps), enemyScore: Math.round(es), playerWinProb: Math.round(pWin * 100) };
}

function updateBattlePrediction() {
  const el = document.getElementById('battle-predict');
  if (!el) return;
  if (!units || units.length === 0 || phase === 'gameOver') { el.innerHTML = ''; return; }
  const ps = units.filter(u => u.team === 'player' && u.hp > 0);
  const es = units.filter(u => u.team === 'enemy' && u.hp > 0);
  if (ps.length === 0 || es.length === 0) { el.innerHTML = ''; return; }
  const r = predictOutcome(ps, es);
  const total = r.playerScore + r.enemyScore || 1;
  const pPct = Math.round(r.playerScore / total * 100);
  el.innerHTML =
    '<div style="font-size:13px;color:#f0c27f;margin-bottom:6px;">⚖ 战力预测（比分）</div>' +
    '<div style="font-size:12px;display:flex;justify-content:space-between;margin-bottom:4px;">' +
      '<span style="color:#4caf50;">我方 ' + r.playerScore + '</span>' +
      '<span style="color:#f44336;">敌方 ' + r.enemyScore + '</span></div>' +
    '<div style="height:8px;border-radius:4px;background:linear-gradient(90deg,#4caf50 0%,#4caf50 ' + pPct + '%,#f44336 ' + pPct + '%,#f44336 100%);"></div>' +
    '<div style="font-size:12px;color:#a0d0ff;margin-top:4px;">预估胜率 ≈ ' + r.playerWinProb + '%</div>';
}
