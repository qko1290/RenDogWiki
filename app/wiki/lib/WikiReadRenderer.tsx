import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Descendant } from 'slate';

import type { WikiRefKind } from '@/components/editor/render/types';

import {
  LinkBlockRowReadAdapter,
} from './read/LinkBlockReadAdapter';
import { renderReadNode } from './read/WikiReadNodeRenderer';
import type {
  HeadingCopyCtx,
  WikiRefHandlers,
} from './read/types';
import {
  compactReadContent,
  getCurrentThemeIsDark,
} from './readRendererUtils';

type WikiReadRendererProps = {
  content: Descendant[];
  readOnly?: boolean;
  onWikiRefClick?: (
    kind: WikiRefKind,
    id: number,
  ) => void | Promise<void>;
  onWikiNavigate?: (href: string) => void;
};

function isHalfLinkBlock(node: any) {
  return (
    node?.type === 'link-block' &&
    (node?.size === 'small' || node?.size === 'half')
  );
}

export default function WikiReadRenderer({
  content,
  readOnly = true,
  onWikiRefClick,
  onWikiNavigate,
}: WikiReadRendererProps) {
  const headingOccRef = useRef<Map<string, number>>(
    new Map(),
  );

  headingOccRef.current = new Map();

  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)',
    );

    const apply = () => {
      setIsDarkMode(mediaQuery.matches);
    };

    apply();

    if (
      typeof mediaQuery.addEventListener === 'function'
    ) {
      mediaQuery.addEventListener('change', apply);

      return () => {
        mediaQuery.removeEventListener('change', apply);
      };
    }

    mediaQuery.addListener(apply);

    return () => {
      mediaQuery.removeListener(apply);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apply = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    apply();
    window.addEventListener('resize', apply);

    return () => {
      window.removeEventListener('resize', apply);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const apply = () => {
      setIsDarkMode(getCurrentThemeIsDark());
    };

    apply();

    const html = document.documentElement;
    const body = document.body;

    const observer = new MutationObserver(apply);

    observer.observe(html, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    if (body) {
      observer.observe(body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handlers: WikiRefHandlers = {
    readOnly,
    onWikiRefClick,
  };

  const ctx: HeadingCopyCtx = {
    headingOccRef,
  };

  const env = {
    isMobile,
    isDarkMode,
    onWikiNavigate,
  };

  const normalized = compactReadContent(content);
  const rendered: React.ReactNode[] = [];

  for (
    let index = 0;
    index < normalized.length;
    index += 1
  ) {
    const node: any = normalized[index];
    const nextNode: any = normalized[index + 1];

    if (
      isHalfLinkBlock(node) &&
      isHalfLinkBlock(nextNode)
    ) {
      const rowKey = `link-row-${index}`;

      rendered.push(
        <LinkBlockRowReadAdapter
          key={rowKey}
          node={{
            type: 'link-block-row',
            children: [node, nextNode],
          }}
          keyProp={rowKey}
          ctx={ctx}
          handlers={handlers}
          env={env}
          renderNode={renderReadNode}
        />,
      );

      index += 1;
      continue;
    }

    rendered.push(
      renderReadNode(
        node,
        index,
        ctx,
        handlers,
        env,
      ),
    );
  }

  return <>{rendered}</>;
}