import React from 'react';

type LinkBlockRowAttributes = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

type LinkBlockRowProps = {
  attributes?: LinkBlockRowAttributes;
  children: React.ReactNode;
};

export default function LinkBlockRow({
  attributes,
  children,
}: LinkBlockRowProps) {
  const {
    ref,
    style,
    ...restAttributes
  } = attributes ?? {};

  return (
    <div
      ref={ref}
      {...restAttributes}
      style={{
        display: 'flex',
        gap: 12,
        margin: '8px 0',
        width: '100%',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        ...style,
      }}
    >
      {children}
    </div>
  );
}