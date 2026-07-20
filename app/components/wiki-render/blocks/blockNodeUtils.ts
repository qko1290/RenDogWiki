type WikiBlockNode = Record<string, unknown> | null | undefined;

function firstNonEmptyString(
  values: unknown[],
  fallback: string,
) {
  for (const value of values) {
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return fallback;
}

export function resolveDividerStyle(
  node: WikiBlockNode,
) {
  return firstNonEmptyString(
    [
      node?.style,
      node?.styleType,
    ],
    'default',
  );
}

export function resolveInfoBoxTone(
  node: WikiBlockNode,
) {
  return firstNonEmptyString(
    [
      node?.boxType,
      node?.variant,
      node?.tone,
      node?.infoType,
    ],
    'note',
  );
}

export function resolveInfoBoxNoIcon(
  node: WikiBlockNode,
) {
  return Boolean(node?.noIcon);
}