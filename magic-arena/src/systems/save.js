// ============================================================
// Systems: Save — 本地存档（localStorage）
// ============================================================

function sanitizeSave(obj) {
  const toCount = (v) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const base = { wins: toCount(obj && obj.wins), losses: toCount(obj && obj.losses) };
  const ul = Math.floor(Number(obj && obj.unlockedLevel));
  base.unlockedLevel = (Number.isFinite(ul) && ul >= 1 && ul <= CAMPAIGN.length) ? ul : 1;
  if (obj && Array.isArray(obj.achievements)) {
    base.achievements = obj.achievements.filter(a => ACHIEVEMENTS.some(def => def.id === a));
  } else { base.achievements = []; }
  base.winStreak = toCount(obj && obj.winStreak);
  base.alignmentScore = (Number.isFinite(Number(obj && obj.alignmentScore))) ? Number(obj.alignmentScore) : 0;
  if (obj && typeof obj.storyChoices === 'object' && obj.storyChoices) {
    base.storyChoices = {};
    for (const k of Object.keys(obj.storyChoices)) {
      const nk = Number(k);
      if (Number.isFinite(nk) && obj.storyChoices[k] != null) base.storyChoices[nk] = String(obj.storyChoices[k]);
    }
  } else { base.storyChoices = {}; }
  if (obj && Array.isArray(obj.endings)) {
    base.endings = obj.endings.filter(e => ENDINGS[e]);
  } else { base.endings = []; }
  if (obj && typeof obj.growth === 'object' && obj.growth) {
    base.growth = {};
    for (const k of Object.keys(obj.growth)) {
      const g = obj.growth[k];
      if (g && typeof g === 'object' && Number.isFinite(Number(g.exp)) && Number.isFinite(Number(g.level))) {
        base.growth[k] = {
          exp: Math.max(0, Math.floor(Number(g.exp))),
          level: Math.min(GROWTH.maxLevel, Math.max(1, Math.floor(Number(g.level)))),
        };
      }
    }
  } else { base.growth = {}; }
  if (obj && typeof obj.levelStars === 'object' && obj.levelStars) {
    base.levelStars = {};
    for (const k of Object.keys(obj.levelStars)) {
      const nk = Number(k);
      const v = Math.floor(Number(obj.levelStars[k]));
      if (Number.isFinite(nk) && nk >= 1 && nk <= CAMPAIGN.length && Number.isFinite(v) && v >= 0 && v <= 3) {
        base.levelStars[nk] = v;
      }
    }
  } else { base.levelStars = {}; }
  if (obj && typeof obj.equip === 'object' && obj.equip) {
    base.equip = {};
    const validUnits = new Set();
    PLAYER_UNITS.forEach(u => validUnits.add(u.name));
    LIGHT_SQUAD.forEach(u => validUnits.add(u.name));
    for (const k of Object.keys(obj.equip)) {
      if (!validUnits.has(k)) continue;
      const v = obj.equip[k];
      if (v === null || v === '' || EQUIPMENT[v]) base.equip[k] = v || null;
    }
  } else { base.equip = {}; }
  if (obj && typeof obj.bonds === 'object' && obj.bonds) {
    base.bonds = {};
    const validUnits = new Set();
    PLAYER_UNITS.forEach(u => validUnits.add(u.name));
    LIGHT_SQUAD.forEach(u => validUnits.add(u.name));
    for (const k of Object.keys(obj.bonds)) {
      const parts = k.split('|');
      if (parts.length !== 2 || !validUnits.has(parts[0]) || !validUnits.has(parts[1])) continue;
      const v = Math.floor(Number(obj.bonds[k]));
      if (Number.isFinite(v) && v >= 0 && v <= 3) base.bonds[k] = v;
    }
  } else { base.bonds = {}; }
  if (obj && typeof obj.classes === 'object' && obj.classes) {
    base.classes = {};
    const validUnits = new Set();
    PLAYER_UNITS.forEach(u => validUnits.add(u.name));
    LIGHT_SQUAD.forEach(u => validUnits.add(u.name));
    for (const k of Object.keys(obj.classes)) {
      if (!validUnits.has(k)) continue;
      base.classes[k] = !!obj.classes[k];
    }
  } else { base.classes = {}; }
  if (obj && typeof obj.sideCleared === 'object' && obj.sideCleared) {
    base.sideCleared = {};
    for (const k of Object.keys(obj.sideCleared)) {
      const nk = Number(k);
      if (Number.isFinite(nk) && nk >= 0 && nk < 999) base.sideCleared[nk] = !!obj.sideCleared[k];
    }
  } else { base.sideCleared = {}; }
  if (obj && typeof obj.hiddenCleared === 'object' && obj.hiddenCleared) {
    base.hiddenCleared = {};
    for (const k of Object.keys(obj.hiddenCleared)) {
      const nk = Number(k);
      if (Number.isFinite(nk) && nk >= 0 && nk < 999) base.hiddenCleared[nk] = !!obj.hiddenCleared[k];
    }
  } else { base.hiddenCleared = {}; }
  return base;
}

function loadSave() {
  try {
    const raw = localStorage.getItem('magicArenaSave');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') saveData = sanitizeSave(parsed);
    }
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
