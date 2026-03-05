import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const range = (searchParams.get('range') || 'day').toLowerCase(); // day | week
  const limitRaw = Number(searchParams.get('limit') || '10');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;

  if (range !== 'day' && range !== 'week') {
    return NextResponse.json({ ok: false, error: 'invalid_range' }, { status: 400 });
  }

  if (range === 'day') {
    // ✅ 오늘 인기 (CURRENT_DATE)
    const rows = await sql<{ document_id: number; views: bigint }[]>`
      SELECT document_id, views
      FROM document_stats_daily
      WHERE day = CURRENT_DATE
      ORDER BY views DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      ok: true,
      range: 'day',
      items: rows.map(r => ({ documentId: r.document_id, views: Number(r.views) })),
    });
  }

  // ✅ 주간 인기: 최근 7일 합산
  const rows = await sql<{ document_id: number; views: bigint }[]>`
    SELECT document_id, SUM(views)::bigint AS views
    FROM document_stats_daily
    WHERE day >= (CURRENT_DATE - INTERVAL '6 days')
    GROUP BY document_id
    ORDER BY views DESC
    LIMIT ${limit}
  `;

  return NextResponse.json({
    ok: true,
    range: 'week',
    items: rows.map(r => ({ documentId: r.document_id, views: Number(r.views) })),
  });
}