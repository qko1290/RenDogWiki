import React from 'react';
import type { WikiRenderMode } from '../types';

type TableBlockProps = {
  mode: WikiRenderMode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  containerRef?: React.Ref<HTMLDivElement>;
  containerStyle?: React.CSSProperties;

  onMouseMoveCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseDownCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUpCapture?: React.MouseEventHandler<HTMLDivElement>;

  table: React.ReactNode;
  overlay?: React.ReactNode;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  /**
   * 이전 공통화 과정에서 추가된 옵션.
   * 원본 디자인 복구 목적에서는 새 wrapper/scroll 영역을 만들지 않기 때문에
   * props 호환용으로만 남겨둔다.
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
        /**
         * 핵심:
         * WikiReadRenderer / TableElementRenderer에서 계산한 원본 wrapper style을
         * TableBlock이 덮어쓰면 표의 크기, 정렬, 간격이 틀어진다.
         */
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