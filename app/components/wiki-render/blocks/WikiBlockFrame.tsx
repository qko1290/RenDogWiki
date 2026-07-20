import React from 'react';

import type { WikiRenderMode } from '../types';

type WikiBlockFrameProps = {
  mode: WikiRenderMode;

  editClassName: string;
  readClassName: string;

  content?: React.ReactNode;
  children?: React.ReactNode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;
};

export default function WikiBlockFrame({
  mode,
  editClassName,
  readClassName,
  content,
  children,
  attributes,
  editControls,
  readControls,
}: WikiBlockFrameProps) {
  const controls =
    mode === 'edit'
      ? editControls
      : readControls;

  const body = content ?? children;

  const {
    className: attributeClassName,
    style: attributeStyle,
    ...restAttributes
  } = attributes ?? {};

  const modeClassName =
    mode === 'edit'
      ? editClassName
      : readClassName;

  return (
    <div
      {...restAttributes}
      className={[
        modeClassName,
        attributeClassName,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        maxWidth: '100%',
        ...attributeStyle,
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