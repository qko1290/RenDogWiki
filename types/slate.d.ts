// File: types/slate.d.ts

/**
 * Slate 에디터 커스텀 타입 확장 정의
 * - 텍스트 마크/블럭/링크/박스 등 모든 커스텀 요소 타입화
 * - 정렬, 아이콘, 컬러 등 UI 기능을 타입으로 강제
 */

import { BaseEditor, BaseElement, BaseText } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

// CustomText(마크업, 스타일)
type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  fontSize?: string;
  backgroundColor?: string;
};

// 링크/블럭/디바이더 등 요소별 타입
export type LinkElement = {
  type: 'link';
  url: string;
  children: CustomText[];
};

export type LinkBlockElement = {
  type: 'link-block';
  url: string;
  size: 'small' | 'medium' | 'large';
  children: CustomText[];
  favicon?: string;
  sitename?: string;
};

export type DividerElement = {
  type: 'divider';
  children: [{ text: '' }];
};

export interface ParagraphElement {
  type: 'paragraph';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  children: CustomText[];
};

export type InfoBoxElement = {
  type: 'info-box';
  boxType: InfoBoxType;
  icon?: string;
  children: CustomText[];
};

// 헤딩 타입(아이콘/정렬 옵션 포함)
export interface HeadingOneElement {
  type: 'heading-one';
  icon?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  children: CustomText[];
}
export interface HeadingTwoElement {
  type: 'heading-two';
  icon?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  children: CustomText[];
}
export interface HeadingThreeElement {
  type: 'heading-three';
  icon?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  children: CustomText[];
}

// 통합 Element 타입
export type HeadingElement = HeadingOneElement | HeadingTwoElement | HeadingThreeElement;

export type CustomElement =
  | ParagraphElement
  | DividerElement
  | LinkElement
  | LinkBlockElement
  | InfoBoxElement
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement;

// slate 타입 오버라이드
declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// 기타 타입 
export type InfoBoxType = 'info' | 'warning' | 'danger';

export type MarkFormat =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'color'
  | 'fontSize'
  | 'backgroundColor';
