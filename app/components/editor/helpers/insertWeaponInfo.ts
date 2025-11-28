// File: app/components/editor/helpers/insertWeaponInfo.ts
// =============================================
// 목적: 무기 정보 박스(weapon-card) 블럭을 에디터에 삽입.
//       기본 틀만 만들어 두고, 세부 내용은 카드 내 모달에서 수정.
// ---------------------------------------------
// 요구 사항 반영:
// 1) 무기 유형(weaponType)에 따라 강화 단계 개수가 달라짐.
//    - epic / unique / legendary / divine / superior : 1강 ~ MAX(5강)
//    - class                                         : 1강 ~ MAX(9강)
//    - hidden / limited / ancient / block           : 단일 단계("기본")
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
import {
  normalizeStatsForWeaponType,
  WEAPON_STAT_PRESET,
} from '@/components/editor/render/weaponStatUtils';

// 처음 생성 시 기본으로 켤 스탯 키
const DEFAULT_ENABLED_KEYS: WeaponStatKey[] = ['damage', 'cooldown'];

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

  let stats: WeaponStatConfig[];

  if (initial?.stats && initial.stats.length > 0) {
    // 외부에서 stats 를 넘겨준 경우 → 그대로 정규화만
    stats = normalizeStatsForWeaponType(initial.stats, weaponType);
  } else {
    // 새 카드 기본 생성
    // 1) 일단 모든 키에 대해 “빈 스탯 + disabled” 형태로 세트를 만들고
    // 2) damage / cooldown 만 기본 라벨·단위 + enabled=true 로 세팅
    stats = normalizeStatsForWeaponType(undefined, weaponType).map((s) => {
      if (DEFAULT_ENABLED_KEYS.includes(s.key)) {
        const preset = WEAPON_STAT_PRESET[s.key];
        return {
          ...s,
          label: preset.label,
          unit: preset.defaultUnit ?? '',
          enabled: true,
        };
      }
      // 나머지는 완전히 비운 채로 비활성
      return {
        ...s,
        label: '',
        unit: '',
        summary: '',
        enabled: false,
      };
    });
  }

  const card: WeaponCardElement = {
    type: 'weapon-card',
    weaponType,
    name: initial?.name ?? '새 무기 이름',
    imageUrl: initial?.imageUrl ?? null,
    videoUrl: initial?.videoUrl ?? null,
    stats,
    // Slate void element 패턴: children 안에 빈 텍스트 하나
    children: [{ text: '' }],
  };

  // 카드 뒤에 바로 따라갈 빈 단락
  const paragraph = {
    type: 'paragraph',
    children: [{ text: '' }],
  } as any;

  // selection 위치에 카드 + 빈 단락을 한 번에 삽입
  Transforms.insertNodes(editor, [card as any, paragraph] as any);
};
