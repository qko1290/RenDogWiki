import React from 'react';
import type { WikiRenderMode } from '../types';

type PriceTableBlockProps = {
  mode: WikiRenderMode;

  /**
   * 기존 PriceTableCard.tsx / WikiReadRenderer.tsx에서 만든 실제 시세표 JSX.
   * 이 컴포넌트는 디자인을 만들지 않고 그대로 출력만 한다.
   */
  content: React.ReactNode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  /**
   * 기존 props 호환용.
   * 원본 복구에서는 별도 제목/설명 UI를 만들지 않는다.
   */
  title?: React.ReactNode;
  description?: React.ReactNode;
  compact?: boolean;
};

export default function PriceTableBlock({
  mode,
  content,
  attributes,
  children,
  editControls,
  readControls,
}: PriceTableBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;

  return (
    <div
      {...attributes}
      className={[
        mode === 'edit' ? 'wiki-price-table-edit' : 'wiki-price-table-read',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        ...(attributes?.style || {}),
      }}
    >
      {controls ? (
        <div
          contentEditable={false}
          suppressContentEditableWarning
          style={{
            position: 'absolute',
            top: -12,
            right: -12,
            zIndex: 5,
          }}
        >
          {controls}
        </div>
      ) : null}

      {content}

      {mode === 'edit' ? children : null}
    </div>
  );
}