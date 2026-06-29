import React from 'react';

type InlineLinkRendererProps = {
  mode: 'read' | 'edit';
  href?: string | null;
  children?: React.ReactNode;
  attributes?: React.AnchorHTMLAttributes<HTMLAnchorElement>;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
  onFocus?: React.FocusEventHandler<HTMLAnchorElement>;
  onBlur?: React.FocusEventHandler<HTMLAnchorElement>;
  ariaDescribedBy?: string;
};

export default function InlineLinkRenderer({
  mode,
  href,
  children,
  attributes,
  className,
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ariaDescribedBy,
}: InlineLinkRendererProps) {
  const safeHref = String(href ?? '#');

  return (
    <a
      {...attributes}
      href={safeHref}
      data-wiki-inline="link"
      data-wiki-mode={mode}
      className={[attributes?.className, className].filter(Boolean).join(' ') || undefined}
      onClick={onClick ?? attributes?.onClick}
      onMouseEnter={onMouseEnter ?? attributes?.onMouseEnter}
      onMouseLeave={onMouseLeave ?? attributes?.onMouseLeave}
      onFocus={onFocus ?? attributes?.onFocus}
      onBlur={onBlur ?? attributes?.onBlur}
      aria-describedby={ariaDescribedBy ?? attributes?.['aria-describedby']}
      target={mode === 'read' ? attributes?.target : undefined}
      rel={mode === 'read' ? attributes?.rel : undefined}
      style={{
        color: 'var(--accent, #2676ff)',
        textDecoration: 'none',
        cursor: mode === 'edit' ? 'text' : 'pointer',
        ...(attributes?.style ?? {}),
        ...style,
      }}
    >
      {children}
    </a>
  );
}