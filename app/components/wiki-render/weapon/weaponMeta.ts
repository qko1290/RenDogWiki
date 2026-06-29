export type WeaponType =
  | 'epic'
  | 'unique'
  | 'legendary'
  | 'divine'
  | 'superior'
  | 'class'
  | 'block'
  | 'hidden'
  | 'limited'
  | 'ancient'
  | 'boss'
  | 'miniBoss'
  | 'monster'
  | 'mini-boss'
  | 'rune'
  | 'fishing-rod'
  | 'transcend-epic'
  | 'transcend-unique'
  | 'transcend-legend'
  | 'transcend-divine'
  | 'transcend-superior'
  | 'armor'
  | 'weapon'
  | 'spirit';

export type WeaponTypeMeta = {
  label: string;
  headerBg: string;
  border: string;
  badgeBg: string;
};

/**
 * 기존 WikiReadRenderer.tsx에 있던 WEAPON_TYPES_META 값을
 * 그대로 옮겨와야 함.
 *
 * 색상값 바꾸면 main 디자인이 달라지니까 절대 새로 만들지 말고,
 * 기존 객체 내용을 그대로 잘라내서 여기에 붙여넣기.
 */
export const WEAPON_TYPES_META: Record<WeaponType, WeaponTypeMeta> = {
  epic: { label: 'EPIC', headerBg: '#7c3aed', border: '#a855f7', badgeBg: '#5b21b6' },
  unique: { label: 'UNIQUE', headerBg: '#0ea5e9', border: '#38bdf8', badgeBg: '#0369a1' },
  legendary: { label: 'LEGEND', headerBg: '#f97373', border: '#fb7185', badgeBg: '#b91c1c' },
  divine: { label: 'DIVINE', headerBg: '#15803d', border: '#22c55e', badgeBg: '#14532d' },
  superior: { label: 'SUPERIOR', headerBg: '#eab308', border: '#facc15', badgeBg: '#92400e' },
  class: { label: 'CLASS', headerBg: '#6366f1', border: '#818cf8', badgeBg: '#312e81' },
  block: { label: 'BLOCK', headerBg: '#4ade80', border: '#a3e635', badgeBg: '#166534' },
  hidden: { label: 'HIDDEN', headerBg: '#0f766e', border: '#14b8a6', badgeBg: '#134e4a' },
  limited: { label: 'LIMITED', headerBg: '#f97316', border: '#fdba74', badgeBg: '#c2410c' },
  ancient: { label: 'ANCIENT', headerBg: '#6b7280', border: '#9ca3af', badgeBg: '#374151' },

  boss: { label: 'BOSS', headerBg: '#6D28D9', border: '#A78BFA', badgeBg: '#4C1D95' },
  miniBoss: { label: 'MINI BOSS', headerBg: '#DC2626', border: '#F87171', badgeBg: '#7F1D1D' },
  'mini-boss': { label: 'MINI BOSS', headerBg: '#DC2626', border: '#F87171', badgeBg: '#7F1D1D' },
  monster: { label: 'MONSTER', headerBg: '#059669', border: '#34D399', badgeBg: '#064E3B' },
  rune: { label: 'RUNE', headerBg: '#2e1065', border: '#7c3aed', badgeBg: '#1e0b3a' },
  'fishing-rod': { label: 'FISHING ROD', headerBg: '#0369a1', border: '#38bdf8', badgeBg: '#0c4a6e' },

  'transcend-epic': { label: 'TRANSCEND EPIC', headerBg: '#7c3aed', border: '#a855f7', badgeBg: '#5b21b6' },
  'transcend-unique': { label: 'TRANSCEND UNIQUE', headerBg: '#0ea5e9', border: '#38bdf8', badgeBg: '#0369a1' },
  'transcend-legend': { label: 'TRANSCEND LEGEND', headerBg: '#f97373', border: '#fb7185', badgeBg: '#b91c1c' },
  'transcend-divine': { label: 'TRANSCEND DIVINE', headerBg: '#15803d', border: '#22c55e', badgeBg: '#14532d' },
  'transcend-superior': { label: 'TRANSCEND SUPERIOR', headerBg: '#eab308', border: '#facc15', badgeBg: '#92400e' },

  armor: { label: 'ARMOR', headerBg: '#0f172a', border: '#334155', badgeBg: '#111827' },
  weapon: { label: 'WEAPON', headerBg: '#1f2937', border: '#6b7280', badgeBg: '#111827' },
  spirit: { label: 'SPIRIT', headerBg: '#052426', border: '#1dd3c7', badgeBg: '#061617' },
};

export const VIDEOLESS_WEAPON_TYPES: WeaponType[] = [
  'boss',
  'miniBoss',
  'mini-boss',
  'rune',
  'fishing-rod',
  'monster',
  'armor',
];

export function normalizeWeaponType(value: unknown): WeaponType {
  const type = String(value ?? '').trim() as WeaponType;

  return type && type in WEAPON_TYPES_META ? type : 'epic';
}

export function supportsWeaponVideo(type: WeaponType): boolean {
  return !VIDEOLESS_WEAPON_TYPES.includes(type);
}