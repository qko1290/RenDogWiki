import React from 'react';
import type { WikiRenderMode } from '../types';

export type InfoBoxTone =
  | 'note'
  | 'warn'
  | 'danger'
  | 'tip'
  | 'white'
  | 'yellow'
  | 'lime'
  | 'pink'
  | 'red';

type InfoBoxBlockProps = {
  mode: WikiRenderMode;
  tone?: string | null;
  noIcon?: boolean;
  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * 편집/읽기 모드에서만 필요한 버튼이나 보조 UI를 넣기 위한 자리.
   * 예: 삭제 버튼, 복사 버튼, 편집 버튼, 링크 이동 버튼 등.
   */
  editControls?: React.ReactNode;
  readControls?: React.ReactNode;
};

export function resolveInfoBoxTone(rawTone?: string | null): InfoBoxTone {
  const raw = String(rawTone ?? '').toLowerCase().trim();

  if (raw === 'danger' || raw === 'error') return 'danger';
  if (raw === 'warn' || raw === 'warning') return 'warn';
  if (raw === 'tip' || raw === 'success') return 'tip';

  if (
    raw === 'white' ||
    raw === 'yellow' ||
    raw === 'lime' ||
    raw === 'pink' ||
    raw === 'red'
  ) {
    return raw;
  }

  return 'note';
}

function isColorTone(tone: InfoBoxTone) {
  return (
    tone === 'white' ||
    tone === 'yellow' ||
    tone === 'lime' ||
    tone === 'pink' ||
    tone === 'red'
  );
}

function getIcon(tone: InfoBoxTone) {
  if (tone === 'warn') return '⚠️';
  if (tone === 'danger') return '⛔';
  if (tone === 'tip') return '💡';
  return 'ℹ️';
}

function getInlineStyle(tone: InfoBoxTone): React.CSSProperties | undefined {
  if (tone === 'white') {
    return {
      background: '#ffffff',
      border: '1px solid #d6d6d6',
    };
  }

  if (tone === 'yellow') {
    return {
      background: '#fff6cc',
      border: '1px solid #f0d36a',
    };
  }

  if (tone === 'lime') {
    return {
      background: '#e9ffd0',
      border: '1px solid #a7d86a',
    };
  }

  if (tone === 'pink') {
    return {
      background: '#ffe1ea',
      border: '1px solid #f2a7c2',
    };
  }

  if (tone === 'red') {
    return {
      background: '#ffd7d7',
      border: '1px solid #ff9a9a',
    };
  }

  return undefined;
}

function getRole(tone: InfoBoxTone): React.AriaRole | undefined {
  if (tone === 'warn' || tone === 'danger') return 'note';
  return undefined;
}

export default function InfoBoxBlock({
  mode,
  tone: rawTone,
  noIcon,
  attributes,
  children,
  editControls,
  readControls,
}: InfoBoxBlockProps) {
  const tone = resolveInfoBoxTone(rawTone);
  const colorTone = isColorTone(tone);
  const showIcon = !noIcon && !colorTone;
  const controls = mode === 'edit' ? editControls : readControls;

  const className = [
    'info-box',
    `info-${tone}`,
    `wiki-info-box`,
    `wiki-info-box-${tone}`,
    attributes?.className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...attributes}
      className={className}
      role={getRole(tone)}
      style={{
        position: 'relative',
        ...(getInlineStyle(tone) || {}),
        ...(attributes?.style || {}),
      }}
    >
      {showIcon ? (
        <span
          className="info-box-icon wiki-info-box-icon"
          contentEditable={mode === 'edit' ? false : undefined}
          suppressContentEditableWarning
          style={{
            marginRight: 8,
            userSelect: 'none',
          }}
        >
          {getIcon(tone)}
        </span>
      ) : null}

      <div className="info-box-content wiki-info-box-content">
        {children}
      </div>

      {controls ? (
        <div
          className="wiki-info-box-controls"
          contentEditable={mode === 'edit' ? false : undefined}
          suppressContentEditableWarning
        >
          {controls}
        </div>
      ) : null}
    </div>
  );
}