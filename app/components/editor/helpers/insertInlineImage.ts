// =============================================
// File: app/components/editor/helpers/insertInlineImage.ts
// =============================================
/**
 * 에디터 내에 인라인 이미지(inline-image) 노드를 삽입하는 유틸 함수
 * - 사용 예: 본문 중간에 작은 아이콘이나 인라인 이미지를 넣고 싶을 때 사용
 * - InlineImageElement 타입은 @/types/slate에서 정의
 */

import { Transforms, Editor, Node } from 'slate';
import type { InlineImageElement } from '@/types/slate'; // 타입 경로는 실제 프로젝트 구조에 맞게 조정

/**
 * insertInlineImage
 * @param editor Slate Editor 인스턴스
 * @param url    삽입할 이미지 URL
 *
 * - 현재 커서 위치에 인라인 이미지 노드를 삽입함
 * - children에는 빈 텍스트 노드를 반드시 포함해야 Slate에서 정상 동작함
 */
export function insertInlineImage(editor: Editor, url: string) {
  const inlineImage: InlineImageElement = {
    type: 'inline-image',
    url,
    children: [{ text: '' }], // 반드시 children에 텍스트 노드 포함
  };

  // 현재 커서 위치에 인라인 이미지 노드 삽입
  Transforms.insertNodes(editor, inlineImage as Node);
}
