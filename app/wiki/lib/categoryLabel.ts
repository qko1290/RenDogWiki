// File: app/wiki/lib/categoryLabel.ts
import { resolveCategoryName } from '@wiki/lib/activity';

export async function categoryLabelFromPath(path: unknown): Promise<string> {
  if (path === 0 || path === '0' || path == null) return '루트 카테고리';
  const s = String(path);
  if (/^\d+$/.test(s)) {
    try {
      const name = await resolveCategoryName(Number(s));
      return name || `카테고리#${s}`;
    } catch {
      return `카테고리#${s}`;
    }
  }
  return s;
}
