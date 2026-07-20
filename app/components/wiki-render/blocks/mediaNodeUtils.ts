type MediaNodeLike =
  | Record<string, unknown>
  | null
  | undefined;

export type ResolvedMediaNode = {
  rawSrc: string;
  alt: string;
  textAlign: string | null;
  width: number | undefined;
  height: number | undefined;
  version: string | number | undefined;
};

export function resolvePositiveMediaSize(
  value: unknown,
): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
      ? value
      : undefined;
  }

  if (typeof value === 'string') {
    const cleaned = value
      .trim()
      .replace(/px$/i, '');

    if (!cleaned) return undefined;

    const numberValue = Number(cleaned);

    return Number.isFinite(numberValue) &&
      numberValue > 0
      ? numberValue
      : undefined;
  }

  return undefined;
}

function resolveMediaVersion(
  node: MediaNodeLike,
): string | number | undefined {
  const value =
    node?.updatedAt ?? node?.version;

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return value;
  }

  return undefined;
}

export function resolveMediaNode(
  node: MediaNodeLike,
): ResolvedMediaNode {
  const rawSrc = String(
    node?.url ?? node?.src ?? '',
  ).trim();

  const alt = String(
    node?.alt ?? '',
  );

  const textAlign =
    typeof node?.textAlign === 'string'
      ? node.textAlign
      : null;

  return {
    rawSrc,
    alt,
    textAlign,
    width: resolvePositiveMediaSize(
      node?.width,
    ),
    height: resolvePositiveMediaSize(
      node?.height,
    ),
    version: resolveMediaVersion(node),
  };
}