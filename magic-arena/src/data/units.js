// ============================================================
// Data: Units — 所有单位定义（玩家 + 敌方 + Boss）
// ============================================================

const PLAYER_UNITS = [
  { name: '炎法师·艾拉', maxHp: 80, moveRange: 2, faction: 'pyro', unitType: 'mage', skills: ['fireball', 'burn', 'heal'], color: '#66bb6a' },
  { name: '雷法师·特斯拉', maxHp: 70, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'silence', 'taunt'], color: '#43a047' },
  { name: '暗法师·莫甘娜', maxHp: 65, moveRange: 2, faction: 'nature', unitType: 'mage', skills: ['meteor', 'vuln', 'blind'], color: '#81c784' },
  { name: '风行者·翠影', maxHp: 62, moveRange: 4, faction: 'nature', unitType: 'archer', skills: ['lightning', 'frostbolt', 'heal'], color: '#a5d6a7' },
  { name: '熔岩剑士·戈伦', maxHp: 92, moveRange: 2, faction: 'pyro', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#ff7043' },
];

const LIGHT_SQUAD = [
  { name: '圣光祭司·塞拉', maxHp: 72, moveRange: 2, faction: 'light', unitType: 'healer', skills: ['heal', 'smite', 'empower'], color: '#ffd54f' },
  { name: '圣堂守卫·加百列', maxHp: 88, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'heal', 'pull'], color: '#ffca28' },
  { name: '曙光射手·奥菲', maxHp: 64, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['lightning', 'smite', 'meteor'], color: '#ffe082' },
  { name: '圣盾使·乌列尔', maxHp: 90, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#ffd54f' },
  { name: '曦光咏者·提娅', maxHp: 74, moveRange: 2, faction: 'light', unitType: 'mage', skills: ['smite', 'meteor', 'heal'], color: '#fff176' },
];

const PLAYER_SQUADS = {
  classic: PLAYER_UNITS,
  light: LIGHT_SQUAD,
};

