// ============================================================
// Data: Skills — 18 个技能定义
// ============================================================

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
  silence: { name: '沉默术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标沉默2回合，期间无法施放任何技能（只能移动），CD3回合', aoeRadius: 0, isSilence: true, silenceTurns: 2 },
  taunt: { name: '嘲讽术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，嘲讽敌方目标2回合，期间其攻击被强制吸引向你（坦克引流·保护队友）', aoeRadius: 0, isTaunt: true, tauntTurns: 2 },
  smite: { name: '圣光打击', dmg: 22, range: 3, cooldown: 1, desc: '范围3格，22伤害，CD1回合', aoeRadius: 0 },
  shield: { name: '守护之盾', dmg: 0, range: 2, cooldown: 2, desc: '范围2格，为友方单位附加护盾，吸收最多20点伤害，持续2回合，CD2回合', aoeRadius: 0, isShield: true, shieldTurns: 2, shieldAmount: 20 },
  vuln: { name: '易伤术', dmg: 0, range: 3, cooldown: 3, desc: '范围3格，使敌方目标易伤2回合，期间其受到的所有伤害提升50%（集火放大器）', aoeRadius: 0, isVuln: true, vulnTurns: 2 },
  fear: { name: '恐惧术', dmg: 0, range: 3, cooldown: 2, desc: '范围3格，使敌方目标恐惧2回合，期间其被迫远离你移动（恐慌撤退），无法主动接近', aoeRadius: 0, isFear: true, fearTurns: 2 },
  pull: { name: '拉拽术', dmg: 0, range: 3, cooldown: 2, desc: '范围3格，将敌方目标向你拉近最多2格（强制位移·可拉入射程或危险格），CD2回合', aoeRadius: 0, isPull: true, pullRange: 2 },
  empower: { name: '强化术', dmg: 0, range: 2, cooldown: 2, desc: '范围2格，为友方单位附加强化，使其造成的所有伤害提升50%（持续2回合·进攻增益），CD2回合', aoeRadius: 0, isEmpower: true, empowerTurns: 2 },
};
