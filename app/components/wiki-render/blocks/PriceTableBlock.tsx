import React from 'react';
import type { WikiRenderMode } from '../types';

type PriceTableBlockProps = {
  mode: WikiRenderMode;

  title?: React.ReactNode;
  description?: React.ReactNode;

  /**
   * 기존 PriceTableCard.tsx에서 만든 실제 가격표 JSX를 그대로 넘기는 자리.
   * 지금 단계에서는 기존 가격표 내부 구조를 건드리지 않기 위해 wrapper만 공통화한다.
   */
  content: React.ReactNode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * 에디터 전용 버튼.
   * 예: 편집 버튼, 삭제 버튼, 옵션 버튼
   */
  editControls?: React.ReactNode;

  /**
   * 읽기 화면 전용 버튼.
   * 예: 복사, 접기/펼치기, 보기 옵션
   */
  readControls?: React.ReactNode;

  compact?: boolean;
};

export default function PriceTableBlock({
  mode,
  title,
  description,
  content,
  attributes,
  children,
  editControls,
  readControls,
  compact = false,
}: PriceTableBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;

  return (
    <div
      {...attributes}
      className={[
        'wiki-price-table-block',
        mode === 'edit' ? 'wiki-price-table-edit' : 'wiki-price-table-read',
        compact ? 'wiki-price-table-compact' : '',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        margin: compact ? '10px 0' : '18px 0',
        ...(attributes?.style || {}),
      }}
    >
      {controls ? (
        <div
          className="wiki-price-table-controls"
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

      {(title || description) ? (
        <div
          className="wiki-price-table-header"
          contentEditable={mode === 'edit' ? false : undefined}
          suppressContentEditableWarning
          style={{
            marginBottom: 10,
          }}
        >
          {title ? (
            <div
              className="wiki-price-table-title"
              style={{
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.35,
                color: 'var(--foreground)',
              }}
            >
              {title}
            </div>
          ) : null}

          {description ? (
            <div
              className="wiki-price-table-description"
              style={{
                marginTop: 4,
                fontSize: 13,
                lineHeight: 1.45,
                color: 'var(--muted-foreground)',
              }}
            >
              {description}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="wiki-price-table-content"
        style={{
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {content}
      </div>

      {mode === 'edit' ? children : null}
    </div>
  );
}