// =============================================
// File: app/components/editor/helpers/insertInfoBox.ts
// =============================================
/**
 * 에디터에 정보 박스(InfoBox)를 삽입하는 유틸 함수
 * - info / warning 등 다양한 박스 타입 지원 (유니온은 @/types/slate.ts 참조)
 * - InfoBox 뒤에 빈 단락(paragraph)을 함께 넣어 커서가 다음 줄로
 *   자동 이동하도록 해 바로 이어서 입력할 수 있게 한다.
 * - 공개 인터페이스/동작은 변경하지 않는다.
// =============================================
 */

import { Editor, Transforms } from 'slate';
import type { InfoBoxElement, ParagraphElement, InfoBoxType } from '@/types/slate';

/**
 * insertInfoBox
 * @param editor   Slate Editor 인스턴스
 * @param type     InfoBoxElement의 type (예: 'infoBox')
 * @param boxType  박스 타입 (예: 'info' | 'warning' | ...)
 *
 * - infoBox 블록(아이콘 포함)과 빈 단락(paragraph)을 한 번에 삽입
 * - 알 수 없는 타입은 기본 아이콘(❗ 또는 ℹ️)으로 폴백
 */
const insertInfoBox = (editor: Editor, type: InfoBoxElement['type'], boxType: InfoBoxType) => {
  const isColorBox =
    boxType === 'white' ||
    boxType === 'yellow' ||
    boxType === 'lime' ||
    boxType === 'pink' ||
    boxType === 'red';

  const iconFor = (t: InfoBoxType): string => {
    // ✅ 색상 박스는 아이콘 없음
    if (t === 'white' || t === 'yellow' || t === 'lime' || t === 'pink' || t === 'red') return '';

    switch (t) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      default:
        return '❗';
    }
  };

  const boxNode: InfoBoxElement = {
    type,
    boxType,
    icon: iconFor(boxType),
    noIcon: isColorBox,       // ✅ 핵심
    children: [{ text: '' }],
  };

  const emptyParagraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, [boxNode, emptyParagraph]);
};

export default insertInfoBox;
