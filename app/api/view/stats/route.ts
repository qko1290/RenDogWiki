import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get('range') || 'week').toLowerCase(); // total | day | week

  if (!['total', 'day', 'week'].includes(range)) {
    return NextResponse.json({ ok: false, error: 'invalid_range' }, { status: 400 });
  }

  if (range === 'total') {
    const rows = await sql<{ document_id: number; views: bigint }[]>`
      SELECT document_id, views
      FROM document_stats_total
    `;
    return NextResponse.json({
      ok: true,
      range,
      items: rows.map(r => ({ documentId: r.document_id, views: Number(r.views) })),
    });
  }

  if (range === 'day') {
    const rows = await sql<{ document_id: number; views: bigint }[]>`
      SELECT document_id, views
      FROM document_stats_daily
      WHERE day = CURRENT_DATE
    `;
    return NextResponse.json({
      ok: true,
      range,
      items: rows.map(r => ({ documentId: r.document_id, views: Number(r.views) })),
    });
  }

  // week: 최근 7일 합산
  const rows = await sql<{ document_id: number; views: bigint }[]>`
    SELECT document_id, SUM(views)::bigint AS views
    FROM document_stats_daily
    WHERE day >= (CURRENT_DATE - INTERVAL '6 days')
    GROUP BY document_id
  `;

  return NextResponse.json({
    ok: true,
    range,
    items: rows.map(r => ({ documentId: r.document_id, views: Number(r.views) })),
  });
}