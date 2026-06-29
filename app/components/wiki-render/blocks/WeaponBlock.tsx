import React from 'react';
import type { WikiRenderMode } from '../types';

type WeaponBlockProps = {
  mode: WikiRenderMode;

  /**
   * WeaponCard.tsx 또는 WikiReadRenderer.tsx에서 이미 완성한 실제 무기 카드 JSX.
   * WeaponBlock은 디자인을 다시 만들지 않는다.
   */
  content?: React.ReactNode;

  /**
   * 호출부가 children으로 넘기는 경우도 보존한다.
   */
  children?: React.ReactNode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  /**
   * 이전 공통화 과정에서 추가된 호환용 props.
   * 원본 복구에서는 별도 스타일 분기에는 사용하지 않는다.
   */
  compact?: boolean;
};

export default function WeaponBlock({
  mode,
  content,
  children,
  attributes,
  editControls,
  readControls,
}: WeaponBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;
  const body = content ?? children;

  return (
    <div
      {...attributes}
      className={[
        mode === 'edit' ? 'wiki-weapon-card-edit' : 'wiki-weapon-card-read',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'relative',
        display: 'block',
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