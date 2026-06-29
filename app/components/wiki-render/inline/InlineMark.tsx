import React from 'react';

type InlineMarkProps = {
  mode: 'read' | 'edit';
  icon?: React.ReactNode;
  color?: string | null;
  children?: React.ReactNode;
  attributes?: React.HTMLAttributes<HTMLSpanElement>;
};

export default function InlineMark({
  mode,
  icon,
  color,
  children,
  attributes,
}: InlineMarkProps) {
  return (
    <span
      {...attributes}
      contentEditable={mode === 'edit' ? false : attributes?.contentEditable}
      suppressContentEditableWarning={mode === 'edit' ? true : undefined}
      data-wiki-inline="inline-mark"
      data-wiki-mode={mode}
      className={['inline-mark', attributes?.className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-block',
        fontWeight: 'bold',
        color: color || '#888',
        fontSize: '1.08em',
        marginRight: 8,
        marginLeft: 2,
        marginTop: 0,
        userSelect: mode === 'edit' ? 'none' : undefined,
        verticalAlign: 'middle',
        ...(attributes?.style ?? {}),
      }}
    >
      {icon}
      {children}
    </span>
  );
}