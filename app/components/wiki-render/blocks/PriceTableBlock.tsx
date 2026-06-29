import React from 'react';
import type { WikiRenderMode } from '../types';

type PriceTableBlockProps = {
  mode: WikiRenderMode;

  /**
   * 에디터 PriceTableCard.tsx처럼 완성된 JSX를 넘기는 경우 사용.
   */
  content?: React.ReactNode;

  /**
   * 문서 렌더러 WikiReadRenderer.tsx처럼 기존 원본 JSX를 children으로 넘기는 경우 사용.
   */
  children?: React.ReactNode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  /**
   * 예전 공통화 과정에서 추가된 props.
   * 원본 복구에서는 별도 UI를 만들지 않고 호환용으로만 둔다.
   */
  title?: React.ReactNode;
  description?: React.ReactNode;
  compact?: boolean;
};

export default function PriceTableBlock({
  mode,
  content,
  children,
  attributes,
  editControls,
  readControls,
}: PriceTableBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;

  /**
   * 핵심:
   * - 에디터는 content prop으로 실제 시세표 JSX가 들어온다.
   * - 문서 렌더러는 기존 원본 JSX가 children으로 들어올 수 있다.
   *
   * 따라서 content가 있으면 content를 우선 출력하고,
   * content가 없으면 children을 출력해야 한다.
   */
  const body = content ?? children;

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

      {body}
    </div>
  );
}