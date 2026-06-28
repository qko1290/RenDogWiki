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
  // 기존 WEAPON_TYPES_META 객체 내용 그대로 붙여넣기
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