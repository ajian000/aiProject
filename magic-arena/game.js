// ============================================================
// Magic Arena — 魔法竞技场 · 单机回合制战术战斗游戏
// MVP: F1~F6 全部核心功能 + 阶段二拓展（状态效果/ AoE / 手感）
// 阶段二子系统：战役进度 + 多地图地形 + 单局遭遇（@A16）
// ============================================================

const Game = (() => {
  // ---- 常量 ----
  const GRID = 8;
  const CELL = 80; // 像素
  const COLORS = {
    gridBg: '#0a0a23',
    gridLine: '#1a3a5c',
    cellHighlight: 'rgba(240,192,127,0.25)',
    moveHighlight: 'rgba(64,180,255,0.3)',
    attackHighlight: 'rgba(244,67,54,0.3)',
    playerUnit: '#4caf50',
    enemyUnit: '#f44336',
    selected: '#f0c27f',
    hpGreen: '#4caf50',
    hpRed: '#f44336',
  };
  const HAZARD_DMG = 8;      // 危险格每回合环境伤害
  const COVER_REDUCE = 0.7;  // 掩体减伤系数（承受伤害 ×0.7）

  // ---- 阵营（驱动敌方 AI 风格差异化） ----
  const FACTIONS = {
    pyro:   { name: '火焰', color: '#ff7043', aiStyle: 'aggressive' }, // 激进突进
    cryo:   { name: '寒冰', color: '#4fc3f7', aiStyle: 'defensive'  }, // 防守反击
    nature: { name: '自然', color: '#81c784', aiStyle: 'skirmish'   }, // 游击骚扰
  };

  // ---- 难度（Stage 3 · 数值平衡子系统：难度选择） ----
  // 仅缩放敌方单位（玩家小队保持基准），让单局体验在简单/普通/困难间有明显梯度。
  // 数值平衡（balance-scan 自检结论）：困难档原 1.35×HP 且 1.35×伤害导致玩家几乎必败（0% 胜率），
  // 现改为「敌方更肉、伤害略增」——战斗更长但可赢；简单档明显削弱，拉开梯度。
  const DIFFICULTY = {
    easy:   { key: 'easy',   name: '简单', hpMul: 0.70, dmgMul: 0.75 },
    normal: { key: 'normal', name: '普通', hpMul: 1.00, dmgMul: 1.00 },
    hard:   { key: 'hard',   name: '困难', hpMul: 1.25, dmgMul: 1.10 },
  };

  // ---- 技能定义 ----
  const SKILL_DEFS = {
    fireball: { name: '火球术', dmg: 25, range: 3, cooldown: 0, desc: '范围3格，25伤害', aoeRadius: 0 },
    frostbolt: { name: '冰霜箭', dmg: 15, range: 4, cooldown: 1, desc: '范围4格，15伤害，CD1回合', aoeRadius: 0 },
    heal: { name: '治愈术', dmg: -20, range: 2, cooldown: 2, desc: '回复20HP，范围2格，CD2回合', aoeRadius: 0, isHeal: true },
    lightning: { name: '闪电链', dmg: 18, range: 3, cooldown: 2, desc: '范围3格，18伤害，CD2回合', aoeRadius: 0 },
    shadowbolt: { name: '暗影弹', dmg: 22, range: 3, cooldown: 0, desc: '范围3格，22伤害', aoeRadius: 0 },
    drain: { name: '生命汲取', dmg: 12, range: 2, cooldown: 1, desc: '范围2格，12伤害+自回8HP，CD1', aoeRadius: 0, selfHeal: 8 },
    meteor: { name: '陨石术', dmg: 18, range: 4, cooldown: 2, desc: '范围4格，18伤害，命中格周围1格内所有敌方单位，CD2回合', aoeRadius: 1 },
    stun: { name: '眩晕术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标下回合无法行动（控制），CD3回合', aoeRadius: 0, isStun: true },
    burn: { name: '灼烧术', dmg: 0, range: 3, cooldown: 2, desc: '范围3格，点燃敌方目标2回合，每回合受6点燃烧伤害（可叠加，上限4回合）', aoeRadius: 0, isBurn: true, burnTurns: 2, burnDmg: 6 },
    freeze: { name: '冰冻术', dmg: 6, range: 3, cooldown: 2, desc: '范围3格，6伤害并使敌方目标被冰冻、无法移动2回合', aoeRadius: 0, isFreeze: true, freezeTurns: 2 },
    poison: { name: '中毒术', dmg: 4, range: 3, cooldown: 2, desc: '范围3格，造成4直接伤害并使敌方中毒3回合，每回合受4点毒性伤害（可叠加伤害，上限12），中毒期间治疗减半', aoeRadius: 0, isPoison: true, poisonTurns: 3, poisonDmg: 4, poisonMax: 12 },
    blind: { name: '致盲术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标致盲2回合，期间其造成的所有伤害降低50%（削弱敌方输出）', aoeRadius: 0, isBlind: true, blindTurns: 2 },
  };

  // ---- 玩家单位（固定 3 人小队，含阵营） ----
  const PLAYER_UNITS = [
    { name: '炎法师·艾拉', maxHp: 80, moveRange: 2, faction: 'pyro', skills: ['fireball', 'burn', 'heal'], color: '#66bb6a' },
    { name: '雷法师·特斯拉', maxHp: 70, moveRange: 3, faction: 'cryo', skills: ['lightning', 'stun', 'heal'], color: '#43a047' },
    { name: '暗法师·莫甘娜', maxHp: 65, moveRange: 2, faction: 'nature', skills: ['meteor', 'drain', 'blind'], color: '#81c784' },
  ];

  // ---- 敌方单位池（可部署，含阵营；单位类型池 ≥12 的基础） ----
  const ENEMY_UNITS = [
    { name: '骷髅法师·卡尔', maxHp: 75, moveRange: 2, faction: 'nature', skills: ['shadowbolt', 'burn', 'drain'], color: '#ef5350' },
    { name: '暗影巫·维克', maxHp: 65, moveRange: 3, faction: 'cryo', skills: ['lightning', 'shadowbolt', 'poison'], color: '#e53935' },
    { name: '亡灵术士·安娜', maxHp: 60, moveRange: 2, faction: 'pyro', skills: ['meteor', 'drain', 'heal'], color: '#c62828' },
    { name: '烈焰术士·伊格尼斯', maxHp: 70, moveRange: 2, faction: 'pyro', skills: ['fireball', 'burn', 'heal'], color: '#ff7043' },
    { name: '冰晶守卫·弗罗斯特', maxHp: 85, moveRange: 2, faction: 'cryo', skills: ['frostbolt', 'freeze', 'heal'], color: '#4fc3f7' },
    { name: '藤蔓德鲁伊·希尔', maxHp: 65, moveRange: 3, faction: 'nature', skills: ['drain', 'meteor', 'burn'], color: '#81c784' },
    { name: '雷霆审判者·托尔', maxHp: 68, moveRange: 3, faction: 'cryo', skills: ['lightning', 'stun', 'heal'], color: '#29b6f6' },
    { name: '剧毒巫医·摩格', maxHp: 62, moveRange: 2, faction: 'nature', skills: ['poison', 'shadowbolt', 'drain'], color: '#9ccc65' },
  ];

  // ---- Boss 单位（第 6 关） ----
  const BOSS_UNITS = [
    { name: '大魔导师·马尔佐斯', maxHp: 150, moveRange: 3, faction: 'pyro', isBoss: true, skills: ['meteor', 'fireball', 'poison'], color: '#ff5252' },
  ];

  // ---- 地图（≥6 张战役地图，含地形：掩体 cover / 危险格 hazard） ----
  const MAPS = [
    { id: 'plains',  name: '平原', biome: 'grassland', cover: [], hazard: [] },
    { id: 'forest',  name: '森林', biome: 'forest',
      cover: [{ gx: 3, gy: 1 }, { gx: 3, gy: 3 }, { gx: 4, gy: 5 }, { gx: 4, gy: 6 }], hazard: [] },
    { id: 'snow',    name: '雪山', biome: 'snow',
      cover: [{ gx: 3, gy: 4 }], hazard: [{ gx: 4, gy: 2 }, { gx: 4, gy: 5 }, { gx: 3, gy: 6 }] },
    { id: 'ruins',   name: '废墟', biome: 'ruins',
      cover: [{ gx: 2, gy: 2 }, { gx: 5, gy: 5 }], hazard: [{ gx: 4, gy: 1 }, { gx: 3, gy: 5 }] },
    { id: 'volcano', name: '火山', biome: 'volcano',
      cover: [{ gx: 3, gy: 3 }], hazard: [{ gx: 2, gy: 4 }, { gx: 5, gy: 3 }, { gx: 4, gy: 6 }, { gx: 3, gy: 1 }] },
    { id: 'swamp',   name: '沼泽', biome: 'swamp',
      cover: [{ gx: 2, gy: 5 }, { gx: 5, gy: 2 }], hazard: [{ gx: 3, gy: 2 }, { gx: 4, gy: 4 }, { gx: 3, gy: 5 }] },
  ];

  // ---- 战役（≥6 关递进，第 6 关为 Boss 战） ----
  const CAMPAIGN = [
    { level: 1, name: '第一关 · 平原哨探', map: 0, enemies: [{ src: 'enemy', i: 0 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 2 }] },
    { level: 2, name: '第二关 · 林间伏击', map: 1, enemies: [{ src: 'enemy', i: 3 }, { src: 'enemy', i: 0 }, { src: 'enemy', i: 6 }] },
    { level: 3, name: '第三关 · 雪原围困', map: 2, enemies: [{ src: 'enemy', i: 4 }, { src: 'enemy', i: 1 }, { src: 'enemy', i: 7 }] },
    { level: 4, name: '第四关 · 废墟争夺', map: 3, enemies: [{ src: 'enemy', i: 2 }, { src: 'enemy', i: 5 }, { src: 'enemy', i: 6 }] },
    { level: 5, name: '第五关 · 熔岩险境', map: 4, enemies: [{ src: 'enemy', i: 3 }, { src: 'enemy', i: 4 }, { src: 'enemy', i: 7 }] },
    { level: 6, name: '第六关 · 大魔导师决战 (BOSS)', map: 5, boss: true, enemies: [{ src: 'enemy', i: 1 }, { src: 'enemy', i: 2 }, { src: 'boss', i: 0 }] },
  ];

  // ---- 游戏状态 ----
  let canvas, ctx;
  // 性能优化（Stage 3 · 性能优化）：静态层离屏缓存，地图不变时背景+网格+地形只绘制一次
  let staticCanvas = null, staticCtx = null, staticMapId = null;
  let staticRebuilds = 0; // 性能自检计数：静态层重建次数（每地图仅一次）
  let units = [];
  let selectedUnit = null;
  let phase = 'selectUnit'; // selectUnit | move | selectTarget | enemyTurn | gameOver
  let turnNum = 1;
  let floaters = []; // 飘字反馈队列（伤害/治疗/状态结算），render 时逐帧上浮淡出
  let playerTurnIndex = 0;
  let moveHighlightCells = [];
  let attackHighlightCells = [];
  let logs = [];
  let activeSkill = null;
  let saveData = { wins: 0, losses: 0, unlockedLevel: 1 };
  let currentMap = null;
  let gameMode = null;        // 'campaign' | 'skirmish'
  let currentCampaignLevel = 0;
  let difficulty = 'normal'; // Stage 3 · 难度选择（默认普通）

  // ---- 初始化 ----
  function init() {
    canvas = document.getElementById('arena');
    ctx = canvas.getContext('2d');
    loadSave();
    currentMap = MAPS[0];
    canvas.addEventListener('click', onCanvasClick);
    render();
    showMenu(); // 进入主菜单（战役 / 遭遇）
  }

  // ---- 开局：根据 setup 部署战场 ----
  function startBattle(setup) {
    currentMap = MAPS[setup.map];
    units = [];
    selectedUnit = null;
    phase = 'selectUnit';
    turnNum = 1;
    playerTurnIndex = 0;
    moveHighlightCells = [];
    attackHighlightCells = [];
    activeSkill = null;
    logs = [];
    const logEl = document.getElementById('log-content');
    if (logEl) logEl.innerHTML = '';
    // 放置玩家单位（左侧 gx=1，行 1/3/5）
    PLAYER_UNITS.forEach((def, i) => units.push(createUnit(def, 'player', 1, [1, 3, 5][i])));
    // 放置敌方单位（右侧 gx=6，行 1/3/5）
    setup.enemies.forEach((ref, i) => {
      const def = ref.src === 'boss' ? BOSS_UNITS[ref.i] : ENEMY_UNITS[ref.i];
      units.push(createUnit(def, 'enemy', 6, [1, 3, 5][i]));
    });
    updateUI();
    updateBattlePrediction();
    render();
  }

  function createUnit(def, team, gx, gy) {
    // 难度缩放：仅敌方单位受影响（玩家小队保持 §2.2 基准），保证公平
    const d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const hpMul = team === 'enemy' ? d.hpMul : 1;
    const dmgMul = team === 'enemy' ? d.dmgMul : 1;
    const maxHp = Math.max(1, Math.round(def.maxHp * hpMul));
    return {
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
      acted: false,
      stunned: false,
      burnTurns: 0,
      burnDmg: 0,
      frozenTurns: 0,
      poisonTurns: 0,
      poisonDmg: 0,
      blindTurns: 0,
    };
  }

  // ---- 主菜单 / 模式选择 ----
  function showMenu() {
    closeOverlay();
    const stats = document.getElementById('menu-stats');
    if (stats) stats.textContent = `战绩: ${saveData.wins}胜 / ${saveData.losses}负 · 战役进度: 已解锁 ${saveData.unlockedLevel || 1}/6 关`;
    const lv = document.getElementById('menu-levels');
    if (lv) {
      lv.innerHTML = CAMPAIGN.map(c => {
        const locked = c.level > (saveData.unlockedLevel || 1);
        return `<button class="menu-btn" ${locked ? 'disabled' : ''} onclick="Game.startCampaign(${c.level})">${locked ? '🔒 ' : ''}${c.name}</button>`;
      }).join('');
    }
    const menu = document.getElementById('menu');
    if (menu) menu.style.display = 'flex';
  }

  function startCampaign(level) {
    const c = CAMPAIGN.find(x => x.level === level);
    if (!c) return;
    const menu = document.getElementById('menu');
    if (menu) menu.style.display = 'none';
    closeOverlay();
    gameMode = 'campaign';
    currentCampaignLevel = level;
    startBattle({ map: c.map, enemies: c.enemies });
  }

  function startSkirmish() {
    const menu = document.getElementById('menu');
    if (menu) menu.style.display = 'none';
    closeOverlay();
    gameMode = 'skirmish';
    currentCampaignLevel = 0;
    const mapIdx = Math.floor(Math.random() * MAPS.length);
    const pool = [0, 1, 2, 3, 4, 5, 6, 7];
    shuffle(pool);
    const enemies = pool.slice(0, 3).map(i => ({ src: 'enemy', i }));
    startBattle({ map: mapIdx, enemies });
  }

  function retry() {
    closeOverlay();
    if (gameMode === 'campaign') startCampaign(currentCampaignLevel);
    else startSkirmish();
  }

  // ---- 难度选择（Stage 3 · 数值平衡子系统） ----
  function setDifficulty(d) {
    if (!DIFFICULTY[d]) return;
    difficulty = d;
    ['easy', 'normal', 'hard'].forEach(n => {
      const btn = document.getElementById('diff-' + n);
      if (btn) btn.className = 'diff-btn' + (n === d ? ' active' : '');
    });
    const el = document.getElementById('menu-difficulty');
    if (el) el.textContent = `当前难度: ${DIFFICULTY[d].name}（敌方 HP×${DIFFICULTY[d].hpMul} / 伤害×${DIFFICULTY[d].dmgMul}）`;
    addLog(`难度已设为「${DIFFICULTY[d].name}」，将影响后续战斗的敌方强度`, 'info');
  }

  // ---- 坐标工具 ----
  function cellToPixel(gx, gy) { return { x: gx * CELL, y: gy * CELL }; }
  function pixelToCell(px, py) { return { gx: Math.floor(px / CELL), gy: Math.floor(py / CELL) }; }
  function cellDist(a, b) { return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy); }
  function cellDistPt(gx1, gy1, gx2, gy2) { return Math.abs(gx1 - gx2) + Math.abs(gy1 - gy2); }
  function getUnitAt(gx, gy) { return units.find(u => u.gx === gx && u.gy === gy && u.hp > 0); }
  function coverAt(gx, gy) { return !!(currentMap && currentMap.cover && currentMap.cover.some(c => c.gx === gx && c.gy === gy)); }
  function hazardAt(gx, gy) { return !!(currentMap && currentMap.hazard && currentMap.hazard.some(c => c.gx === gx && c.gy === gy)); }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 承受伤害（掩体减伤）
  // 飘字反馈：在指定格上方弹出一段文字（伤害/治疗/状态结算），render 时上浮淡出
  function pushFloater(gx, gy, text, kind) {
    floaters.push({ gx, gy, text, kind: kind || 'damage', life: 30 });
  }

  function damageUnit(target, dmg, attacker) {
    let actual = dmg;
    if (attacker && attacker.blindTurns > 0) actual = Math.floor(actual * 0.5); // 致盲：输出伤害降低50%
    if (coverAt(target.gx, target.gy)) actual = Math.floor(actual * COVER_REDUCE);
    target.hp -= actual;
    pushFloater(target.gx, target.gy, '-' + actual, 'damage');
    return actual;
  }

  // ---- 渲染（性能优化：静态层离屏缓存，每地图仅绘制一次） ----
  // 背景 + 网格线 + 地形(掩体/危险格) 在地图不变时只绘制一次到离屏画布，
  // 之后每次交互帧仅做 drawImage 合成 + 动态层(高亮/单位)，Canvas 开销大幅下降。
  function buildStaticLayer() {
    if (!staticCanvas) {
      staticCanvas = document.createElement('canvas');
      staticCanvas.width = GRID * CELL;
      staticCanvas.height = GRID * CELL;
      staticCtx = staticCanvas.getContext('2d');
    }
    const c = staticCtx;
    // 背景
    c.fillStyle = COLORS.gridBg;
    c.fillRect(0, 0, GRID * CELL, GRID * CELL);
    // 网格线
    c.strokeStyle = COLORS.gridLine;
    c.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      c.beginPath(); c.moveTo(i * CELL, 0); c.lineTo(i * CELL, GRID * CELL); c.stroke();
      c.beginPath(); c.moveTo(0, i * CELL); c.lineTo(GRID * CELL, i * CELL); c.stroke();
    }
    // 地形：掩体(cover) / 危险格(hazard)
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

  function drawHighlights() {
    // 移动高亮
    moveHighlightCells.forEach(({ gx, gy }) => {
      ctx.fillStyle = COLORS.moveHighlight;
      ctx.fillRect(gx * CELL + 2, gy * CELL + 2, CELL - 4, CELL - 4);
    });
    // 攻击高亮
    attackHighlightCells.forEach(({ gx, gy }) => {
      ctx.fillStyle = COLORS.attackHighlight;
      ctx.fillRect(gx * CELL + 2, gy * CELL + 2, CELL - 4, CELL - 4);
    });
  }

  function drawUnits() {
    units.forEach(u => {
      if (u.hp <= 0) return;
      const px = u.gx * CELL + CELL / 2;
      const py = u.gy * CELL + CELL / 2;
      // 选中光环
      if (selectedUnit === u) {
        ctx.beginPath();
        ctx.arc(px, py, CELL / 2 - 4, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      // 单位圆形
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.fillStyle = u.color;
      ctx.fill();
      ctx.strokeStyle = u.team === 'player' ? '#fff' : '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 名称首字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(u.name.charAt(0), px, py - 2);
      // Boss 标记
      if (u.isBoss) {
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('★BOSS', px, py - 34);
      }
      // HP 条
      const hpW = 50, hpH = 6;
      const hpX = px - hpW / 2, hpY = py + 16;
      ctx.fillStyle = '#333';
      ctx.fillRect(hpX, hpY, hpW, hpH);
      const hpRatio = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = u.team === 'player' ? COLORS.hpGreen : COLORS.hpRed;
      ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
      // 已行动标记
      if (u.acted) {
        ctx.fillStyle = 'rgba(128,128,128,0.5)';
        ctx.beginPath();
        ctx.arc(px, py, 28, 0, Math.PI * 2);
        ctx.fill();
      }
      // 眩晕标记
      if (u.stunned) {
        ctx.fillStyle = '#e0a0ff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('晕', px, py - 30);
      }
      // 灼烧标记
      if (u.burnTurns > 0) {
        ctx.fillStyle = '#ff7043';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('燃', px, py + 30);
      }
      // 冰冻标记（左侧）
      if (u.frozenTurns > 0) {
        ctx.fillStyle = '#4fc3f7';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('冰', px - 30, py);
      }
      // 中毒标记（右侧）
      if (u.poisonTurns > 0) {
        ctx.fillStyle = '#9e9d24';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('毒', px + 30, py);
      }
      // 致盲标记（左上）
      if (u.blindTurns > 0) {
        ctx.fillStyle = '#b39ddb';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('盲', px - 30, py - 30);
      }
    });
  }

  // ---- 飘字反馈渲染（方向4 体验打磨） ----
  // 每次 render 调用：随存活帧上浮并淡出；life 递减至 0 后移除。
  function drawFloaters() {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      const rise = (30 - f.life) * 1.2;              // 越接近消失，上浮越多
      const px = f.gx * CELL + CELL / 2;
      const py = f.gy * CELL + CELL / 2 - 30 - rise;
      let color = '#ff5252';
      if (f.kind === 'heal') color = '#69f0ae';
      else if (f.kind === 'burn') color = '#ff7043';
      else if (f.kind === 'poison') color = '#cddc39';
      else if (f.kind === 'hazard') color = '#ff8a80';
      else if (f.kind === 'status') color = '#e0a0ff';
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

  // ---- 点击处理 ----
  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { gx, gy } = pixelToCell(px, py);
    if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) return;

    if (phase === 'selectUnit') {
      handleSelectUnit(gx, gy);
    } else if (phase === 'move') {
      handleMove(gx, gy);
    } else if (phase === 'selectTarget') {
      handleSelectTarget(gx, gy);
    }
    // enemyTurn / gameOver 阶段忽略点击
  }

  function handleSelectUnit(gx, gy) {
    const u = getUnitAt(gx, gy);
    if (!u || u.team !== 'player' || u.acted) {
      // 点击空地或已行动单位 → 取消选中
      if (!u) {
        selectedUnit = null;
        moveHighlightCells = [];
        attackHighlightCells = [];
        updateUI();
        render();
      }
      return;
    }
    selectedUnit = u;
    moveHighlightCells = [];
    attackHighlightCells = [];
    phase = 'selectUnit';
    updateUI();
    render();
  }

  function handleMove(gx, gy) {
    if (!selectedUnit) return;
    const target = getUnitAt(gx, gy);
    const isHighlighted = moveHighlightCells.some(c => c.gx === gx && c.gy === gy);
    if (isHighlighted && !target) {
      // 执行移动
      addLog(`${selectedUnit.name} 移动到 (${gx},${gy})`, 'move');
      selectedUnit.gx = gx;
      selectedUnit.gy = gy;
      moveHighlightCells = [];
      phase = 'selectUnit';
      updateUI();
      render();
    } else {
      // 取消移动模式，回到选择
      moveHighlightCells = [];
      phase = 'selectUnit';
      updateUI();
      render();
    }
  }

  function handleSelectTarget(gx, gy) {
    if (!selectedUnit || !activeSkill) return;
    const target = getUnitAt(gx, gy);
    const isHighlighted = attackHighlightCells.some(c => c.gx === gx && c.gy === gy);

    if (!isHighlighted) {
      attackHighlightCells = [];
      activeSkill = null;
      phase = 'selectUnit';
      updateUI();
      render();
      return;
    }

    // 治愈术对友方、眩晕术对敌方；其余伤害技能（单体/范围）以点击格为中心结算
    if (activeSkill.isHeal) {
      if (target && target.team === selectedUnit.team) {
        applySkill(selectedUnit, gx, gy, activeSkill);
      } else {
        addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选友方）`, 'info');
        attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
      }
    } else if (activeSkill.isStun) {
      if (target && target.team !== selectedUnit.team) {
        applySkill(selectedUnit, gx, gy, activeSkill);
      } else {
        addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选敌方）`, 'info');
        attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
      }
    } else if (activeSkill.isBurn) {
      if (target && target.team !== selectedUnit.team) {
        applySkill(selectedUnit, gx, gy, activeSkill);
      } else {
        addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选敌方）`, 'info');
        attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
      }
    } else if (activeSkill.isFreeze) {
      if (target && target.team !== selectedUnit.team) {
        applySkill(selectedUnit, gx, gy, activeSkill);
      } else {
        addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选敌方）`, 'info');
        attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
      }
    } else if (activeSkill.isPoison) {
      if (target && target.team !== selectedUnit.team) {
        applySkill(selectedUnit, gx, gy, activeSkill);
      } else {
        addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选敌方）`, 'info');
        attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
      }
    } else if (activeSkill.isBlind) {
      if (target && target.team !== selectedUnit.team) {
        applySkill(selectedUnit, gx, gy, activeSkill);
      } else {
        addLog(`${selectedUnit.name} 取消施放 ${activeSkill.name}（无效目标：需选敌方）`, 'info');
        attackHighlightCells = []; activeSkill = null; phase = 'selectUnit'; updateUI(); render(); return;
      }
    } else {
      // 单体或范围伤害：以点击格为中心；范围技能会波及周围敌方（含空地中心）
      applySkill(selectedUnit, gx, gy, activeSkill);
    }

    attackHighlightCells = [];
    activeSkill = null;
    selectedUnit.acted = true;
    checkGameEnd();
    if (phase !== 'gameOver') {
      selectNextPlayerUnit(); // 自动选下一个未行动单位，减少手动点击
    } else {
      updateUI();
      render();
    }
  }

  function applySkill(attacker, gx, gy, skill) {
    if (skill.isHeal) {
      const t = getUnitAt(gx, gy);
      if (!t || t.team !== attacker.team) return; // 安全：仅治疗友方
      const healAmt = Math.abs(skill.dmg);
      let actualHeal = healAmt;
      let poisonNote = '';
      if (t.poisonTurns > 0) {
        actualHeal = Math.floor(healAmt / 2); // 中毒期间治疗减半
        poisonNote = '（中毒·治疗减半）';
      }
      t.hp = Math.min(t.maxHp, t.hp + actualHeal);
      pushFloater(t.gx, t.gy, '+' + actualHeal, 'heal');
      addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，回复 ${actualHeal} HP${poisonNote}`, 'heal');
      skill.cd = skill.cooldown;
      return;
    }
    // 眩晕（控制）：使敌方目标下个回合无法行动
    if (skill.isStun) {
      const t = getUnitAt(gx, gy);
      if (!t || t.team === attacker.team) { skill.cd = 0; return; } // 安全兜底
      t.stunned = true;
      pushFloater(t.gx, t.gy, '眩晕', 'status');
      addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标下回合将被眩晕`, 'damage');
      skill.cd = skill.cooldown;
      return;
    }
    // 灼烧（持续伤害 DoT）
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
    // 冰冻（控制/定身）
    if (skill.isFreeze) {
      const t = getUnitAt(gx, gy);
      if (!t || t.team === attacker.team) { skill.cd = 0; return; }
      const dealt = damageUnit(t, skill.dmg, attacker);
      t.frozenTurns = Math.max(t.frozenTurns, skill.freezeTurns);
      pushFloater(t.gx, t.gy, '冰冻', 'status');
      addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，造成 ${dealt} 伤害并使其被冰冻（剩余 ${t.frozenTurns} 回合无法移动）`, 'damage');
      skill.cd = skill.cooldown;
      return;
    }
    // 中毒（持续伤害 DoT + 治疗削弱）
    if (skill.isPoison) {
      const t = getUnitAt(gx, gy);
      if (!t || t.team === attacker.team) { skill.cd = 0; return; }
      const dealt = damageUnit(t, skill.dmg);
      t.poisonTurns = skill.poisonTurns; // 刷新中毒持续回合
      t.poisonDmg = Math.min(t.poisonDmg + skill.poisonDmg, skill.poisonMax); // 叠加毒性伤害（上限）
      pushFloater(t.gx, t.gy, '中毒', 'status');
      addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，造成 ${dealt} 直接伤害并使其中毒（剩余 ${t.poisonTurns} 回合·每回合 ${t.poisonDmg} 伤害·治疗减半）`, 'damage');
      skill.cd = skill.cooldown;
      return;
    }
    // 致盲（削弱敌方输出：致盲期间其造成的伤害降低50%）
    if (skill.isBlind) {
      const t = getUnitAt(gx, gy);
      if (!t || t.team === attacker.team) { skill.cd = 0; return; }
      t.blindTurns = Math.max(t.blindTurns, skill.blindTurns);
      pushFloater(t.gx, t.gy, '致盲', 'status');
      addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，目标被致盲（剩余 ${t.blindTurns} 回合·伤害降低50%）`, 'damage');
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
          addLog(`${attacker.name} 的 ${skill.name} 波及 ${t.name}，造成 ${dealt} 伤害（剩余 ${Math.max(0, t.hp)} HP）`, 'damage');
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
    addLog(`${attacker.name} 对 ${t.name} 施放 ${skill.name}，造成 ${dealt} 伤害（剩余 ${Math.max(0, t.hp)} HP）`, 'damage');
    if (skill.selfHeal) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + skill.selfHeal);
      addLog(`${attacker.name} 汲取回复 ${skill.selfHeal} HP`, 'heal');
    }
    skill.cd = skill.cooldown;
  }

  // ---- 行动按钮 ----
  function startMove() {
    if (!selectedUnit || selectedUnit.acted || phase !== 'selectUnit') return;
    if (selectedUnit.frozenTurns > 0) {
      addLog(`${selectedUnit.name} 被冰冻，无法移动`, 'info');
      return;
    }
    moveHighlightCells = getMoveCells(selectedUnit);
    attackHighlightCells = [];
    phase = 'move';
    updateUI();
    render();
  }

  function getMoveCells(u) {
    const cells = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (cellDistPt(u.gx, u.gy, x, y) <= u.moveRange && !getUnitAt(x, y)) {
          cells.push({ gx: x, gy: y });
        }
      }
    }
    return cells;
  }

  function castSkill(skillIdx) {
    if (!selectedUnit || selectedUnit.acted) return;
    const skill = selectedUnit.skills[skillIdx];
    if (skill.cd > 0) return;
    activeSkill = skill;
    attackHighlightCells = getAttackCells(selectedUnit, skill);
    moveHighlightCells = [];
    phase = 'selectTarget';
    updateUI();
    render();
  }

  function getAttackCells(u, skill) {
    const cells = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (cellDistPt(u.gx, u.gy, x, y) <= skill.range) {
          cells.push({ gx: x, gy: y });
        }
      }
    }
    return cells;
  }

  function skipUnit() {
    if (!selectedUnit || selectedUnit.acted) return;
    selectedUnit.acted = true;
    addLog(`${selectedUnit.name} 跳过行动`, 'info');
    selectNextPlayerUnit(); // 自动选下一个未行动单位
  }

  // 自动选下一个未行动玩家单位，减少手动点击（手感优化）
  function selectNextPlayerUnit() {
    const next = units.find(u => u.team === 'player' && u.hp > 0 && !u.acted);
    selectedUnit = next || null;
    moveHighlightCells = [];
    attackHighlightCells = [];
    activeSkill = null;
    phase = 'selectUnit';
    updateUI();
    render();
  }

  function endTurn() {
    // 标记所有未行动玩家单位为已行动
    units.filter(u => u.team === 'player' && u.hp > 0 && !u.acted).forEach(u => {
      u.acted = true;
      addLog(`${u.name} 未行动，自动跳过`, 'info');
    });
    selectedUnit = null;
    moveHighlightCells = [];
    attackHighlightCells = [];
    activeSkill = null;
    phase = 'enemyTurn';
    updateUI();
    render();
    // 敌方 AI
    setTimeout(() => executeEnemyTurn(), 500);
  }

  // ---- 敌方 AI (F5) ----
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

  // 按阵营风格排序攻击技能：skirmish 优先控制技，其余按伤害降序
  function sortedAttackSkills(unit, style) {
    const list = unit.skills.filter(s => s.cd <= 0 && !s.isHeal && !s.isBlind);
    if (style === 'skirmish') {
      const ctrl = s => (s.isStun ? 1 : 0) + (s.isFreeze ? 1 : 0) + (s.isPoison ? 1 : 0);
      return list.sort((a, b) => ctrl(b) - ctrl(a) || b.dmg - a.dmg);
    }
    return list.sort((a, b) => b.dmg - a.dmg);
  }

  function aiDecide(unit) {
    // 0. 获取所有存活玩家目标
    const targets = units.filter(u => u.team === 'player' && u.hp > 0);
    if (targets.length === 0) { unit.acted = true; return; }

    const style = (unit.faction && FACTIONS[unit.faction]) ? FACTIONS[unit.faction].aiStyle : 'aggressive';
    const healThreshold = style === 'defensive' ? 0.6 : 0.4; // 寒冰(防守)更早自保
    const hpRatio = unit.hp / unit.maxHp;

    // 1. 自保治疗（HP < 阈值 且有可用治愈术）
    if (hpRatio < healThreshold) {
      const healSkill = unit.skills.find(s => s.cd <= 0 && s.isHeal);
      if (healSkill) {
        const healAmt = Math.abs(healSkill.dmg);
        let actualHeal = healAmt;
        if (unit.poisonTurns > 0) actualHeal = Math.floor(healAmt / 2); // 中毒期间治疗减半
        unit.hp = Math.min(unit.maxHp, unit.hp + actualHeal);
        healSkill.cd = healSkill.cooldown;
        addLog(`${unit.name} 施放 ${healSkill.name}，回复 ${actualHeal} HP${unit.poisonTurns > 0 ? '（中毒·治疗减半）' : ''}`, 'heal');
        unit.acted = true;
        return;
      }
    }

    // 2. 攻击技能（按风格排序，优先斩杀低HP目标）
    const attackSkills = sortedAttackSkills(unit, style);
    for (const skill of attackSkills) {
      const inRange = targets.filter(t => cellDist(unit, t) <= skill.range);
      if (inRange.length > 0) {
        const target = inRange.sort((a, b) => a.hp - b.hp)[0];
        applySkill(unit, target.gx, target.gy, skill);
        unit.acted = true;
        return;
      }
    }

    // 3. 移动靠近最近目标（被冰冻时无法移动，跳过本步但仍可原地攻击/治疗）
    let moveCells = [];
    if (unit.frozenTurns <= 0) {
      const closest = targets.sort((a, b) => cellDist(unit, a) - cellDist(unit, b))[0];
      moveCells = getMoveCells(unit);
      if (moveCells.length > 0) {
        let bestCell = moveCells.sort((a, b) =>
          cellDistPt(a.gx, a.gy, closest.gx, closest.gy) - cellDistPt(b.gx, b.gy, closest.gx, closest.gy)
        )[0];
        // 寒冰(防守)/自然(游击) 优先占据掩体格
        if (style === 'defensive' || style === 'skirmish') {
          const coverCells = moveCells.filter(c => coverAt(c.gx, c.gy));
          if (coverCells.length > 0) {
            bestCell = coverCells.sort((a, b) =>
              cellDistPt(a.gx, a.gy, closest.gx, closest.gy) - cellDistPt(b.gx, b.gy, closest.gx, closest.gy)
            )[0];
          }
        }
        addLog(`${unit.name} 移动到 (${bestCell.gx},${bestCell.gy})`, 'move');
        unit.gx = bestCell.gx;
        unit.gy = bestCell.gy;
      }
    }

    // 4. 移动后攻击（同2逻辑）
    const skillsAfterMove = sortedAttackSkills(unit, style);
    for (const skill of skillsAfterMove) {
      const inRange = targets.filter(t => cellDist(unit, t) <= skill.range);
      if (inRange.length > 0) {
        const target = inRange.sort((a, b) => a.hp - b.hp)[0];
        applySkill(unit, target.gx, target.gy, skill);
        unit.acted = true;
        return;
      }
    }

    // 5. 治疗兜底：移动后若 HP < 阈值 且治愈可用
    if (hpRatio < healThreshold) {
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

    // 6. 无可用行动，跳过
    unit.acted = true;
    const usableSkills = unit.skills.filter(s => s.cd <= 0).length;
    if (usableSkills === 0 && moveCells.length === 0) {
      addLog(`${unit.name} 技能全部冷却且无法移动，休息一回合`, 'info');
    } else {
      addLog(`${unit.name} 无法行动，跳过`, 'info');
    }
  }

  // ---- 回合管理 ----
  function nextTurn() {
    turnNum++;
    // 重置所有单位的行动状态和技能冷却，并结算持续伤害 / 地形
    units.forEach(u => {
      u.acted = false;
      u.skills.forEach(s => { if (s.cd > 0) s.cd--; });
      if (u.burnTurns > 0) {
        const d = u.burnDmg;
        u.hp -= d;
        u.burnTurns--;
        pushFloater(u.gx, u.gy, '燃' + d, 'burn');
        addLog(`${u.name} 受到燃烧伤害 ${d}（剩余 ${u.burnTurns} 回合）`, 'damage');
      }
      if (u.poisonTurns > 0) {
        const d = u.poisonDmg;
        u.hp -= d;
        u.poisonTurns--;
        pushFloater(u.gx, u.gy, '毒' + d, 'poison');
        addLog(`${u.name} 受到毒性伤害 ${d}（剩余 ${u.poisonTurns} 回合）`, 'damage');
      }
      if (u.blindTurns > 0) {
        u.blindTurns--;
        if (u.blindTurns === 0) addLog(`${u.name} 致盲解除，伤害恢复`, 'info');
      }
      if (u.frozenTurns > 0) {
        u.frozenTurns--;
        if (u.frozenTurns === 0) addLog(`${u.name} 冰冻解除，可再次移动`, 'info');
      }
      // 危险格环境伤害（不区分阵营）
      if (u.hp > 0 && hazardAt(u.gx, u.gy)) {
        u.hp -= HAZARD_DMG;
        pushFloater(u.gx, u.gy, '危' + HAZARD_DMG, 'hazard');
        addLog(`${u.name} 处于危险格，受到 ${HAZARD_DMG} 点环境伤害`, 'damage');
      }
    });
    checkGameEnd(); // 持续伤害 / 危险格可能致死 → 立即判定胜负
    if (phase === 'gameOver') { updateUI(); render(); return; }
    phase = 'selectUnit';
    selectedUnit = null;
    moveHighlightCells = [];
    attackHighlightCells = [];
    addLog(`— 回合 ${turnNum} 开始 —`, 'info');
    updateUI();
    render();
  }

  // ---- 胜负判定 (F4) + 战役进度 ----
  function checkGameEnd() {
    const playerAlive = units.filter(u => u.team === 'player' && u.hp > 0).length;
    const enemyAlive = units.filter(u => u.team === 'enemy' && u.hp > 0).length;
    if (playerAlive === 0) {
      phase = 'gameOver';
      saveData.losses++;
      saveSave();
      addLog('【战斗结束】玩家失败', 'damage');
      if (gameMode === 'campaign') setOverlayAction('重试本关', `Game.startCampaign(${currentCampaignLevel})`);
      else setOverlayAction('再来一局', 'Game.startSkirmish()');
      showOverlay('战斗失败', '你的法师小队已全军覆没...');
    } else if (enemyAlive === 0) {
      phase = 'gameOver';
      saveData.wins++;
      let msg = '敌方已被全部消灭！';
      if (gameMode === 'campaign') {
        if (currentCampaignLevel < CAMPAIGN.length) {
          saveData.unlockedLevel = Math.max(saveData.unlockedLevel || 1, currentCampaignLevel + 1);
          saveSave();
          setOverlayAction('进入下一关 ▶', `Game.startCampaign(${currentCampaignLevel + 1})`);
          msg = '已解锁下一关！';
        } else {
          saveSave();
          setOverlayAction('🎉 返回主菜单', 'Game.showMenu()');
          msg = '恭喜通关全部战役！';
        }
      } else {
        setOverlayAction('再来一局', 'Game.startSkirmish()');
      }
      addLog('【战斗结束】玩家胜利', 'heal');
      showOverlay('战斗胜利', msg);
    }
  }

  // ---- 本地存档 (F6) ----
  function sanitizeSave(obj) {
    const toCount = (v) => {
      const n = Math.floor(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const base = { wins: toCount(obj && obj.wins), losses: toCount(obj && obj.losses) };
    const ul = Math.floor(Number(obj && obj.unlockedLevel));
    base.unlockedLevel = (Number.isFinite(ul) && ul >= 1 && ul <= CAMPAIGN.length) ? ul : 1;
    return base;
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem('magicArenaSave');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') saveData = sanitizeSave(parsed);
      }
    } catch (e) { /* ignore corrupt save */ }
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

  // ---- UI 更新 ----
  function updateUI() {
    // 回合 & 阶段
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

    // 单位信息
    const detailEl = document.getElementById('unit-detail');
    const hpFill = document.getElementById('hp-fill');
    const hpText = document.getElementById('hp-text');
    if (selectedUnit) {
      const factionName = (selectedUnit.faction && FACTIONS[selectedUnit.faction]) ? FACTIONS[selectedUnit.faction].name : '—';
      detailEl.innerHTML = `<strong>${selectedUnit.name}</strong>${selectedUnit.isBoss ? ' <span style="color:#ffd54f">★BOSS</span>' : ''}<br>阵营: ${factionName}<br>团队: ${selectedUnit.team === 'player' ? '玩家' : '敌方'}<br>位置: (${selectedUnit.gx},${selectedUnit.gy})${selectedUnit.stunned ? '<br><span style="color:#e0a0ff">⚡ 眩晕中</span>' : ''}${selectedUnit.burnTurns > 0 ? '<br><span style="color:#ff7043">🔥 灼烧中(' + selectedUnit.burnTurns + '回合)</span>' : ''}${selectedUnit.frozenTurns > 0 ? '<br><span style="color:#4fc3f7">❄ 冰冻中(' + selectedUnit.frozenTurns + '回合·无法移动)</span>' : ''}${selectedUnit.poisonTurns > 0 ? '<br><span style="color:#9e9d24">☠ 中毒中(' + selectedUnit.poisonTurns + '回合·治疗减半)</span>' : ''}${selectedUnit.blindTurns > 0 ? '<br><span style="color:#b39ddb">👁 致盲中(' + selectedUnit.blindTurns + '回合·伤害降低50%)</span>' : ''}`;
      const ratio = Math.max(0, selectedUnit.hp / selectedUnit.maxHp) * 100;
      hpFill.style.width = ratio + '%';
      hpFill.className = 'hp-fill ' + (selectedUnit.team === 'player' ? 'player' : 'enemy');
      hpText.textContent = `HP: ${Math.max(0, selectedUnit.hp)} / ${selectedUnit.maxHp}`;
    } else {
      detailEl.textContent = '点击战场上的单位查看详情';
      hpFill.style.width = '0%';
      hpText.textContent = '';
    }

    // 技能面板
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

    // 行动按钮状态
    document.getElementById('btn-move').disabled = !selectedUnit || selectedUnit.acted || phase !== 'selectUnit';
    document.getElementById('btn-end-turn').disabled = phase === 'enemyTurn' || phase === 'gameOver';
    document.getElementById('btn-skip').disabled = !selectedUnit || selectedUnit.acted;

    // 战绩
    document.getElementById('win-count').textContent = saveData.wins;
    document.getElementById('lose-count').textContent = saveData.losses;

    // 战力评估 / 比分预测（实时刷新）
    updateBattlePrediction();
  }

  // ---- 日志 ----
  function addLog(text, type = 'info') {
    logs.push({ text, type });
    const el = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.textContent = text;
    el.appendChild(entry);
    el.scrollTop = el.scrollHeight;
  }

  // ---- 弹窗 ----
  function showOverlay(title, msg) {
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-msg').textContent = msg;
    document.getElementById('overlay').style.display = 'flex';
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
    document.getElementById('overlay').style.display = 'none';
    setOverlayAction(null);
  }

  function restart() {
    retry();
  }

  // ---- 取消操作 (Esc) ----
  function cancelAction() {
    if (phase === 'move') {
      moveHighlightCells = [];
      phase = 'selectUnit';
    } else if (phase === 'selectTarget') {
      attackHighlightCells = [];
      activeSkill = null;
      phase = 'selectUnit';
    }
    updateUI();
    render();
  }

  // ---- 战力评估 / 比分预测（方向3 系统新创 · 纯函数 · 零侵入战斗逻辑） ----
  // 在进入战斗前给出双方战力评分与胜率预测，让玩家"看下比赛比得分"再决定是否开打。
  // 仅读取单位快照（maxHp / skills / moveRange），不参与任何伤害 / 状态 / 胜负结算路径；
  // 暴露 predictOutcome / evaluateSideScore 供纯 Node 验证（无需浏览器）。
  function evaluateSideScore(list) {
    return (list || []).reduce((sum, u) => {
      if (!u || u.hp <= 0) return sum;
      let s = u.maxHp; // 生存力：血量即抗压资本
      (u.skills || []).forEach(sk => {
        if (sk.isHeal) {
          s += Math.abs(sk.dmg) * 1.5; // 治疗 = 续航价值
        } else {
          const rangeFactor = (sk.range || 1) / 3;          // 射程越远覆盖越好
          const cdFactor = 1 / ((sk.cooldown || 0) + 1);    // 冷却越短出手越密
          const aoeBonus = sk.aoeRadius > 0 ? sk.dmg * 0.5 : 0;
          s += (sk.dmg + aoeBonus) * rangeFactor * cdFactor;
        }
        if (sk.isStun || sk.isFreeze) s += 20;  // 控制价值
        if (sk.isBurn || sk.isPoison) s += 12;  // 持续伤害(DoT)价值
        if (sk.isBlind) s += 14;  // 致盲：削弱敌方输出价值
      });
      s += (u.moveRange || 0) * 5; // 机动性
      return sum + s;
    }, 0);
  }

  function predictOutcome(playerUnits, enemyUnits) {
    const ps = evaluateSideScore(playerUnits);
    const es = evaluateSideScore(enemyUnits);
    const scale = Math.max(30, (ps + es) * 0.15);
    const pWin = 1 / (1 + Math.exp(-(ps - es) / scale)); // 逻辑斯蒂：分差越大胜率越极端
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

  // ---- 性能自检钩子（Stage 3 · 性能优化 · 零侵入只读） ----
  // 仅暴露静态层缓存统计，供纯 Node 性能验证（无浏览器）断言；
  // 不修改任何游戏行为，浏览器运行时无副作用。
  function _perf() {
    return { staticRebuilds, hasStaticLayer: !!staticCanvas, staticMapId };
  }

  // ---- 启动 ----
  window.addEventListener('DOMContentLoaded', init);

  // ---- 测试钩子（Stage 3 · 测试全绿 · 零侵入只读快照） ----
  // 仅暴露内部状态的只读副本，供纯 Node 冒烟测试（无浏览器/Vitest）驱动与断言；
  // 不修改任何游戏行为，浏览器运行时无副作用。
  function _state() {
    return {
      phase, turnNum, gameMode, difficulty, currentCampaignLevel,
      currentMap: currentMap ? { id: currentMap.id, name: currentMap.name, cover: currentMap.cover, hazard: currentMap.hazard } : null,
      saveData: { ...saveData },
      floaters: floaters.map(f => ({ gx: f.gx, gy: f.gy, text: f.text, kind: f.kind, life: f.life })),
      units: units.map(u => ({
        id: u.id, name: u.name, team: u.team, faction: u.faction, isBoss: u.isBoss,
        hp: u.hp, maxHp: u.maxHp, gx: u.gx, gy: u.gy, moveRange: u.moveRange,
        acted: u.acted, stunned: u.stunned, burnTurns: u.burnTurns, frozenTurns: u.frozenTurns, poisonTurns: u.poisonTurns, blindTurns: u.blindTurns,
        skills: u.skills.map(s => ({ key: s.key, name: s.name, dmg: s.dmg, range: s.range, cooldown: s.cooldown, cd: s.cd, isHeal: !!s.isHeal, isStun: !!s.isStun, isBurn: !!s.isBurn, isFreeze: !!s.isFreeze, isPoison: !!s.isPoison, isBlind: !!s.isBlind, aoeRadius: s.aoeRadius })),
      })),
    };
  }

  // 暴露给 HTML onclick 的方法
  return { startMove, endTurn, skipUnit, castSkill, restart, closeOverlay, cancelAction, startCampaign, startSkirmish, showMenu, setDifficulty, _state, _perf, evaluateSideScore, predictOutcome, updateBattlePrediction };
})();
