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
    alignmentScore: saveData.alignmentScore || 0,
    currentMap: currentMap ? { id: currentMap.id, name: currentMap.name, cover: currentMap.cover, hazard: currentMap.hazard } : null,
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
