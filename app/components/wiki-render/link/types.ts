export const FOOTNOTE_HOVER_EVENT = 'rdwiki:footnote-hover';

export type ParsedWikiHref = {
  normalizedHref: string;
  pathParam: string | null;
  titleParam: string | null;
  idParam: string | null;
  hash: string;
  baseDocKey: string;
};

export type WikiDocHeadingMeta = {
  id: string;
  icon?: string | null;
};

export type WikiDocDetail = {
  icon?: string | null;
  title?: string | null;
  tags?: string[];
  path?: string | number | null;
  headings: WikiDocHeadingMeta[];
};

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

export type InlineWikiLinkProps = {
  href: string;
  children: React.ReactNode;
  onWikiNavigate?: (href: string) => void;
  onBeforeNavigate?: () => void;
};
