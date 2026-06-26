import React from 'react';
import type { WikiRenderMode } from '../types';

type TableBlockProps = {
  mode: WikiRenderMode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * 에디터 TableElementRenderer에서 Slate attributes.ref와 wrapRef를 합친 ref.
   */
  containerRef?: React.Ref<HTMLDivElement>;

  /**
   * 원본 WikiReadRenderer / TableElementRenderer에서 이미 계산한 wrapper style.
   * 여기서 새 스타일을 덮어쓰면 표 폭/정렬이 깨진다.
   */
  containerStyle?: React.CSSProperties;

  /**
   * 원본 TableElementRenderer의 캡처 이벤트.
   * Shift 드래그 선택/Slate 기본 선택 방해 방지용.
   */
  onMouseMoveCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseDownCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUpCapture?: React.MouseEventHandler<HTMLDivElement>;

  /**
   * 실제 table JSX.
   * table 자체의 borderCollapse / tableLayout / width 등은 호출부가 가진다.
   */
  table: React.ReactNode;

  /**
   * 드래그 선택 오버레이.
   */
  overlay?: React.ReactNode;

  /**
   * 에디터 전용 컨트롤.
   * 예: 폭 조절 핸들
   */
  editControls?: React.ReactNode;

  /**
   * 읽기 전용 컨트롤.
   */
  readControls?: React.ReactNode;

  /**
   * 남겨두지만 기본 렌더링에는 개입하지 않는다.
   * 원본 구조 복구가 목적이라 overflow wrapper를 만들지 않음.
   */
  scrollable?: boolean;
  compact?: boolean;
  tableInnerStyle?: React.CSSProperties;
};

export default function TableBlock({
  mode,
  attributes,
  children,
  containerRef,
  containerStyle,
  onMouseMoveCapture,
  onMouseDownCapture,
  onMouseUpCapture,
  table,
  overlay,
  editControls,
  readControls,
}: TableBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;

  return (
    <div
      {...attributes}
      ref={containerRef}
      className={[
        mode === 'edit' ? 'wiki-table-edit' : 'wiki-table-read',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(containerStyle || {}),
        ...(attributes?.style || {}),
      }}
      onMouseMoveCapture={onMouseMoveCapture}
      onMouseDownCapture={onMouseDownCapture}
      onMouseUpCapture={onMouseUpCapture}
    >
      {table}
      {overlay}
      {controls}
      {mode === 'edit' ? children : null}
    </div>
  );
}