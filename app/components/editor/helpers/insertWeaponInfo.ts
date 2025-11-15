// File: app/components/editor/helpers/insertWeaponInfo.ts
// =============================================
// 목적: 무기 정보 박스(weapon-info) 블럭을 에디터에 삽입.
//       기본 틀만 만들어 두고, 세부 내용은 카드 내 모달에서 수정.
// =============================================

import { Editor, Transforms } from 'slate';
import type { WeaponInfoElement, WeaponStat } from '@/types/slate';

// 간단한 랜덤 id
const randomId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * 무기 정보 박스 삽입
 * @param editor Slate Editor
 * @param initial 선택적으로 초기값(이름, 희귀도 등)을 넘길 수 있음
 */
export const insertWeaponInfo = (
  editor: Editor,
  initial?: Partial<WeaponInfoElement>,
) => {
  const defaultStats: WeaponStat[] = [
    {
      id: randomId(),
      key: 'damage',
      label: '데미지',
      value: '',
      unit: '',
      upgrades: [],
    },
    {
      id: randomId(),
      key: 'cooldown',
      label: '쿨타임',
      value: '',
      unit: '',
      upgrades: [],
    },
  ];

  const element: WeaponInfoElement = {
    type: 'weapon-info',
    rarity: initial?.rarity ?? 'epic',
    name: initial?.name ?? '새 무기 이름',
    weaponType: initial?.weaponType ?? '',
    code: initial?.code ?? '',
    image: initial?.image ?? null,
    video: initial?.video ?? null,
    stats: initial?.stats && initial.stats.length > 0 ? initial.stats : defaultStats,
    children: [{ text: '' }],
  };

  const at = editor.selection ?? Editor.end(editor, []);

  Transforms.insertNodes(editor, element as any, { at });
};
