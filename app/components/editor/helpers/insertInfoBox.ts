// File: app/components/editor/helpers/insertInfoBox.ts

/**
 * 에디터에 정보박스(InfoBox)를 삽입하는 유틸
 * - info, warning, error 등 다양한 유형 지원 (각각 참고, 주의, 경고 느낌으로 쓰면 될거 같아요요)
 * - 삽입 시 박스+빈 단락(paragraph) 연속 삽입(커서 UX 개선)
 */

import { Editor, Transforms } from 'slate';
import { InfoBoxElement, ParagraphElement, InfoBoxType } from '@/types/slate';

// 박스 객체 정의의
const insertInfoBox = (
  editor: Editor,
  type: InfoBoxElement['type'],
  boxType: InfoBoxType
) => {
  // infoBox 블록 정의
  const boxNode: InfoBoxElement = {
    type: type,
    boxType: boxType, // 박스 구분
    icon: 'ℹ️',
    children: [{ text: '' }],
  };

  // UX 개선용 infoBox 아래 빈 단락 추가
  const emptyParagraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // infoBox + paragraph 삽입
  Transforms.insertNodes(editor, [boxNode, emptyParagraph]);
};

export default insertInfoBox;
