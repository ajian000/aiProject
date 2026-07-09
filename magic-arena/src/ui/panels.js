// ============================================================
// UI: Panels — 主菜单、世界地图、百科、对话、弹窗、装备等
// ============================================================

function showMenu() {
  closeOverlay();
  const stats = document.getElementById('menu-stats');
  if (stats) {
    const sq = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
    const lvls = sq.map(d => (saveData.growth && saveData.growth[d.name] && saveData.growth[d.name].level) || 1);
    const avg = (lvls.reduce((a, b) => a + b, 0) / lvls.length).toFixed(1);
    stats.textContent = `战绩: ${saveData.wins}胜 / ${saveData.losses}负 · 战役进度: 已解锁 ${saveData.unlockedLevel || 1}/${CAMPAIGN.length} 关 · 小队平均等级 Lv.${avg}`;
  }
  const lv = document.getElementById('menu-levels');
  if (lv) {
    lv.innerHTML = CAMPAIGN.map(c => {
      const locked = c.level > (saveData.unlockedLevel || 1);
      return `<button class="menu-btn" ${locked ? 'disabled' : ''} onclick="Game.startCampaign(${c.level})">${locked ? '🔒 ' : ''}${c.name}</button>`;
    }).join('');
  }
  const menu = document.getElementById('menu');
  if (menu) {
    renderAchievements();
    renderCodex();
    renderEquipment();
    renderBonds();
    menu.style.display = 'flex';
  }
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
}

function startCampaign(level) {
  const c = CAMPAIGN.find(x => x.level === level);
  if (!c) return;
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  closeOverlay();
  gameMode = 'campaign';
  currentCampaignLevel = level;
  startBattle({ map: c.map, enemies: c.enemies });
  if (CHAPTER_STORY[level]) {
    showStory(`${c.name} · 开场`, CHAPTER_STORY[level].opening, '开始战斗 ▶', 'Game.closeOverlay()');
  }
}

function startSkirmish() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  closeOverlay();
  gameMode = 'skirmish';
  currentCampaignLevel = 0;
  const mapIdx = Math.floor(Math.random() * MAPS.length);
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  shuffle(pool);
  const enemies = pool.slice(0, 5).map(i => ({ src: 'enemy', i }));
  startBattle({ map: mapIdx, enemies });
}

function showSideStories() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  const cleared = saveData.sideCleared || {};
  const listHtml = SIDE_STORIES.map((s, idx) => {
    const done = !!cleared[idx];
    const mapName = MAPS[s.map] ? MAPS[s.map].name : '';
    return `<button class="menu-btn" onclick="Game.startSideStory(${idx})">${done ? '✅ ' : '📜 '}${s.title}<span style="font-size:0.8em;opacity:0.7"> · ${s.enemies.length} 敌 · ${mapName}</span>${done ? ' <span style="color:#ffd54f">[已通关]</span>' : ''}</button>`;
  }).join('');
  const el = document.getElementById('lore-panel');
  if (el) {
    el.innerHTML = `<div id="side-content">
      <h2>📜 外传章节 · 裂缝之外的故事</h2>
      <p class="lore-sub">独立于主线战役的自成一段战斗。每篇皆为原创叙事，胜利后解锁专属尾声。</p>
      <div class="lore-section-title">可选外传</div>
      ${listHtml}
      <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
    </div>`;
    el.style.display = 'flex';
  }
}

function startSideStory(idx) {
  const s = SIDE_STORIES[idx];
  if (!s) return;
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  closeOverlay();
  gameMode = 'sidestory';
  currentSideStory = idx;
  startBattle({ map: s.map, enemies: s.enemies });
  if (s.opening) {
    showStory(`${s.title} · 开场`, s.opening, '开始战斗 ▶', 'Game.closeOverlay()');
  }
}

