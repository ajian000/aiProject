// ============================================================
// Core: Unit Factory — 创建单位（含难度缩放 + 成长 + 装备）
// ============================================================

function createUnit(def, team, gx, gy) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const hpMul = team === 'enemy' ? d.hpMul : 1;
  const dmgMul = team === 'enemy' ? d.dmgMul : 1;
  const maxHp = Math.max(1, Math.round(def.maxHp * hpMul));
  const u = {
    id: `${team}_${gx}_${gy}`,
    name: def.name,
    team,
    faction: def.faction || null,
    isBoss: !!def.isBoss,
    maxHp,
    hp: maxHp,
    moveRange: def.moveRange,
    skills: def.skills.map(s => {
      const base = SKILL_DEFS[s];
      return {
        ...base,
        key: s, cd: 0,
        dmg: Math.round(base.dmg * dmgMul),
        burnDmg: base.burnDmg ? Math.round(base.burnDmg * dmgMul) : 0,
        poisonDmg: base.poisonDmg ? Math.round(base.poisonDmg * dmgMul) : 0,
      };
    }),
    gx, gy,
    color: def.color,
    unitType: def.unitType || null,
    acted: false,
    stunned: false,
    burnTurns: 0, burnDmg: 0,
    frozenTurns: 0,
    poisonTurns: 0, poisonDmg: 0,
    blindTurns: 0,
    silenceTurns: 0,
    vulnTurns: 0,
    tauntTurns: 0, taunterId: null,
    fearTurns: 0,
    shield: 0, shieldTurns: 0,
    empowerTurns: 0,
    growthLevel: 1,
    growthExp: 0,
  };
  // 角色成长：仅战役模式对玩家单位生效
  if (team === 'player' && gameMode === 'campaign') {
    const g = (saveData.growth && saveData.growth[def.name]) || { exp: 0, level: 1 };
    const lv = g.level || 1;
    u.growthLevel = lv;
    u.growthExp = g.exp || 0;
    if (lv > 1) {
      const bonusHp = (lv - 1) * GROWTH.hpPerLevel;
      const bonusDmg = (lv - 1) * GROWTH.dmgPerLevel;
      u.maxHp += bonusHp;
      u.hp = u.maxHp;
      u.skills.forEach(s => {
        s.dmg += bonusDmg;
        if (s.burnDmg) s.burnDmg += bonusDmg;
        if (s.poisonDmg) s.poisonDmg += bonusDmg;
      });
    }
  }
  // 装备系统：部署期为玩家单位叠加装备加成
  if (team === 'player') {
    const eqId = (saveData.equip && saveData.equip[def.name]) || null;
    const eq = eqId ? EQUIPMENT[eqId] : null;
    if (eq) {
      if (eq.hp) { u.maxHp += eq.hp; u.hp = u.maxHp; }
      if (eq.dmg) {
        u.skills.forEach(s => {
          s.dmg += eq.dmg;
          if (s.burnDmg) s.burnDmg += eq.dmg;
          if (s.poisonDmg) s.poisonDmg += eq.dmg;
        });
      }
    }
  }
  return u;
}

// 羁绊 / 好感度系统（方向3 系统新创）：战斗开始时，为同场部署的玩家单位
// 叠加“已缔结羁绊伙伴”的战前联动加成。纯数值、零战斗逻辑改动、方向1 冻结零触碰。
// 仅作用于玩家单位；bonds 为空（默认 / 所有既有测试与平衡自检）时无任何加成。
function applyBondSynergy() {
  const players = units.filter(u => u.team === 'player');
  players.forEach(u => {
    let bonusHp = 0, bonusDmg = 0;
    players.forEach(v => {
      if (v === u) return;
      const key = bondKey(u.name, v.name);
      const lv = (saveData.bonds && saveData.bonds[key]) || 0;
      if (lv >= 1 && BOND_BONUS[lv]) {
        bonusHp += BOND_BONUS[lv].hp;
        bonusDmg += BOND_BONUS[lv].dmg;
      }
    });
    if (bonusHp) { u.maxHp += bonusHp; u.hp += bonusHp; }
    if (bonusDmg) {
      u.skills.forEach(s => {
        s.dmg += bonusDmg;
        if (s.burnDmg) s.burnDmg += bonusDmg;
        if (s.poisonDmg) s.poisonDmg += bonusDmg;
      });
    }
  });
}
