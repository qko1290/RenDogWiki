// =============================================
// File: app/components/editor/helpers/insertInfoBox.ts
// =============================================
/**
 * 에디터에 정보 박스(InfoBox)를 삽입하는 유틸 함수
 * - info, warning, error 등 다양한 박스 타입 지원(참고/주의/경고 등)
 * - InfoBox 삽입 시, 바로 다음 줄에 빈 단락(paragraph)도 추가하여
 *   커서가 박스 내부가 아닌 다음 줄로 자동 이동하도록 UX를 개선함
 * - InfoBoxElement, InfoBoxType, ParagraphElement는 @/types/slate.ts에 정의됨
 */

import { Editor, Transforms } from 'slate';
import { InfoBoxElement, ParagraphElement, InfoBoxType } from '@/types/slate';

/**
 * insertInfoBox
 * @param editor   Slate Editor 인스턴스
 * @param type     InfoBoxElement의 type ('infoBox' 등)
 * @param boxType  박스 타입 ('info' | 'warning' | 'error')
 *
 * - infoBox 블록(아이콘 포함)과 빈 단락(paragraph)을 한 번에 삽입함
 * - 아이콘은 기본적으로 'ℹ️'으로 지정되어 있음(박스 타입별 아이콘 커스텀 가능)
 */
const insertInfoBox = (
  editor: Editor,
  type: InfoBoxElement['type'],
  boxType: InfoBoxType
) => {
  // 1. infoBox 블록 노드 생성
  const boxNode: InfoBoxElement = {
    type: type,             // 'infoBox' 등
    boxType: boxType,       // 'info', 'warning', 'error'
    icon: 'ℹ️',             // 기본 아이콘(필요시 타입별로 바꿔도 무방)
    children: [{ text: '' }],
  };

  // 2. infoBox 바로 아래에 추가할 빈 단락(paragraph) 노드
  const emptyParagraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 3. 두 블록을 연속 삽입 (infoBox → 빈 단락)
  Transforms.insertNodes(editor, [boxNode, emptyParagraph]);
};

export default insertInfoBox;
