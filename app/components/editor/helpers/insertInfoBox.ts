// =============================================
// File: app/components/editor/helpers/insertInfoBox.ts
// =============================================
/**
 * 에디터에 정보박스(InfoBox) 블록을 삽입하는 유틸리티
 * - info, warning, error 등 다양한 boxType 지원(각각 참고/주의/경고 등 용도)
 * - 삽입 시 infoBox 블록 + 빈 단락(paragraph) 연속 삽입
 *   → 커서가 박스 내부가 아니라 다음 줄에 위치하도록 UX 개선
 * - InfoBoxElement/InfoBoxType: @/types/slate.ts에 정의
 */

import { Editor, Transforms } from 'slate';
import { InfoBoxElement, ParagraphElement, InfoBoxType } from '@/types/slate';

/**
 * [infoBox 삽입 함수]
 * - 입력: editor(에디터 인스턴스), type(슬레이트 노드 타입), boxType(InfoBoxType)
 * - 동작:
 *   1. infoBox 블록(아이콘 포함) 생성
 *   2. infoBox 아래 빈 단락(paragraph) 추가(커서 UX 개선)
 */
const insertInfoBox = (
  editor: Editor,
  type: InfoBoxElement['type'],
  boxType: InfoBoxType
) => {
  // 1. infoBox 블록 객체 생성
  const boxNode: InfoBoxElement = {
    type: type,             // 'infoBox'
    boxType: boxType,       // 'info' | 'warning' | 'error'
    icon: 'ℹ️',             // 아이콘
    children: [{ text: '' }],
  };

  // 2. infoBox 바로 아래에 빈 단락 삽입
  const emptyParagraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 3. infoBox + paragraph를 한 번에 삽입
  Transforms.insertNodes(editor, [boxNode, emptyParagraph]);
};

export default insertInfoBox;