function showHidden() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  const unlocked = (saveData.endings && saveData.endings.length > 0);
  const cleared = saveData.hiddenCleared || {};
  const listHtml = HIDDEN_CHAPTERS.map((s, idx) => {
    const done = !!cleared[idx];
    const mapName = MAPS[s.map] ? MAPS[s.map].name : '';
    return `<button class="menu-btn" ${unlocked ? '' : 'disabled'} onclick="Game.startHidden(${idx})">${done ? '✅ ' : '🔮 '}${s.title}<span style="font-size:0.8em;opacity:0.7"> · ${s.enemies.length} 敌 · ${mapName}</span>${done ? ' <span style="color:#ffd54f">[已通关]</span>' : ''}</button>`;
  }).join('');
  const el = document.getElementById('lore-panel');
  if (el) {
    el.innerHTML = `<div id="hidden-content">
      <h2>🔮 隐藏章节 · 蚀教真相 / 门彼之侧 / 灵脉分裂前叙事</h2>
      <p class="lore-sub">通关全部战役后解锁。蚀教——禁忌的「蚀」之脉——与门彼之侧的源初回响、以及溯源篇的溯光者先后登场，讲述裂缝之外的三卷真相（第一卷·蚀教真相 / 第二卷·门彼之侧 / 第三卷·灵脉分裂前叙事）。每篇皆为原创叙事，胜利后解锁专属尾声。</p>
      ${unlocked ? `<div class="lore-section-title">隐藏章节</div>${listHtml}` : `<div class="lore-section-title">尚未解锁</div><p class="lore-sub">先通关全部 ${CAMPAIGN.length} 关战役，再回来揭开蚀教的真相。</p>`}
      <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
    </div>`;
    el.style.display = 'flex';
  }
}

function startHidden(idx) {
  const s = HIDDEN_CHAPTERS[idx];
  if (!s) return;
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  closeOverlay();
  gameMode = 'hidden';
  currentHidden = idx;
  startBattle({ map: s.map, enemies: s.enemies });
  if (s.opening) {
    showStory(`${s.title} · 开场`, s.opening, '开始战斗 ▶', 'Game.closeOverlay()');
  }
}

function retry() {
  closeOverlay();
  if (gameMode === 'campaign') startCampaign(currentCampaignLevel);
  else startSkirmish();
}

function restart() {
  retry();
}

