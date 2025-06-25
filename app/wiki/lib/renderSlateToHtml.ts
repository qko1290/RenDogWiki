// File: app/wiki/lib/renderSlateToHtml.ts
/**
 * Slate JSON(Descendant[])을 HTML 문자열로 변환하는 유틸 함수
 * - 스타일, 마크, 링크, 커스텀 블록, 색상 등을 변환 
 */

import { Descendant, Text } from 'slate';
import { slugify } from '@/wiki/lib/slugify';

// 메인 변환 함수
export function renderSlateToHtml(value: Descendant[]): string {
  return value.map(renderNode).join('');
}

// 개별 노드 변환(재귀)
function renderNode(node: Descendant): string {
  if (Text.isText(node)) {
    let text = escapeHtml(node.text);
    const styles: string[] = [];

    if (node.color) styles.push(`color: ${node.color}`);
    if (node.backgroundColor) styles.push(`background-color: ${node.backgroundColor}`);
    if (node.fontSize) styles.push(`font-size: ${node.fontSize}`);

    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    if (node.strikethrough) text = `<s>${text}</s>`;

    return styles.length > 0
      ? `<span style="${styles.join('; ')}">${text}</span>`
      : text;
  }

  const children = node.children.map(renderNode).join('');
  switch (node.type) {
    case 'paragraph':
      return `<p>${children}</p>`;
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = node as any;
      const icon = el.icon ? `${el.icon} ` : '';
      const textContent = stripHtml(children).trim(); // 텍스트에서 HTML 태그 제거 후 공백 제거
      const slug = slugify(textContent);
      const id = `heading-${slug}`;
      const level = node.type === 'heading-one' ? '1' : node.type === 'heading-two' ? '2' : '3';
      return `<h${level} id="${id}">${icon}${children}</h${level}>`;
    }
    case 'link':
      return `<a href="${(node as any).url}" target="_blank" rel="noopener noreferrer">${children}</a>`;
    case 'divider':
      return `<hr />`;
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
    default:
      return `<div>${children}</div>`;
  }
}

// XSS 방지
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').trim();
}