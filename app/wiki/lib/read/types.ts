import type {
  Key,
  MutableRefObject,
  ReactNode,
} from 'react';

import type {
  WikiRefKind,
} from '@/components/wiki-render/types';

export type ReadRenderEnv = {
  isMobile?: boolean;
  isDarkMode?: boolean;
  inDarkTableCell?: boolean;
  inTableCell?: boolean;
  inLinkBlockRow?: boolean;
  onWikiNavigate?: (href: string) => void;
};

export type HeadingCopyCtx = {
  headingOccRef: MutableRefObject<
    Map<string, number>
  >;
};

export type WikiRefHandlers = {
  readOnly?: boolean;
  onWikiRefClick?: (
    kind: WikiRefKind,
    id: number,
  ) => void | Promise<void>;
};

export type ReadRenderNode = (
  node: any,
  key?: Key,
  ctx?: HeadingCopyCtx,
  handlers?: WikiRefHandlers,
  env?: ReadRenderEnv,
) => ReactNode;