import React from 'react';

type FootnoteInlineProps = {
  mode: 'read' | 'edit';
  label?: string | null;
  content?: string | null;
  children?: React.ReactNode;
  attributes?: React.HTMLAttributes<HTMLSpanElement>;
  title?: string;
  onContextMenu?: React.MouseEventHandler<HTMLSpanElement>;
};

export default function FootnoteInline({
  mode,
  label,
  children,
  attributes,
  title,
  onContextMenu,
}: FootnoteInlineProps) {
  const safeLabel = String(label ?? '').trim() || '각주';

  return (
    <span
      {...attributes}
      contentEditable={mode === 'edit' ? false : attributes?.contentEditable}
      suppressContentEditableWarning
      data-footnote="true"
      data-wiki-inline="footnote"
      data-wiki-mode={mode}
      title={title ?? attributes?.title}
      onContextMenu={onContextMenu ?? attributes?.onContextMenu}
      style={{
        display: 'inline-block',
        verticalAlign: 'super',
        position: 'relative',
        top: '-0.05em',
        marginLeft: 1,
        marginRight: 1,
        padding: 0,
        background: 'transparent',
        borderRadius: 0,
        color: '#7c3aed',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: 0,
        userSelect: mode === 'edit' ? 'none' : undefined,
        cursor: mode === 'edit' ? 'pointer' : 'help',
        whiteSpace: 'nowrap',
        ...(attributes?.style ?? {}),
      }}
    >
      [{safeLabel}]
      {children}
    </span>
  );
}