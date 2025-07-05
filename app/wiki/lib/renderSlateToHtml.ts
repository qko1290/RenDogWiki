// =============================================
// File: app/wiki/lib/renderSlateToHtml.ts
// =============================================
/**
 * Slate JSON을 HTML 문자열로 변환하는 유틸 함수
 * - 다양한 마크/스타일/커스텀 블록(heading, info-box, divider 등) 지원
 * - 위키 문서 렌더, 미리보기 등에서 사용
 */

import { Descendant, Text } from 'slate';
import { slugify } from '@/wiki/lib/slugify';

 // 메인 변환 함수
export function renderSlateToHtml(value: Descendant[]): string {
  // 트리의 최상위 노드부터 렌더링
  return value.map(renderNode).join('');
}

 // 개별 노드(블록/텍스트) 변환 함수 (재귀)
function renderNode(node: Descendant): string {
  // 텍스트 leaf 처리
  if (Text.isText(node)) {
    let text = escapeHtml(node.text); // XSS 방지
    
    // 인라인 스타일
    const styles: string[] = [];
    if (node.color) styles.push(`color: ${node.color}`);
    if (node.backgroundColor) styles.push(`background-color: ${node.backgroundColor}`);
    if (node.fontSize) styles.push(`font-size: ${node.fontSize}`);

    // 마크: bold, italic, underline, strikethrough
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    if (node.strikethrough) text = `<s>${text}</s>`;

    // 스타일 span 적용
    return styles.length > 0
      ? `<span style="${styles.join('; ')}">${text}</span>`
      : text;
  }

  // 블록(컨테이너) 노드
  const children = node.children.map(renderNode).join('');
  switch (node.type) {
    case 'paragraph':
      return `<p>${children}</p>`;

    // heading(제목)
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = node as any;
      const icon = el.icon ? `${el.icon} ` : '';
      // heading에 들어가는 순수 텍스트만 추출
      const textContent = stripHtml(children).trim();
      const slug = slugify(textContent);
      const id = `heading-${slug}`;
      const level =
        node.type === 'heading-one' ? '1' :
        node.type === 'heading-two' ? '2' : '3';
      return `<h${level} id="${id}">${icon}${children}</h${level}>`;
    }

    // 링크
    case 'link':
      return `<a href="${(node as any).url}" target="_blank" rel="noopener noreferrer">${children}</a>`;

    // 구분선
    case 'divider':
      return `<hr />`;

    // 링크 블록(박스형)
    case 'link-block': {
      const el = node as any;
      const icon = el.favicon
        ? `<img src="${el.favicon}" alt="favicon" style="width: 24px; height: 24px; margin-right: 8px;" />`
        : '';
      return (
        `<div contenteditable="false" style="display: flex; align-items: center; padding: 12px; ` +
        `border: 1px solid #ddd; border-radius: 6px; margin-bottom: 8px;">` +
        `${icon}<a href="${el.url}" target="_blank" rel="noopener noreferrer" ` +
        `style="color: #0070f3; text-decoration: none; flex-grow: 1;">${el.sitename || el.url}</a></div>`
      );
    }

    // info-box(정보/주의/경고 박스)
    case 'info-box': {
      const el = node as any;
      const colors: Record<string, string> = {
        info: '#e8f4fd',
        warning: '#fff9e6',
        danger: '#fdecea',
      };
      const icons: Record<string, string> = {
        info: 'ℹ️',
        warning: '⚠️',
        danger: '🚫',
      };
      return (
        `<div style="background: ${colors[el.boxType]}; padding: 10px; border-radius: 6px; ` +
        `border: 1px solid #ccc; display: flex; align-items: center; gap: 8px;">` +
        `<span contenteditable="false">${icons[el.boxType]}</span>` +
        `<div style="flex: 1">${children}</div></div>`
      );
    }

    // 그 외(지원하지 않는 타입)
    default:
      return `<div>${children}</div>`;
  }
}

 // XSS 방지용 HTML 이스케이프
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

 // 문자열에서 HTML 태그 제거(슬러그/ID용)
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').trim();
}