const ENEMY_UNITS = [
  { name: '骷髅法师·卡尔', maxHp: 75, moveRange: 2, faction: 'nature', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#ef5350' },
  { name: '暗影巫·维克', maxHp: 65, moveRange: 3, faction: 'cryo', unitType: 'mage', skills: ['lightning', 'shadowbolt', 'poison'], color: '#e53935' },
  { name: '亡灵术士·安娜', maxHp: 60, moveRange: 2, faction: 'pyro', unitType: 'healer', skills: ['meteor', 'drain', 'heal'], color: '#c62828' },
  { name: '烈焰术士·伊格尼斯', maxHp: 70, moveRange: 2, faction: 'pyro', unitType: 'mage', skills: ['fireball', 'burn', 'heal'], color: '#ff7043' },
  { name: '冰晶守卫·弗罗斯特', maxHp: 85, moveRange: 2, faction: 'cryo', unitType: 'warrior', skills: ['frostbolt', 'freeze', 'heal'], color: '#4fc3f7' },
  { name: '藤蔓德鲁伊·希尔', maxHp: 65, moveRange: 3, faction: 'nature', unitType: 'archer', skills: ['drain', 'meteor', 'burn'], color: '#81c784' },
  { name: '雷霆审判者·托尔', maxHp: 68, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'stun', 'heal'], color: '#29b6f6' },
  { name: '剧毒巫医·摩格', maxHp: 62, moveRange: 2, faction: 'nature', unitType: 'mage', skills: ['poison', 'shadowbolt', 'drain'], color: '#9ccc65' },
  { name: '圣光祭司·塞拉', maxHp: 72, moveRange: 2, faction: 'light', unitType: 'healer', skills: ['heal', 'smite', 'frostbolt'], color: '#ffd54f' },
  { name: '圣堂守卫·加百列', maxHp: 88, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'heal', 'stun'], color: '#ffca28' },
  { name: '曙光射手·奥菲', maxHp: 64, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['lightning', 'smite', 'meteor'], color: '#ffe082' },
  { name: '圣裁官·米迦勒', maxHp: 78, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['meteor', 'smite', 'blind'], color: '#fff176' },
  { name: '炎魔·巴尔', maxHp: 90, moveRange: 2, faction: 'pyro', unitType: 'warrior', skills: ['fireball', 'meteor', 'burn'], color: '#ff1744' },
  { name: '霜怨·艾尔莎', maxHp: 75, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['frostbolt', 'freeze', 'stun'], color: '#80d8ff' },
  { name: '腐化树人·古尔', maxHp: 95, moveRange: 2, faction: 'nature', unitType: 'warrior', skills: ['drain', 'poison', 'shadowbolt'], color: '#69f0ae' },
  { name: '雷暴使·诺瓦', maxHp: 72, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'stun', 'silence'], color: '#40c4ff' },
  // —— 星渊走廊新篇章（第13~15关）新增敌方单位 ——
  { name: '星陨武士·凯恩', maxHp: 78, moveRange: 3, faction: 'pyro', unitType: 'archer', skills: ['fireball', 'burn', 'stun'], color: '#ff8a65' },
  { name: '虚空咏者·莉莉丝', maxHp: 70, moveRange: 2, faction: 'cryo', unitType: 'mage', skills: ['shadowbolt', 'freeze', 'drain'], color: '#b39ddb' },
  { name: '裂隙守望·奥恩', maxHp: 90, moveRange: 2, faction: 'nature', unitType: 'warrior', skills: ['meteor', 'poison', 'heal'], color: '#80cbc4' },
  { name: '黯星射手·伊薇', maxHp: 66, moveRange: 3, faction: 'cryo', unitType: 'archer', skills: ['lightning', 'silence', 'frostbolt'], color: '#90caf9' },
  // —— 第三部「余烬回响」（第16~18关）新增敌方单位：审判之焰（圣光教会激进派）——
  { name: '审判使·塞拉斯', maxHp: 80, moveRange: 2, faction: 'light', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#fff59d' },
  { name: '燃光祭司·薇拉', maxHp: 68, moveRange: 2, faction: 'light', unitType: 'mage', skills: ['smite', 'meteor', 'heal'], color: '#fff176' },
  { name: '裁决射手·凯尔', maxHp: 66, moveRange: 3, faction: 'light', unitType: 'archer', skills: ['lightning', 'smite', 'poison'], color: '#ffee58' },
  // —— 隐藏章节「蚀教真相」（方向2 内容扩建 · 第四部后传）新增敌方单位：蚀教（禁忌灵脉）——
  { name: '蚀教祭品·莉雯', maxHp: 70, moveRange: 2, faction: 'eclipse', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#ab47bc' },
  { name: '虚蚀骑士·索伦', maxHp: 92, moveRange: 2, faction: 'eclipse', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#8e24aa' },
  { name: '咒缚咏者·弥娅', maxHp: 66, moveRange: 3, faction: 'eclipse', unitType: 'archer', skills: ['silence', 'lightning', 'blind'], color: '#ce93d8' },
  // —— 隐藏章节·第二卷「门彼之侧」（方向2 内容扩建）新增敌方单位：回响（源初灵脉分裂前的回响体）——
  { name: '回响使徒·瑟琳', maxHp: 72, moveRange: 2, faction: 'echo', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#b2ebf2' },
  { name: '回响守楔·卡戎', maxHp: 94, moveRange: 2, faction: 'echo', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#4dd0e1' },
  { name: '回响咏者·莉拉', maxHp: 68, moveRange: 3, faction: 'echo', unitType: 'archer', skills: ['silence', 'lightning', 'blind'], color: '#80deea' },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）新增敌方单位：溯光者（灵脉分裂之前的守忆者）——
  { name: '溯光咏史·琉恩', maxHp: 72, moveRange: 2, faction: 'primordial', unitType: 'mage', skills: ['shadowbolt', 'burn', 'drain'], color: '#ffe0b2' },
  { name: '溯光守垣·阿戈', maxHp: 94, moveRange: 2, faction: 'primordial', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#ffcc80' },
  { name: '溯光游隼·薇恩', maxHp: 68, moveRange: 3, faction: 'primordial', unitType: 'archer', skills: ['silence', 'lightning', 'blind'], color: '#ffe082' },
  // —— 外传六/外传七（方向2 内容扩建）新增敌方单位：锈铁佣兵团（无灵脉的凡人武装，靠灵械与弩炮据守商道）——
  { name: '锈铁佣兵队长·加尔', maxHp: 90, moveRange: 2, faction: 'rust', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#bcaaa4' },
  { name: '锈铁弩手·薇拉', maxHp: 66, moveRange: 3, faction: 'rust', unitType: 'archer', skills: ['lightning', 'silence', 'blind'], color: '#a1887f' },
  { name: '锈铁工兵·铎恩', maxHp: 78, moveRange: 2, faction: 'rust', unitType: 'mage', skills: ['meteor', 'poison', 'drain'], color: '#8d6e63' },
  // —— 外传七（方向2 内容扩建）新增敌方单位：灰烬构装体（玄雷塔失控灵械，核心被裂缝之外低语改写）——
  { name: '构装守卫·泰坦', maxHp: 95, moveRange: 2, faction: 'construct', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#90a4ae' },
  { name: '织雷机偶·瑟拉', maxHp: 68, moveRange: 3, faction: 'construct', unitType: 'archer', skills: ['lightning', 'silence', 'blind'], color: '#78909c' },
  { name: '熔心核心·伊格', maxHp: 72, moveRange: 2, faction: 'construct', unitType: 'mage', skills: ['meteor', 'burn', 'drain'], color: '#607d8b' },
  // —— 外传八/外传九（方向2 内容扩建）新增敌方单位：噬尘游民（灵脉危机后游荡于废墟与灰烬之间的拾荒商队，靠倒卖灵械与记忆维生）——
  { name: '沙掠者·卡兹', maxHp: 88, moveRange: 2, faction: 'dust', unitType: 'warrior', skills: ['fireball', 'stun', 'taunt'], color: '#c0a16b' },
  { name: '风语者·希瓦', maxHp: 66, moveRange: 3, faction: 'dust', unitType: 'archer', skills: ['lightning', 'silence', 'blind'], color: '#d7c4a1' },
  { name: '烬卜师·摩恩', maxHp: 72, moveRange: 2, faction: 'dust', unitType: 'mage', skills: ['meteor', 'poison', 'drain'], color: '#a8956e' },
];

const BOSS_UNITS = [
  { name: '大魔导师·马尔佐斯', maxHp: 150, moveRange: 3, faction: 'pyro', isBoss: true, unitType: 'mage', skills: ['meteor', 'fireball', 'poison'], color: '#ff5252' },
  // —— 星渊走廊新篇章（第15关）终局 BOSS ——
  { name: '星渊之喉·厄瑞玻斯', maxHp: 180, moveRange: 3, faction: 'pyro', isBoss: true, unitType: 'mage', skills: ['meteor', 'lightning', 'poison'], color: '#7c4dff' },
  // —— 第三部「余烬回响」（第18关）终局 BOSS：审判之主·奥古斯 ——
  { name: '审判之主·奥古斯', maxHp: 200, moveRange: 3, faction: 'light', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#ffab40' },
  // —— 隐藏章节「蚀教真相」（方向2 内容扩建 · 第四部后传）终局 BOSS：蚀渊之母 ——
  { name: '蚀渊之母·涅莎', maxHp: 210, moveRange: 3, faction: 'eclipse', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#6a1b9a' },
  // —— 隐藏章节·第二卷「门彼之侧」（方向2 内容扩建）终局 BOSS：源初回响（灵脉分裂前、未交还世界的「守护」之半）——
  { name: '源初回响·厄科', maxHp: 230, moveRange: 3, faction: 'echo', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#18ffff' },
  // —— 隐藏章节·第三卷「灵脉分裂前叙事」（方向2 内容扩建 · 溯源篇）终局 BOSS：溯光之冠（灵脉分裂之前的守忆者之冠 · 涅莎/厄科共同的前身）——
  { name: '溯光之冠·奥拉若', maxHp: 240, moveRange: 3, faction: 'primordial', isBoss: true, unitType: 'mage', skills: ['meteor', 'smite', 'poison'], color: '#fff9c4' },
];
