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