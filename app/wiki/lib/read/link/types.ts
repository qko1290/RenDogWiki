import type { ReactNode } from 'react';

export type WikiLinkPreviewData = {
  icon: string | null;
  categoryLabel: string;
  title: string;
  tags: string[];
};

export type WikiCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
};

export type InlineWikiLinkReadProps = {
  href: string;
  children: ReactNode;
  onWikiNavigate?: (href: string) => void;
  onBeforeNavigate?: () => void;
};