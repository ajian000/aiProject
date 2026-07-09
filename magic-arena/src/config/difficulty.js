// ============================================================
// Config: Difficulty & Factions — 难度与阵营
// ============================================================

const FACTIONS = {
  pyro:   { name: '火焰', color: '#ff7043', aiStyle: 'aggressive' },
  cryo:   { name: '寒冰', color: '#4fc3f7', aiStyle: 'defensive'  },
  nature: { name: '自然', color: '#81c784', aiStyle: 'skirmish'   },
  light:  { name: '圣光', color: '#ffd54f', aiStyle: 'support'   },
  // —— 隐藏阵营（方向2 内容扩建 · 隐藏章节）——
  // eclipse=蚀教（禁忌灵脉）/ echo=回响（源初灵脉分裂前的回响体）/ primordial=溯光者（灵脉分裂之前的守忆者）
  // 三者此前未注册时 AI 默认 aggressive；此处显式登记并以同类 aiStyle 注册，行为与既有默认完全一致（balance-safe）。
  eclipse:    { name: '蚀教', color: '#ab47bc', aiStyle: 'aggressive' },
  echo:       { name: '回响', color: '#4dd0e1', aiStyle: 'aggressive' },
  primordial: { name: '溯光', color: '#ffd180', aiStyle: 'aggressive' },
};

const DIFFICULTY = {
  easy:   { key: 'easy',   name: '简单', hpMul: 0.60, dmgMul: 0.65 },
  normal: { key: 'normal', name: '普通', hpMul: 0.80, dmgMul: 1.00 },
  hard:   { key: 'hard',   name: '困难', hpMul: 1.25, dmgMul: 1.10 },
};
