// app/api/warmup/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { cached, cacheKey } from '@/wiki/lib/cache';

export const runtime = 'nodejs';

const FEATURED_ID = 73; // 루트 대표 문서

const docTag = (id: number) => `doc:${id}`;

export async function GET() {
  try {
    // DB 핸드셰이크(커넥션 워밍)
    await sql`SELECT 1`;

    // categories 전체 캐시(같은 키/태그로 프라임)
    await cached(
      'category:all',
      { ttlSec: 600, tags: ['category:list', 'category:tree'] },
      async () => sql`SELECT * FROM categories ORDER BY parent_id, "order"`
    );

    // documents all(메타)
    await cached(
      'doc:all',
      { ttlSec: 300, tags: ['doc:list'] },
      async () => sql/*sql*/`
        SELECT id, title, path, icon, tags, created_at, updated_at, is_featured, special, "order"
        FROM documents`
    );

    // 대표 문서 본문 프라임
    await cached(
      cacheKey('doc', FEATURED_ID),
      { ttlSec: 1800, tags: [docTag(FEATURED_ID)] },
      async () => {
        const head = await sql/*sql*/`
          SELECT id, title, path, icon, tags, created_at, updated_at, special, "order"
          FROM documents WHERE id = ${FEATURED_ID} LIMIT 1`;
        const body = await sql/*sql*/`
          SELECT content FROM document_contents WHERE document_id = ${FEATURED_ID} LIMIT 1`;
        return { ...head?.[0], content: body?.[0]?.content ?? [] };
      }
    );

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[warmup] error', e);
    return NextResponse.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
