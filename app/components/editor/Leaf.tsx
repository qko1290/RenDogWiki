'use client';

import React from 'react';
import { RenderLeafProps } from 'slate-react';

import { LeafRenderer } from '@/components/wiki-render/inline';

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  return (
    <LeafRenderer
      mode="edit"
      leaf={leaf}
      attributes={attributes as React.HTMLAttributes<HTMLSpanElement>}
      useDefaultFontFamily={false}
    >
      {children}
    </LeafRenderer>
  );
};

export default Leaf;