import React from 'react';

type FootnoteInlineProps = {
  mode: 'read' | 'edit';
  label?: string | null;
  content?: string | null;
  children?: React.ReactNode;
  attributes?: React.HTMLAttributes<HTMLSpanElement>;
  title?: string;
  onContextMenu?: React.MouseEventHandler<HTMLSpanElement>;

  className?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
  ariaLabel?: string;

  onMouseEnter?: React.MouseEventHandler<HTMLSpanElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLSpanElement>;
  onFocus?: React.FocusEventHandler<HTMLSpanElement>;
  onBlur?: React.FocusEventHandler<HTMLSpanElement>;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
};

const FootnoteInline = React.forwardRef<HTMLSpanElement, FootnoteInlineProps>(
  function FootnoteInline(
    {
      mode,
      label,
      children,
      attributes,
      title,
      onContextMenu,
      className,
      style,
      tabIndex,
      ariaLabel,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      onClick,
    },
    ref,
  ) {
    const safeLabel = String(label ?? '').trim() || '각주';

    return (
      <span
        {...attributes}
        ref={ref}
        contentEditable={mode === 'edit' ? false : attributes?.contentEditable}
        suppressContentEditableWarning
        data-footnote="true"
        data-wiki-inline="footnote"
        data-wiki-mode={mode}
        title={title ?? attributes?.title}
        className={[attributes?.className, className].filter(Boolean).join(' ') || undefined}
        tabIndex={tabIndex ?? attributes?.tabIndex}
        aria-label={ariaLabel ?? attributes?.['aria-label']}
        onContextMenu={onContextMenu ?? attributes?.onContextMenu}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={onClick}
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
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          ...(attributes?.style ?? {}),
          ...style,
        }}
      >
        [{safeLabel}]
        {children}
      </span>
    );
  },
);

export default FootnoteInline;