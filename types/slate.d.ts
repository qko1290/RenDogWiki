// =============================================
// File: types/slate.d.ts
// =============================================
/**
 * 에디터용 커스텀 타입 선언
 */

import type { BaseEditor } from 'slate';
import type { ReactEditor } from 'slate-react';
import type { HistoryEditor } from 'slate-history';

// ===== 텍스트(leaf) =====
export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;            // 글자색
  fontSize?: string;         // "19px" 등
  backgroundColor?: string;  // 배경색
  fontFamily?: string;       // 폰트 패밀리
};

// ===== 요소들 =====

// 인라인 링크
export type LinkElement = {
  type: 'link';
  url: string;
  children: CustomText[];
};

// 링크 블록
export type LinkBlockElement = {
  type: 'link-block';
  url: string;
  size: 'small' | 'large';
  children: CustomText[];
  favicon?: string | null;
  sitename?: string;
  isWiki?: boolean;
  wikiTitle?: string;
  wikiPath?: string | number;
  docIcon?: string;
};

// 구분선
export interface DividerElement {
  type: 'divider';
  style?:
    | 'default'
    | 'bold'
    | 'shortbold'
    | 'wavy'
    | 'dotted'
    | 'diamond'
    | 'diamonddot'
    | 'dotdot'
    | 'slash'
    | 'bar';
  children: [{ text: '' }];
}

// 문단
export interface ParagraphElement {
  type: 'paragraph';
  indentLine?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  children: CustomText[];
}

// 인포박스
export type InfoBoxType = 'info' | 'warning' | 'danger';
export type InfoBoxElement = {
  type: 'info-box';
  boxType: InfoBoxType;
  icon?: string;
  children: CustomText[];
};

// 헤딩
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
export type HeadingElement =
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement;

// 이미지(블록)
export type ImageElement = {
  type: 'image';
  url: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  width?: number;
  height?: number;
  children: [{ text: '' }];
};

// 인라인 심볼
export type InlineMarkElement = {
  type: 'inline-mark';
  icon: string;
  color?: string;
  marginRight?: number;
  children: [{ text: '' }];
};

// 인라인 이미지
export type InlineImageElement = {
  type: 'inline-image';
  url: string;
  children: [{ text: string }];
};

// 시세표 카드
export type PriceTableCardItem = {
  name?: string;
  image?: string | null;
  stages?: string[];
  prices?: Array<string | number>;
  colorType?: 'default' | 'green' | 'yellow' | string;
};

export type PriceTableCardElement = {
  type: 'price-table-card';
  items: PriceTableCardItem[];
  cardsPerRow: number;
  children: { text: '' }[];
};

// 링크블록 2개 묶음
export type LinkBlockRowElement = {
  type: 'link-block-row';
  children: [LinkBlockElement, LinkBlockElement];
};

// ===== 표(Table) =====
export type TableCellElement = {
  type: 'table-cell';
  rowspan?: number;
  colspan?: number;
  children: ParagraphElement[];
};

export type TableRowElement = {
  type: 'table-row';
  children: TableCellElement[];
};

export type TableElement = {
  type: 'table';
  fullWidth?: boolean;
  maxWidth?: number | null;
  align?: 'left' | 'center' | 'right';
  children: TableRowElement[];
};

export type VideoElement = {
  type: 'video';
  url: string;
  width?: number;
  height?: number;
  textAlign?: 'left' | 'center' | 'right';
  children: [{ text: '' }];
};

// ===== 무기 정보 박스 =====

// 희귀도(카드 색상 분기용)
export type WeaponRarity = 'normal' | 'rare' | 'epic' | 'unique' | 'legendary';

// 강화 단계별 상세 값
export type WeaponStatUpgrade = {
  level: string;   // 예: "+0", "1강", "5강"
  value: string;   // 예: "120", "120 x 3", "0.6초"
};

// 개별 정보(데미지 / 쿨타임 / 타수 / 범위 / 지속시간 / 기타)
export type WeaponStat = {
  id: string;           // React key 용(uuid 같은 랜덤 문자열)
  key: string;          // "damage" | "cooldown" | "hits" | "range" ... 자유
  label: string;        // 표시 이름: "데미지", "쿨타임", "타수", "범위" 등
  value: string;        // 카드에 한 줄로 보이는 요약 값 (ex "120", "0.6초", "3타")
  unit?: string;        // 필요하면 "초", "타", "칸" 등
  upgrades?: WeaponStatUpgrade[];  // 강화별 상세 값(없으면 단순 정보)
};

// 무기 정보 박스 Element
export type WeaponInfoElement = {
  type: 'weapon-info';
  rarity: WeaponRarity;
  name: string;              // 무기 이름
  code?: string;             // 아이템 코드 / #번호 등
  weaponType?: string;       // 근접 무기, 원거리 무기 등
  image?: string | null;     // 무기 이미지 URL
  video?: string | null;     // 공격 영상 URL
  stats: WeaponStat[];       // 정보 리스트(데미지/쿨타임/타수/범위/지속시간 등)
  children: [{ text: '' }];  // void 비슷하게 쓰기 위한 dummy 텍스트
};

// ===== 모든 Element 통합 =====
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
  | ImageElement
  | TableElement
  | TableRowElement
  | TableCellElement
  | VideoElement
  | WeaponInfoElement;

// Slate 타입 오버라이드
declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & HistoryEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// 마크 포맷
export type MarkFormat =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'color'
  | 'fontSize'
  | 'backgroundColor'
  | 'fontFamily';
