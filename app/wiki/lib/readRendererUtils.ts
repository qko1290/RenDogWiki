import React from 'react';
import { Descendant, Text } from 'slate';

export function decodeTitleForDisplay(raw: string | null | undefined) {
  const value = String(raw ?? '');

  return value.replace(/_/g, ' ').trim();
}

export function encodeTitleForShare(raw: string | null | undefined) {
  const value = String(raw ?? '').trim();

  return value.replace(/\s+/g, '_');
}

export function toHeadingIdFromText(text: string) {
  const cleaned = text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .trim();

  const slug =
    cleaned.toLowerCase().replace(/\s+/g, '-') ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;

  return `heading-${slug}`;
}

export function flexJustifyFromAlign(
  align?: string | null,
): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'center') return 'center';
  if (align === 'right') return 'flex-end';

  return 'flex-start';
}

export function nodeToPlainText(node: any): string {
  if (!node) return '';

  if (Text.isText(node)) {
    return node.text ?? '';
  }

  if (Array.isArray(node)) {
    return node.map(nodeToPlainText).join('');
  }

  if (Array.isArray(node.children)) {
    return node.children.map(nodeToPlainText).join('');
  }

  return '';
}

export function isEmptyParagraphNode(node: any): boolean {
  if (!node || node.type !== 'paragraph') return false;

  const plain = nodeToPlainText(node.children)
    .replace(/\u200B/g, '')
    .trim();

  return plain.length === 0;
}

export function compactReadContent(nodes: Descendant[]): Descendant[] {
  const out: Descendant[] = [];

  const isImage = (node: any) => node?.type === 'image';
  const isLinkish = (node: any) =>
    node?.type === 'link-block' || node?.type === 'link-block-row';
  const isInfoboxish = (node: any) => node?.type === 'info-box';

  for (let i = 0; i < nodes.length; i += 1) {
    const prev: any = nodes[i - 1];
    const cur: any = nodes[i];
    const next: any = nodes[i + 1];

    if (!isEmptyParagraphNode(cur)) {
      out.push(cur);
      continue;
    }

    if (isImage(prev) && isImage(next)) continue;
    if (isLinkish(prev) && isLinkish(next)) continue;
    if (isInfoboxish(prev) && isInfoboxish(next)) continue;

    out.push(cur);
  }

  return out;
}

export function getCurrentThemeIsDark() {
  if (typeof document === 'undefined') return false;

  const html = document.documentElement;
  const body = document.body;

  return (
    html.dataset.theme === 'dark' ||
    body?.dataset?.theme === 'dark' ||
    html.classList.contains('dark') ||
    body?.classList?.contains('dark')
  );
}

export function stripFontSizeFromDescendants(node: any): any {
  if (Text.isText(node)) {
    const { fontSize, ...rest } = node;

    return rest;
  }

  if (node && Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map(stripFontSizeFromDescendants),
    };
  }

  return node;
}

export function stripReact(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(stripReact).join('');
  }

  if (React.isValidElement(node)) {
    return stripReact((node as any).props.children);
  }

  return '';
}

export function normalizeInfoBoxNodeForMobile(node: any): any {
  if (Text.isText(node)) {
    return {
      ...node,
      text: String(node.text ?? '').replace(/[^\S\r\n]{2,}/g, ' '),
    };
  }

  if (node && Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map(normalizeInfoBoxNodeForMobile),
    };
  }

  return node;
}