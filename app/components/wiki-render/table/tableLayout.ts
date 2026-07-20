import type { CSSProperties } from 'react';
import type { WikiTableAlign, WikiTableContainerLayoutInput } from './types';

export function normalizeTableAlign(
  align?: WikiTableAlign | string | null,
): WikiTableAlign {
  if (align === 'center' || align === 'right') return align;
  return 'left';
}

export function getTableContainerStyle(
  input: WikiTableContainerLayoutInput,
): CSSProperties {
  const wrapWidth =
    typeof input.liveWidth === 'number'
      ? input.liveWidth
      : typeof input.maxWidth === 'number'
        ? input.maxWidth
        : null;

  const fullWidth = Boolean(input.fullWidth);
  const align = normalizeTableAlign(input.align);

  const style: CSSProperties = {
    position: 'relative',
    width: wrapWidth ? `${wrapWidth}px` : fullWidth ? '100%' : undefined,
    maxWidth: '100%',
  };

  if (!fullWidth) {
    if (align === 'center') {
      style.marginLeft = 'auto';
      style.marginRight = 'auto';
    } else if (align === 'right') {
      style.marginLeft = 'auto';
      style.marginRight = 0;
    } else {
      style.marginLeft = 0;
      style.marginRight = 'auto';
    }
  }

  return style;
}

export const tableElementBaseStyle: CSSProperties = {
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  width: '100%',
};

export const tableCellBaseStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  padding: '4px 6px',
  verticalAlign: 'middle',
};