// app/api/bootstrap/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { cached } from '@/wiki/lib/cache';

export const runtime = 'nodejs';

const FEATURED_ID = 73;

export async function GET() {
  try {
    const data = await cached(
      'bootstrap:v1',
      { ttlSec: 300, tags: ['category:list', 'category:tree', 'doc:list', `doc:${FEATURED_ID}`] },
      async () => {
        const categories = await sql/*sql*/`
          SELECT id, name, parent_id, "order", document_id, icon, mode_tags
          FROM categories
          ORDER BY parent_id, "order"`;

        const docs = await sql/*sql*/`
          SELECT id, title, path, icon, is_featured, special, "order", updated_at
          FROM documents`;

        const featuredHead = await sql/*sql*/`
          SELECT id, title, path, icon, tags, special, "order", updated_at
          FROM documents WHERE id = ${FEATURED_ID} LIMIT 1`;
        const featuredBody = await sql/*sql*/`
          SELECT content FROM document_contents WHERE document_id = ${FEATURED_ID} LIMIT 1`;

        return {
          categories,
          documents: docs.map((r: any) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            icon: r.icon,
            is_featured: !!r.is_featured,
            special: r.special ?? null,
            order: Number(r.order ?? 0),
            updated_at: r.updated_at
          })),
          featured: featuredHead?.[0]
            ? { ...featuredHead[0], content: featuredBody?.[0]?.content ?? [] }
            : null
        };
      }
    );

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
    });
  } catch (e) {
    console.error('[bootstrap] error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
