import React from 'react';
import type { WikiRenderMode } from '../types';

type TableBlockProps = {
  mode: WikiRenderMode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * 에디터 테이블처럼 outer div에 ref가 필요한 경우 사용.
   */
  containerRef?: React.Ref<HTMLDivElement>;

  /**
   * 기존 TableElementRenderer의 wrapStyle 같은 바깥 wrapper 스타일.
   */
  containerStyle?: React.CSSProperties;

  /**
   * 기존 TableElementRenderer의 onMouseDownCapture/onMouseUpCapture 같은 이벤트.
   */
  onMouseDownCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUpCapture?: React.MouseEventHandler<HTMLDivElement>;

  /**
   * 실제 table JSX.
   * 에디터/읽기 렌더러가 table 생성 방식이 다르면 여기로 각각 넘긴다.
   */
  table: React.ReactNode;

  /**
   * 테이블 위에 겹쳐야 하는 요소.
   * 예: 드래그 선택 오버레이
   */
  overlay?: React.ReactNode;

  /**
   * 편집 화면 전용 컨트롤.
   * 예: 폭 조절 핸들, 행/열 메뉴, 셀 선택 UI
   */
  editControls?: React.ReactNode;

  /**
   * 읽기 화면 전용 컨트롤.
   * 예: 표 복사, 확대 보기
   */
  readControls?: React.ReactNode;

  /**
   * 모바일/좁은 화면에서 가로 스크롤 허용 여부.
   */
  scrollable?: boolean;

  /**
   * 표가 좁은 카드/인포박스 내부에 들어갈 때 사용.
   */
  compact?: boolean;

  /**
   * table을 감싸는 내부 영역 스타일.
   */
  tableInnerStyle?: React.CSSProperties;
};

export default function TableBlock({
  mode,
  attributes,
  children,
  containerRef,
  containerStyle,
  onMouseDownCapture,
  onMouseUpCapture,
  table,
  overlay,
  editControls,
  readControls,
  scrollable = true,
  compact = false,
  tableInnerStyle,
}: TableBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;

  return (
    <div
      {...attributes}
      ref={containerRef}
      className={[
        'wiki-table-block',
        mode === 'edit' ? 'wiki-table-edit' : 'wiki-table-read',
        compact ? 'wiki-table-compact' : '',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        margin: compact ? '8px 0' : '14px 0',
        ...(containerStyle || {}),
        ...(attributes?.style || {}),
      }}
      onMouseDownCapture={onMouseDownCapture}
      onMouseUpCapture={onMouseUpCapture}
    >
      {controls ? (
        <div
          className="wiki-table-controls"
          contentEditable={false}
          suppressContentEditableWarning
          style={{
            position: 'absolute',
            top: -10,
            right: 0,
            zIndex: 5,
          }}
        >
          {controls}
        </div>
      ) : null}

      <div
        className="wiki-table-scroll"
        style={{
          width: '100%',
          maxWidth: '100%',
          overflowX: scrollable ? 'auto' : 'visible',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          className="wiki-table-inner"
          style={{
            position: 'relative',
            minWidth: scrollable ? 'max-content' : undefined,
            width: scrollable ? 'max-content' : '100%',
            maxWidth: scrollable ? 'none' : '100%',
            ...(tableInnerStyle || {}),
          }}
        >
          {table}
          {overlay}
        </div>
      </div>

      {mode === 'edit' ? children : null}
    </div>
  );
}