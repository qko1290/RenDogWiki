// components/editor/render/weaponStatUtils.ts
import type { WeaponType, WeaponStatKey, WeaponStatConfig } from '@/types/slate';

// 무기 유형별 메타 정보 (라벨/색상 등)
export const WEAPON_TYPES_META: Record<
  WeaponType,
  { label: string; headerBg: string; border: string; badgeBg: string }
> = {
  block:     { label: 'BLOCK',     headerBg: '#4ade80', border: '#a3e635', badgeBg: '#166534' },
  epic:      { label: 'EPIC',      headerBg: '#7c3aed', border: '#a855f7', badgeBg: '#5b21b6' },
  unique:    { label: 'UNIQUE',    headerBg: '#0ea5e9', border: '#38bdf8', badgeBg: '#0369a1' },
  legendary: { label: 'LEGEND',    headerBg: '#f97373', border: '#fb7185', badgeBg: '#b91c1c' },
  divine:    { label: 'DIVINE',    headerBg: '#15803d', border: '#22c55e', badgeBg: '#14532d' },
  superior:  { label: 'SUPERIOR',  headerBg: '#eab308', border: '#facc15', badgeBg: '#92400e' },
  class:     { label: 'CLASS',     headerBg: '#6366f1', border: '#818cf8', badgeBg: '#312e81' },
  hidden:    { label: 'HIDDEN',    headerBg: '#0f766e', border: '#14b8a6', badgeBg: '#134e4a' },
  limited:   { label: 'LIMITED',   headerBg: '#f97316', border: '#fdba74', badgeBg: '#c2410c' },
  ancient:   { label: 'ANCIENT',   headerBg: '#6b7280', border: '#9ca3af', badgeBg: '#374151' },
};

// 무기 카드에서 사용할 전체 스탯 키 목록
export const ALL_WEAPON_STAT_KEYS: WeaponStatKey[] = [
  'damage',
  'cooldown',
  'hitCount',
  'range',
  'duration',
  'heal',
];

// 각 스탯 키별 기본 라벨/단위
export const WEAPON_STAT_PRESET: Record<
  WeaponStatKey,
  { label: string; defaultUnit?: string }
> = {
  damage:   { label: '데미지' },
  cooldown: { label: '쿨타임', defaultUnit: '초' },
  hitCount: { label: '타수',   defaultUnit: '타' },
  range:    { label: '범위' },
  duration: { label: '지속시간', defaultUnit: '초' },
  heal:     { label: '회복량' },
};

// 무기 유형별 강화 단계 라벨
export function getWeaponLevelLabels(type: WeaponType): string[] {
  switch (type) {
    // 1강 ~ MAX(5강)
    case 'epic':
    case 'unique':
    case 'legendary':
    case 'divine':
    case 'superior':
      return ['1강', '2강', '3강', '4강', 'MAX'];
    // 1강 ~ MAX(9강)
    case 'class':
      return ['1강', '2강', '3강', '4강', '5강', '6강', '7강', '8강', 'MAX'];
    // 나머지는 단일 단계
    case 'block':
    case 'hidden':
    case 'limited':
    case 'ancient':
    default:
      return ['기본'];
  }
}

// levels 배열을 weaponType에 맞는 길이로 맞춤
export function normalizeStatLevels(
  levels: WeaponStatConfig['levels'] | undefined,
  type: WeaponType,
): WeaponStatConfig['levels'] {
  const labels = getWeaponLevelLabels(type);
  const list = levels ?? [];
  return labels.map((label, idx) => ({
    levelLabel: label,
    value: list[idx]?.value ?? '',
  }));
}

// 빈 스탯 하나 생성 (enabled 여부 포함)
export function createEmptyWeaponStat(
  key: WeaponStatKey,
  type: WeaponType,
  enabled: boolean,
): WeaponStatConfig {
  return {
    key,
    label: '',
    summary: '',
    unit: '',
    enabled,
    levels: normalizeStatLevels([], type),
  };
}

// 현재 stats 배열을 기준으로, 모든 stat 키를 채우고 단계 구조를 유형에 맞게 정규화
export function ensureWeaponStats(
  stats: WeaponStatConfig[] | undefined,
  type: WeaponType,
): WeaponStatConfig[] {
  const map = new Map<WeaponStatKey, WeaponStatConfig>();
  (stats ?? []).forEach((s) => map.set(s.key, s));

  return ALL_WEAPON_STAT_KEYS.map((key) => {
    const existing = map.get(key);
    if (!existing) {
      const enabled = false;
      return createEmptyWeaponStat(key, type, enabled);
    }
    return {
      ...existing,
      levels: normalizeStatLevels(existing.levels, type),
    };
  });
}

// stats 전체를 weaponType에 맞게 강제 정규화
export function normalizeStatsForWeaponType(
  stats: WeaponStatConfig[] | undefined,
  type: WeaponType,
): WeaponStatConfig[] {
  return ensureWeaponStats(stats, type).map((s) => ({
    ...s,
    levels: normalizeStatLevels(s.levels, type),
  }));
}
