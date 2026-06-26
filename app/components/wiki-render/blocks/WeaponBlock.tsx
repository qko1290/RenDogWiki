import React from 'react';
import type { WikiRenderMode } from '../types';

type WeaponBlockProps = {
  mode: WikiRenderMode;

  /**
   * 기존 WeaponCard.tsx 또는 WikiReadRenderer.tsx에서 만든 실제 무기 카드 JSX.
   * 지금 단계에서는 내부 구조를 건드리지 않고 wrapper만 공통화한다.
   */
  content: React.ReactNode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * 에디터 전용 버튼/모달 트리거.
   * 예: 편집, 삭제, 옵션, 상세 모달 버튼
   */
  editControls?: React.ReactNode;

  /**
   * 읽기 화면 전용 버튼.
   * 예: 상세 보기, 복사, 접기/펼치기
   */
  readControls?: React.ReactNode;

  compact?: boolean;
};

export default function WeaponBlock({
  mode,
  content,
  attributes,
  children,
  editControls,
  readControls,
  compact = false,
}: WeaponBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;

  return (
    <div
      {...attributes}
      className={[
        'wiki-weapon-block',
        mode === 'edit' ? 'wiki-weapon-edit' : 'wiki-weapon-read',
        compact ? 'wiki-weapon-compact' : '',
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
          className="wiki-weapon-controls"
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
        className="wiki-weapon-content"
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