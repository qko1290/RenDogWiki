type FootnoteNodeLike =
  | Record<string, unknown>
  | null
  | undefined;

export type ResolvedFootnoteNode = {
  label: string;
  content: string;
  hasContent: boolean;
};

export function resolveFootnoteNode(
  node: FootnoteNodeLike,
): ResolvedFootnoteNode {
  const label =
    String(node?.label ?? '').trim() ||
    '각주';

  const content =
    String(node?.content ?? '').trim();

  return {
    label,
    content,
    hasContent: content.length > 0,
  };
}