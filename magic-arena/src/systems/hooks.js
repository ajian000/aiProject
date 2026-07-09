// ============================================================
// Systems: Hooks — 测试钩子（只读快照）
// ============================================================

function _perf() {
  return { staticRebuilds, hasStaticLayer: !!staticCanvas, staticMapId };
}

function _state() {
  return {
    phase, turnNum, gameMode, difficulty, currentCampaignLevel, currentSideStory, currentHidden,
    lastResult: lastResult ? { ...lastResult } : null,
    lastStory: lastStory ? { title: lastStory.title, text: lastStory.text } : null,
    worldMap: { unlockedLevel: saveData.unlockedLevel || 1, regionCount: WORLD_REGIONS.length, regions: WORLD_REGIONS },
    lore: { biosCount: Object.keys(CHARACTER_BIOS).length, worldCount: WORLD_LORE.length, bios: Object.keys(CHARACTER_BIOS), worldTitles: WORLD_LORE.map(e => e.title) },
    endings: (saveData.endings || []).slice(),
    storyChoices: saveData.storyChoices || {},
    growth: (saveData.growth || {}),
    levelStars: saveData.levelStars || {},
    equip: saveData.equip || {},
    equipment: EQUIPMENT,
    bonds: saveData.bonds || {},
    classes: saveData.classes || {},
    alignmentScore: saveData.alignmentScore || 0,
    currentMap: currentMap ? { id: currentMap.id, name: currentMap.name, cover: currentMap.cover, hazard: currentMap.hazard } : null,
    // 方向5 地图系统升级：地形矩阵快照（行拼接，便于纯 Node 断言校验）
    terrainInfo: activeTerrain ? activeTerrain.map(r => r.map(t => t.key).join('')).join('/') : null,
    saveData: { ...saveData },
    floaters: floaters.map(f => ({ gx: f.gx, gy: f.gy, text: f.text, kind: f.kind, life: f.life })),
    logs: logs.map(l => ({ text: l.text, type: l.type })),
    validTargets: computeValidTargets(),
    units: units.map(u => ({
      id: u.id, name: u.name, team: u.team, faction: u.faction, isBoss: u.isBoss,
      unitType: u.unitType,
      growthLevel: u.growthLevel, growthExp: u.growthExp,
      hp: u.hp, maxHp: u.maxHp, gx: u.gx, gy: u.gy, moveRange: u.moveRange,
      acted: u.acted, stunned: u.stunned, burnTurns: u.burnTurns, frozenTurns: u.frozenTurns,
      poisonTurns: u.poisonTurns, blindTurns: u.blindTurns, silenceTurns: u.silenceTurns,
      vulnTurns: u.vulnTurns, tauntTurns: u.tauntTurns, taunterId: u.taunterId,
      shield: u.shield, shieldTurns: u.shieldTurns, empowerTurns: u.empowerTurns,
      skills: u.skills.map(s => ({
        key: s.key, name: s.name, dmg: s.dmg, range: s.range, cooldown: s.cooldown, cd: s.cd,
        isHeal: !!s.isHeal, isStun: !!s.isStun, isBurn: !!s.isBurn, isFreeze: !!s.isFreeze,
        isPoison: !!s.isPoison, isBlind: !!s.isBlind, isTaunt: !!s.isTaunt, isShield: !!s.isShield,
        isSilence: !!s.isSilence, isVuln: !!s.isVuln, isPull: !!s.isPull, isEmpower: !!s.isEmpower,
        aoeRadius: s.aoeRadius,
      })),
    })),
  };
}

  // 测试辅助：将全部敌方单位 HP 置 0（仅测试用，用于确定性触发胜利分支）
  function _testKillEnemies() {
    units.forEach(u => { if (u.team === 'enemy') u.hp = 0; });
  }

  // 测试辅助：设定某单位的角色成长等级（仅测试用，用于校验转职门槛逻辑）
  function _testSetGrowth(name, level) {
    if (!saveData.growth) saveData.growth = {};
    saveData.growth[name] = { exp: 0, level: Math.max(1, Math.floor(Number(level) || 1)) };
  }
