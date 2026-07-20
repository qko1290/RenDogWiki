import type { WikiRefKind } from '../types';

type InlineNodeLike =
  | Record<string, unknown>
  | null
  | undefined;

function toFiniteNumber(
  value: unknown,
): number | undefined {
  if (value == null) return undefined;

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : undefined;
}

export function resolveInlineImageNode(
  node: InlineNodeLike,
) {
  const rawSrc = String(
    node?.url ?? node?.src ?? '',
  ).trim();

  const versionValue =
    node?.updatedAt || node?.version;

  const version =
    typeof versionValue === 'string' ||
    typeof versionValue === 'number'
      ? versionValue
      : undefined;

  return {
    rawSrc,
    width: toFiniteNumber(node?.width),
    height: toFiniteNumber(node?.height),
    version,
  };
}

export function resolveInlineMarkNode(
  node: InlineNodeLike,
) {
  return {
    icon: node?.icon as any,
    color: (node?.color ?? null) as string | null,
  };
}

export function resolveWikiRefNode(
  node: InlineNodeLike,
) {
  const kind = String(
    node?.kind ?? node?.refType ?? '',
  ) as WikiRefKind;

  const id = Number(
    node?.id ?? node?.refId,
  );

  return {
    kind,
    id,
  };
}

export type ResolvedFootnoteNode = {
  label: string;
  content: string;
  hasContent: boolean;
};

export function resolveFootnoteNode(
  node: InlineNodeLike,
): ResolvedFootnoteNode {
  const label = String(node?.label ?? '').trim() || '각주';
  const content = String(node?.content ?? '').trim();

  return {
    label,
    content,
    hasContent: content.length > 0,
  };
}
