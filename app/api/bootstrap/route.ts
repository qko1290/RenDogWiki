// =============================================
// File: app/api/bootstrap/route.ts
// (전체 코드)
// - 위키 초기 bootstrap 데이터
// - 대표 문서는 헤더+본문을 한 번에 조회
// - 로컬 TTL 캐시 + stale-on-error 사용
// =============================================

import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { cached } from '@/wiki/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FEATURED_ID = 73;

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  };
}

export async function GET() {
  try {
    const data = await cached(
      'bootstrap:v2',
      {
        ttlSec: 60,
        tags: ['category:list', 'category:tree', 'doc:list', `doc:${FEATURED_ID}`],
      },
      async () => {
        const categories = await sql`
          SELECT id, name, parent_id, "order", document_id, icon, mode_tags
          FROM categories
          ORDER BY parent_id, "order"
        `;

        const docs = await sql`
          SELECT id, title, path, icon, is_featured, special, "order", updated_at
          FROM documents
        `;

        const featuredRows = await sql`
          SELECT
            d.id,
            d.title,
            d.path,
            d.icon,
            d.tags,
            d.special,
            d."order",
            d.updated_at,
            dc.content
          FROM documents d
          LEFT JOIN document_contents dc
            ON dc.document_id = d.id
          WHERE d.id = ${FEATURED_ID}
          LIMIT 1
        `;

        const featured = featuredRows?.[0]
          ? {
              ...featuredRows[0],
              content: featuredRows[0].content ?? [],
            }
          : null;

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
            updated_at: r.updated_at,
          })),
          featured,
        };
      }
    );

    return NextResponse.json(data, {
      headers: noStoreHeaders(),
    });
  } catch (e) {
    console.error('[bootstrap] error', e);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}