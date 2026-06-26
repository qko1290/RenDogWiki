import React from 'react';
import type { WikiRenderMode } from '../types';

type InfoBoxBlockProps = {
  mode: WikiRenderMode;
  tone?: string | null;
  noIcon?: boolean;
  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
  editControls?: React.ReactNode;
  readControls?: React.ReactNode;
};

function normalizeInfoBoxType(raw: string | null | undefined) {
  const v = String(raw || 'info').toLowerCase().trim();

  if (v === 'note') return 'info';
  if (v === 'warn') return 'warning';
  if (v === 'error') return 'danger';
  if (v === 'success') return 'tip';

  if (v === 'white' || v === '하양' || v === '흰색') return 'white';
  if (v === 'yellow' || v === '노랑' || v === '노란') return 'yellow';

  if (
    v === 'lime' ||
    v === 'green' ||
    v === 'lightgreen' ||
    v === 'mint' ||
    v === '연두'
  ) {
    return 'lime';
  }

  if (v === 'pink' || v === 'lightpink' || v === 'rose' || v === '연분홍') {
    return 'pink';
  }

  if (v === 'red' || v === 'crimson' || v === '빨강' || v === '빨간') {
    return 'red';
  }

  return v;
}

function getInfoboxPreset(
  rawTone?: string | null,
  forceNoIcon?: boolean
): {
  container: React.CSSProperties;
  icon: (React.CSSProperties & Record<string, any>) | null;
  role: 'note' | 'alert';
  showIcon: boolean;
  type: string;
} {
  const type = normalizeInfoBoxType(rawTone);

  const baseContainer: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    color: 'var(--foreground)',
    boxShadow: 'var(--shadow-sm)',
  };

  const map: Record<
    string,
    {
      bg: string;
      bd: string;
      accent: string;
      mask?: string;
      role: 'note' | 'alert';
      noIcon?: boolean;
    }
  > = {
    info: {
      bg: 'rgba(59,130,246,0.12)',
      bd: 'rgba(96,165,250,0.28)',
      accent: '#3b82f6',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-info.svg?v=2&token=a463935e93',
      role: 'note',
    },
    warning: {
      bg: 'rgba(245,158,11,0.12)',
      bd: 'rgba(251,191,36,0.30)',
      accent: '#f59e0b',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93',
      role: 'note',
    },
    danger: {
      bg: 'rgba(239,68,68,0.12)',
      bd: 'rgba(248,113,113,0.28)',
      accent: '#ef4444',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/triangle-exclamation.svg?v=2&token=a463935e93',
      role: 'alert',
    },
    tip: {
      bg: 'rgba(16,185,129,0.12)',
      bd: 'rgba(52,211,153,0.28)',
      accent: '#10b981',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93',
      role: 'note',
    },

    white: {
      bg: 'var(--surface-elevated)',
      bd: 'var(--border)',
      accent: 'var(--muted-2)',
      role: 'note',
      noIcon: true,
    },
    yellow: {
      bg: 'rgba(250,204,21,0.14)',
      bd: 'rgba(250,204,21,0.32)',
      accent: '#ca8a04',
      role: 'note',
      noIcon: true,
    },
    green: {
      bg: 'rgba(34,197,94,0.14)',
      bd: 'rgba(74,222,128,0.28)',
      accent: '#16a34a',
      role: 'note',
      noIcon: true,
    },
    lime: {
      bg: 'rgba(34,197,94,0.14)',
      bd: 'rgba(74,222,128,0.28)',
      accent: '#16a34a',
      role: 'note',
      noIcon: true,
    },
    pink: {
      bg: 'rgba(236,72,153,0.12)',
      bd: 'rgba(244,114,182,0.28)',
      accent: '#db2777',
      role: 'note',
      noIcon: true,
    },
    red: {
      bg: 'rgba(239,68,68,0.12)',
      bd: 'rgba(248,113,113,0.28)',
      accent: '#dc2626',
      role: 'alert',
      noIcon: true,
    },
  };

  const sel = map[type] ?? map.info;
  const noIcon = forceNoIcon || sel.noIcon;

  const container: React.CSSProperties = {
    ...baseContainer,
    background: sel.bg,
    border: `1px solid ${sel.bd}`,
    ...(noIcon ? { gap: 0 } : null),
  };

  const showIcon = !noIcon && !!sel.mask;

  const icon: (React.CSSProperties & Record<string, any>) | null = showIcon
    ? {
        flex: '0 0 auto',
        width: 18,
        height: 18,
        marginTop: 2,
        backgroundColor: sel.accent,
        WebkitMaskImage: `url(${sel.mask})`,
        maskImage: `url(${sel.mask})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }
    : null;

  return {
    container,
    icon,
    role: sel.role,
    showIcon,
    type,
  };
}

export default function InfoBoxBlock({
  mode,
  tone,
  noIcon,
  attributes,
  children,
  editControls,
  readControls,
}: InfoBoxBlockProps) {
  const { container, icon, role, showIcon, type } = getInfoboxPreset(
    tone,
    noIcon
  );

  const controls = mode === 'edit' ? editControls : readControls;

  return (
    <div
      {...attributes}
      role={role}
      className={[
        'info-box',
        `info-${type}`,
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...container,
        ...(attributes?.style || {}),
      }}
    >
      {showIcon && icon ? (
        <span
          aria-hidden
          contentEditable={false}
          suppressContentEditableWarning
          style={icon}
        />
      ) : null}

      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        {children}
      </div>

      {controls ? (
        <div
          contentEditable={false}
          suppressContentEditableWarning
          style={{
            flex: '0 0 auto',
            marginLeft: 8,
          }}
        >
          {controls}
        </div>
      ) : null}
    </div>
  );
}