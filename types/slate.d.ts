// =============================================
// File: types/slate.d.ts
// =============================================
/**
 * 에디터용 커스텀 타입 선언
 * - 커스텀 텍스트 마크업, 각종 블럭 요소, 링크, info-box, heading 등 타입화
 * - UI 확장 기능(정렬, 색상, 아이콘 등)도 타입 레벨에서 강제
 */

import { BaseEditor, BaseElement, BaseText } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

// [CustomText] 텍스트(leaf) 마크업/스타일 타입
type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;           // 글자색
  fontSize?: string;        // 폰트 크기(px 등)
  backgroundColor?: string; // 배경색
};

// [블럭/링크/구분선 등 요소별 타입 정의]

// 인라인 링크
export type LinkElement = {
  type: 'link';
  url: string;
  children: CustomText[];
};

// 링크 블럭(썸네일/사이트명 등 지원)
export type LinkBlockElement = {
  type: 'link-block';
  url: string;
  size: 'small' | 'large';
  children: CustomText[];
  favicon?: string;
  sitename?: string;
  isWiki?: boolean;
  wikiTitle?: string;
  wikiPath?: string | number;
};

// 구분선(divider)
export interface DividerElement {
  type: "divider";
  style?: "default" 
    | "bold" 
    | "shortbold"
    | "wavy" 
    | "dotted" 
    | "diamond" 
    | "diamonddot"
    | "dotdot" 
    | "slash" 
    | "bar";
  children: [{ text: "" }];
}

// 일반 문단(paragraph)
export interface ParagraphElement {
  type: 'paragraph';
  indentLine?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify'; // 정렬
  children: CustomText[];
}

// 인포박스(주의/경고/정보)
export type InfoBoxElement = {
  type: 'info-box';
  boxType: InfoBoxType;
  icon?: string;
  children: CustomText[];
};

// [Heading 계열: 아이콘, 정렬 포함]
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

// 통합 heading 타입(가독성용)
export type HeadingElement = HeadingOneElement | HeadingTwoElement | HeadingThreeElement;

export type ImageElement = {
  type: 'image';
  url: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  width?: number; // 이후 4번에서 사용할 필드
  height?: number;
  children: [{ text: '' }];
};

export type InlineMarkElement = {
  type: 'inline-mark';
  icon: string;
  color?: string;
  marginRight?: number;
  children: [{ text: '' }];
};

export type InlineImageElement = {
  type: 'inline-image';
  url: string;
  children: [{ text: string }];
};

export type PriceTableCardElement = {
  type: 'price-table-card';
  items: {
    image?: string;      // 이미지 URL
    name: string;        // 아이템명
    prices: number[];    // 시세 배열 (강화수치별)
    stages: string[];    // 예: ['봉인', '1각', ..., 'MAX']
    colorType?: string;  // 'normal' | 'transcend' 등 (확장 대비)
  }[];
  cardsPerRow: number; // 한 줄에 카드 개수(1~5)
  children: { text: '' }[]; // Slate 필수
}

export type LinkBlockRowElement = {
  type: 'link-block-row';
  children: [LinkBlockElement, LinkBlockElement];
};

// [모든 Element 통합 타입]
export type CustomElement =
  | ParagraphElement
  | DividerElement
  | LinkElement
  | LinkBlockElement
  | LinkBlockRowElement
  | InfoBoxElement
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement
  | InlineMarkElement
  | InlineImageElement
  | PriceTableCardElement
  | ImageElement;

// [Slate 타입 시스템 오버라이드]
//   - 실제 Editor, Element, Text 구조를 커스텀 타입으로 덮어씀
declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// [기타 유틸 타입]

// InfoBox 종류
export type InfoBoxType = 'info' | 'warning' | 'danger';

// 텍스트 마크 포맷들(툴바/핫키 등에서 사용)
export type MarkFormat =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'color'
  | 'fontSize'
  | 'backgroundColor';