function showWorldMap() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const unlocked = saveData.unlockedLevel || 1;
  const regionHtml = WORLD_REGIONS.map(r => {
    const regionOpen = r.chapters.some(lv => lv <= unlocked);
    const chapters = r.chapters.map(lv => {
      const c = CAMPAIGN.find(x => x.level === lv);
      if (!c) return '';
      const locked = lv > unlocked;
      const cls = 'wm-chapter' + (locked ? ' locked' : '') + (lv === CAMPAIGN.length ? ' boss' : '');
      const label = (locked ? '🔒 ' : '') + c.name;
      const stars = (!locked && saveData.levelStars && saveData.levelStars[lv]) ? saveData.levelStars[lv] : 0;
      const starStr = locked ? '' : `<span class="wm-stars" style="color:#ffd54f;font-size:0.82em;letter-spacing:1px">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
      const btn = locked
        ? `<button class="${cls}" disabled>${label}</button>`
        : `<button class="${cls}" onclick="Game.startCampaign(${lv})">${label}${starStr}</button>`;
      return `<div class="wm-node">${btn}</div>`;
    }).join('');
    return `<div class="wm-region ${regionOpen ? 'open' : 'closed'}">
      <div class="wm-region-head"><span class="wm-region-name">${r.name}</span><span class="wm-region-tag">${regionOpen ? '已抵达' : '未解锁'}</span></div>
      <div class="wm-region-desc">${r.desc}</div>
      <div class="wm-chapters">${chapters}</div>
    </div>`;
  }).join('');
  const el = document.getElementById('world-map');
  if (el) {
    el.innerHTML = `<div id="world-map-content">
      <h2>🌍 维尔德兰 · 世界地图</h2>
      <p class="wm-sub">战役进度：${unlocked}/${CAMPAIGN.length} 关已解锁</p>
      <div class="wm-regions">${regionHtml}</div>
      <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
    </div>`;
    el.style.display = 'flex';
  }
}

function renderLore() {
  const el = document.getElementById('lore-panel');
  if (!el) return;
  const loreHtml = WORLD_LORE.map(e =>
    `<div class="lore-entry">
      <div class="lore-head"><span class="lore-cat">${e.category}</span><span class="lore-title">${e.title}</span></div>
      <div class="lore-body">${e.text}</div>
    </div>`).join('');
  const bioHtml = Object.keys(CHARACTER_BIOS).map(name => {
    const b = CHARACTER_BIOS[name];
    const facName = (b.faction && FACTIONS[b.faction]) ? FACTIONS[b.faction].name : '—';
    return `<div class="bio-card">
      <div class="bio-name"><span class="bio-dot" style="background:${b.isBoss ? '#ff5252' : '#f0c27f'}"></span>${name}${b.isBoss ? ' <span class="bio-boss">BOSS</span>' : ''}</div>
      <div class="bio-title">${b.title} · ${facName}</div>
      <div class="bio-body">${b.bio}</div>
    </div>`;
  }).join('');
  const achieved = (saveData.endings || []).filter(id => ENDINGS[id]);
  const endingHtml = achieved.length
    ? achieved.map(id => `<div class="bio-card">
        <div class="bio-name"><span class="bio-dot" style="background:#ffd54f"></span>🏆 ${ENDINGS[id].title}</div>
        <div class="bio-body">${ENDINGS[id].text}</div>
      </div>`).join('')
    : '<p class="lore-sub">尚未通关——你的每一次抉择将决定维尔德兰走向哪一种结局。</p>';
  el.innerHTML = `<div id="lore-content">
    <h2>📖 维尔德兰 · 世界百科与角色传记</h2>
    <p class="lore-sub">阅读这个世界的设定，与那些与你并肩、或与你对垒的人</p>
    <div class="lore-section-title">世界百科（世界观设定）</div>
    <div class="lore-list">${loreHtml}</div>
    <div class="lore-section-title">角色传记（可招募 / 关键角色）</div>
    <div class="bio-grid">${bioHtml}</div>
    <div class="lore-section-title">结局图鉴（多结局系统）</div>
    <div class="bio-grid">${endingHtml}</div>
    <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
  </div>`;
}

function showLore() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  renderLore();
  const el = document.getElementById('lore-panel');
  if (el) el.style.display = 'flex';
}

function renderSupport() {
  const el = document.getElementById('support-panel');
  if (!el) return;
  const ul = saveData.unlockedLevel || 1;
  const unlocked = SUPPORT_TALKS.filter(t => ul >= t.unlockAt);
  const locked = SUPPORT_TALKS.filter(t => ul < t.unlockAt);
  const talkHtml = (t) => {
    const lines = (t.lines || []).map(l => `<div class="talk-line"><span class="talk-speaker">${l.speaker}</span>${l.text}</div>`).join('');
    return `<div class="talk-card">
      <div class="talk-pair">${t.pair[0]} ✕ ${t.pair[1]}</div>
      <div class="talk-title">「${t.title}」</div>
      ${lines}
    </div>`;
  };
  const unlockedHtml = unlocked.length
    ? unlocked.map(talkHtml).join('')
    : '<p class="lore-sub">推进战役，角色间的故事将随你的脚步逐一解锁。</p>';
  const lockedHtml = locked.length
    ? locked.map(t => `<div class="talk-locked">🔒 《${t.title}》— 推进战役至第 ${t.unlockAt} 章解锁（${t.pair[0]} ✕ ${t.pair[1]}）</div>`).join('')
    : '';
  el.innerHTML = `<div id="support-content">
    <h2>💬 维尔德兰 · 角色支援对话</h2>
    <div class="support-count">已解锁 ${unlocked.length} / ${SUPPORT_TALKS.length} 段</div>
    <div class="lore-section-title">已解锁对话</div>
    ${unlockedHtml}
    ${locked.length ? '<div class="lore-section-title">未解锁</div>' + lockedHtml : ''}
    <button class="menu-btn" onclick="Game.showMenu()">← 返回主菜单</button>
  </div>`;
}

function showSupport() {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  closeOverlay();
  const wm = document.getElementById('world-map');
  if (wm) wm.style.display = 'none';
  const lp = document.getElementById('lore-panel');
  if (lp) lp.style.display = 'none';
  renderSupport();
  const el = document.getElementById('support-panel');
  if (el) el.style.display = 'flex';
}

function setDifficulty(d) {
  if (!DIFFICULTY[d]) return;
  difficulty = d;
  ['easy', 'normal', 'hard'].forEach(n => {
    const btn = document.getElementById('diff-' + n);
    if (btn) btn.className = 'diff-btn' + (n === d ? ' active' : '');
  });
  const el = document.getElementById('menu-difficulty');
  if (el) el.textContent = `当前难度: ${DIFFICULTY[d].name}（敌方 HP×${DIFFICULTY[d].hpMul} / 伤害×${DIFFICULTY[d].dmgMul}）`;
  addLog(`难度已设为「${DIFFICULTY[d].name}」`, 'info');
}

function setPlayerFaction(f) {
  if (!PLAYER_SQUADS[f]) return;
  selectedPlayerFaction = f;
  ['classic', 'light'].forEach(n => {
    const btn = document.getElementById('faction-' + n);
    if (btn) btn.className = 'faction-btn' + (n === f ? ' active' : '');
  });
  const el = document.getElementById('menu-faction');
  if (el) el.textContent = `当前出场阵营: ${f === 'light' ? '圣光（守护/治疗向）' : '经典（三阵营混编）'}`;
  addLog(`出场阵营已设为「${f === 'light' ? '圣光' : '经典'}」`, 'info');
}

function renderEquipment() {
  const panel = document.getElementById('menu-equipment');
  if (!panel) return;
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  const eqIds = Object.keys(EQUIPMENT);
  panel.innerHTML = squad.map(u => {
    const cur = (saveData.equip && saveData.equip[u.name]) || null;
    const noneBtn = `<button class="eq-btn${cur ? '' : ' active'}" onclick="Game.setEquipment('${u.name}','')">无</button>`;
    const itemBtns = eqIds.map(id => {
      const e = EQUIPMENT[id];
      const stat = (e.hp ? '生命+' + e.hp + ' ' : '') + (e.dmg ? '伤害+' + e.dmg : '');
      return `<button class="eq-btn${cur === id ? ' active' : ''}" onclick="Game.setEquipment('${u.name}','${id}')">${e.name}<span class="eq-stat"> ${stat}</span></button>`;
    }).join('');
    return `<div class="eq-unit"><div class="eq-name">${u.name}</div><div class="eq-row">${noneBtn}${itemBtns}</div></div>`;
  }).join('');
}

function setEquipment(unitName, equipId) {
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  if (!squad.some(u => u.name === unitName)) return;
  if (equipId && !EQUIPMENT[equipId]) return;
  if (!saveData.equip) saveData.equip = {};
  saveData.equip[unitName] = equipId || null;
  renderEquipment();
  const eName = equipId ? EQUIPMENT[equipId].name : '无';
  addLog(`${unitName} 的装备已设为「${eName}」`, 'info');
  try { saveSave(); } catch (e) { /* ignore */ }
}

// ---- 羁绊 / 好感度系统（方向3 系统新创 · Bond/Synergy）----
function renderBonds() {
  const panel = document.getElementById('bonds-panel');
  if (!panel) return;
  const squad = PLAYER_SQUADS[selectedPlayerFaction] || PLAYER_UNITS;
  const squadNames = new Set(squad.map(u => u.name));
  const rows = BOND_PAIRS.map(p => {
    const key = bondKey(p.a, p.b);
    const lv = (saveData.bonds && saveData.bonds[key]) || 0;
    const inSquad = squadNames.has(p.a) && squadNames.has(p.b);
    const label = BOND_LEVEL_LABEL[lv];
    const talk = (p.talks && p.talks[lv - 1]) ? p.talks[lv - 1].replace(/\n/g, '<br>') : '';
    const action = (lv < 3)
      ? `<button class="bond-btn" onclick="Game.deepenBond('${p.a}','${p.b}')">加深羁绊 → ${BOND_LEVEL_LABEL[lv + 1].split(' ')[0]}</button>`
      : `<span class="bond-max">已达最高 · ${label}</span>`;
    return `<div class="bond-pair${inSquad ? '' : ' bond-off'}">
      <div class="bond-head"><span class="bond-names">${p.a} ✕ ${p.b}</span><span class="bond-level">${label}</span></div>
      ${talk ? `<div class="bond-talk">${talk}</div>` : ''}
      <div class="bond-row">${action}</div>
    </div>`;
  }).join('');
  panel.innerHTML = `<div class="bond-grid">${rows}</div>`;
}

function deepenBond(a, b) {
  const canonical = BOND_PAIRS.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  if (!canonical) return;
  if (!saveData.bonds) saveData.bonds = {};
  const key = bondKey(a, b);
  const lv = saveData.bonds[key] || 0;
  if (lv >= 3) return;
  saveData.bonds[key] = lv + 1;
  renderBonds();
  const lvl = BOND_LEVEL_LABEL[lv + 1];
  addLog(`「${a} ✕ ${b}」的羁绊加深至 ${lvl}`, 'info');
  try { saveSave(); } catch (e) { /* ignore */ }
}

function renderCodex() {
  const el = document.getElementById('menu-codex');
  if (!el) return;
  const rows = CODEX_ROSTER.map(u => {
    const facName = (u.faction && FACTIONS[u.faction]) ? FACTIONS[u.faction].name : '—';
    const skills = (u.skills || []).map(sk => {
      const def = SKILL_DEFS[sk];
      if (!def) return '';
      return `<div class="codex-skill">· ${def.name}：${def.desc}</div>`;
    }).join('');
    return `<div class="codex-card">
      <div class="codex-name"><span class="codex-dot" style="background:${u.color}"></span>${u.name}${u.isBoss ? ' <span style="color:#ffd54f">★</span>' : ''}</div>
      <div class="codex-meta">阵营 ${facName} · ${u.category}<br>HP ${u.maxHp} · 移动 ${u.moveRange}</div>
      ${skills}
    </div>`;
  }).join('');
  el.innerHTML = `<div class="codex-grid">${rows}</div>`;
}

function renderAchievements() {
  const el = document.getElementById('menu-achievements');
  if (!el) return;
  const got = saveData.achievements || [];
  const total = ACHIEVEMENTS.length;
  const rows = ACHIEVEMENTS.map(a => {
    const unlocked = got.includes(a.id);
    return `<div class="ach-row ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? '🏆' : '🔒'} <strong>${a.name}</strong> — ${a.desc}</div>`;
  }).join('');
  el.innerHTML = `<div class="ach-count">成就 ${got.length}/${total}</div>` + rows;
}

function unlockAchievement(id) {
  if (!saveData.achievements) saveData.achievements = [];
  if (saveData.achievements.includes(id)) return;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return;
  saveData.achievements.push(id);
  if (battleUnlocked.indexOf(def.name) < 0) battleUnlocked.push(def.name);
  saveSave();
  addLog(`🏆 解锁成就「${def.name}」：${def.desc}`, 'info');
  renderAchievements();
}

// ---- 弹窗系统 ----
function buildResultStats() {
  if (!lastResult) return '';
  const starRow = (lastResult.result === 'win' && lastResult.stars)
    ? `<div class="rs-row"><span class="rs-label">关卡评价</span><span class="rs-val" style="color:#ffd54f;font-size:1.15em;letter-spacing:2px">${'★'.repeat(lastResult.stars)}${'☆'.repeat(3 - lastResult.stars)}</span></div>`
    : '';
  const survivors = lastResult.survivors.length
    ? lastResult.survivors.map(n => `<span class="rs-unit">${n}</span>`).join('')
    : '<span class="rs-unit rs-dead">全员阵亡</span>';
  const unlocked = lastResult.unlocked.length
    ? lastResult.unlocked.map(n => `<span class="rs-ach">🏆 ${n}</span>`).join('')
    : '<span class="rs-muted">本场无新成就</span>';
  return starRow
    + `<div class="rs-row"><span class="rs-label">用时回合</span><span class="rs-val">${lastResult.turns}</span></div>`
    + `<div class="rs-row"><span class="rs-label">存活单位</span><span class="rs-val">${survivors}</span></div>`
    + `<div class="rs-row rs-ach-row"><span class="rs-label">本场成就</span><span class="rs-val">${unlocked}</span></div>`;
}

function formatStory(text) {
  return String(text).split('\n').map(p => p.trim() ? `<p class="story-p">${p}</p>` : '').join('');
}

function showStory(title, text, actionLabel, actionHandler) {
  const t = document.getElementById('overlay-title'); if (t) t.textContent = title;
  const m = document.getElementById('overlay-msg'); if (m) m.innerHTML = formatStory(text);
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = buildResultStats();
  const oc = document.getElementById('overlay-content');
  if (oc) oc.className = 'reveal story-mode';
  setOverlayAction(actionLabel, actionHandler);
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'flex';
  lastStory = { title, text };
}

function showOverlay(title, msg) {
  const t = document.getElementById('overlay-title'); if (t) t.textContent = title;
  const m = document.getElementById('overlay-msg'); if (m) m.textContent = msg;
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = buildResultStats();
  const oc = document.getElementById('overlay-content');
  if (oc) oc.className = 'reveal ' + (lastResult && lastResult.result === 'win' ? 'result-win' : 'result-lose');
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'flex';
}

function setOverlayAction(text, handler) {
  const btn = document.getElementById('overlay-action');
  if (!btn) return;
  if (!text) { btn.style.display = 'none'; btn.removeAttribute('onclick'); return; }
  btn.style.display = 'inline-block';
  btn.textContent = text;
  btn.setAttribute('onclick', handler);
}

function closeOverlay() {
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'none';
  const oc = document.getElementById('overlay-content'); if (oc) oc.className = '';
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = '';
  setOverlayAction(null);
}

// ---- 多结局系统 ----
function showChoice(level) {
  const ch = CAMPAIGN_CHOICES[level];
  if (!ch) return;
  const t = document.getElementById('overlay-title'); if (t) t.textContent = ch.title;
  const m = document.getElementById('overlay-msg'); if (m) m.innerHTML = formatStory(ch.prompt);
  const rs = document.getElementById('result-stats'); if (rs) rs.innerHTML = '';
  const oc = document.getElementById('overlay-content');
  if (oc) {
    oc.className = 'reveal story-mode';
    oc.innerHTML = ch.options.map(o =>
      `<button class="menu-btn choice-btn" onclick="Game.chooseOption(${level}, '${o.id}')">${o.label}</button>`
    ).join('');
  }
  setOverlayAction(null);
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'flex';
}

function chooseOption(level, optId) {
  const ch = CAMPAIGN_CHOICES[level];
  if (!ch) return;
  const opt = ch.options.find(o => o.id === optId);
  if (!opt) return;
  saveData.storyChoices = saveData.storyChoices || {};
  if (!saveData.storyChoices[level]) {
    saveData.storyChoices[level] = optId;
    saveData.alignmentScore = (saveData.alignmentScore || 0) + opt.delta;
    saveData.unlockedLevel = Math.max(saveData.unlockedLevel || 1, level + 1);
    saveSave();
  }
  const c = CAMPAIGN[level - 1];
  const story = CHAPTER_STORY[level];
  closeOverlay();
  if (story && story.closing) {
    showStory(`${c.name} · 胜利`, story.closing + '\n\n— 你的抉择已铭刻于灵脉之中 —', '进入下一关 ▶', `Game.startCampaign(${level + 1})`);
  } else {
    setOverlayAction('进入下一关 ▶', `Game.startCampaign(${level + 1})`);
    showOverlay('战斗胜利', '已解锁下一关！');
  }
}
