// File: app/components/editor/helpers/insertWeaponInfo.ts
// =============================================
// 목적: 무기 정보 박스(weapon-card) 블럭을 에디터에 삽입.
//       기본 틀만 만들어 두고, 세부 내용은 카드 내 모달에서 수정.
// ---------------------------------------------
// 요구 사항 반영:
// 1) 무기 유형(weaponType)에 따라 강화 단계 개수가 달라짐.
//    - epic / unique / legendary / divine / superior : 1강 ~ MAX(5강)
//    - class                                         : 1강 ~ MAX(9강)
//    - hidden / limited / ancient                    : 단일 단계("기본")
// 2) 데미지/쿨타임/타수/범위/지속시간/회복량 중
//    기본으로는 데미지·쿨타임만 표시(enabled=true), 나머지는 off.
// 3) stats가 initial로 넘어오면, 현재 weaponType에 맞게
//    단계 수를 맞춰서 정규화(normalize)한다.
// =============================================

import { Editor, Transforms } from 'slate';
import type {
  WeaponCardElement,
  WeaponStatConfig,
  WeaponType,
  WeaponStatKey,
} from '@/types/slate';

// 사용할 모든 스탯 키
const ALL_WEAPON_STAT_KEYS: WeaponStatKey[] = [
  'damage',
  'cooldown',
  'hitCount',
  'range',
  'duration',
  'heal',
];

// 각 스탯 키별 기본 라벨/단위
const WEAPON_STAT_PRESET: Record<
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

/**
 * 무기 유형에 따라 강화 단계 라벨 목록 반환
 */
function getWeaponLevelLabels(type: WeaponType): string[] {
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
    case 'hidden':
    case 'limited':
    case 'ancient':
    default:
      return ['기본'];
  }
}

/**
 * levels 배열을 weaponType 에 맞게 강제 정규화
 * (라벨 개수/순서를 유형에 맞추고, 부족한 값은 빈 문자열로 채움)
 */
function normalizeStatLevels(
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

/**
 * 비어있는 WeaponStatConfig 생성
 */
function createEmptyWeaponStat(
  key: WeaponStatKey,
  type: WeaponType,
  enabled: boolean,
): WeaponStatConfig {
  const preset = WEAPON_STAT_PRESET[key];

  return {
    key,
    label: preset.label,
    summary: '',
    unit: preset.defaultUnit,
    enabled,
    levels: normalizeStatLevels([], type),
  };
}

/**
 * stats 배열을 기준으로
 * - 모든 스탯 키(데미지/쿨타임/...)를 포함하도록 채워넣고
 * - weaponType 에 맞게 levels 구조를 맞춰 줌
 * - label/unit 이 비어 있으면 preset 값으로 채움
 * - 새로 생성되는 스탯의 enabled 기본값은
 *   damage, cooldown => true  / 그 외 => false
 */
function normalizeStatsForWeaponType(
  stats: WeaponStatConfig[] | undefined,
  type: WeaponType,
): WeaponStatConfig[] {
  const byKey = new Map<WeaponStatKey, WeaponStatConfig>();
  (stats ?? []).forEach((s) => byKey.set(s.key, s));

  return ALL_WEAPON_STAT_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (!existing) {
      const enabled = key === 'damage' || key === 'cooldown';
      return createEmptyWeaponStat(key, type, enabled);
    }

    const preset = WEAPON_STAT_PRESET[key];

    return {
      ...existing,
      label: existing.label || preset.label,
      unit: existing.unit ?? preset.defaultUnit,
      enabled:
        typeof existing.enabled === 'boolean'
          ? existing.enabled
          : key === 'damage' || key === 'cooldown',
      levels: normalizeStatLevels(existing.levels, type),
    };
  });
}

// initial 로 허용할 필드만 좁혀서 타입 정의
type WeaponCardInitial = Partial<
  Pick<
    WeaponCardElement,
    'weaponType' | 'name' | 'imageUrl' | 'videoUrl' | 'stats'
  >
>;

/**
 * 무기 정보 박스(weapon-card) 삽입
 * @param editor Slate Editor
 * @param initial 선택적으로 초기값(이름, 유형, 이미지, 통계 등)을 넘길 수 있음
 */
export const insertWeaponInfo = (
  editor: Editor,
  initial?: WeaponCardInitial,
) => {
  // weaponType 기본값: epic
  const weaponType: WeaponType =
    initial?.weaponType ?? ('epic' as WeaponType);

  // stats 초기값 정규화
  const stats: WeaponStatConfig[] = normalizeStatsForWeaponType(
    initial?.stats,
    weaponType,
  );

  const element: WeaponCardElement = {
    type: 'weapon-card',
    weaponType,
    name: initial?.name ?? '새 무기 이름',
    imageUrl: initial?.imageUrl ?? null,
    videoUrl: initial?.videoUrl ?? null,
    stats,
    // Slate void element 패턴: children 안에 빈 텍스트 하나
    children: [{ text: '' }],
  };

  const at = editor.selection ?? Editor.end(editor, []);

  Transforms.insertNodes(editor, element as any, { at });
};
