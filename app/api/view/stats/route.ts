import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

type StatsRow = {
  document_id: number;
  views: bigint;
  category_views: bigint;
  search_views: bigint;
  link_views: bigint;
  other_views: bigint;
};

function toItem(row: StatsRow) {
  return {
    documentId: Number(row.document_id),
    views: Number(row.views ?? 0),
    categoryViews: Number(row.category_views ?? 0),
    searchViews: Number(row.search_views ?? 0),
    linkViews: Number(row.link_views ?? 0),
    otherViews: Number(row.other_views ?? 0),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get('range') || 'week').toLowerCase();

  if (!['total', 'day', 'week'].includes(range)) {
    return NextResponse.json({ ok: false, error: 'invalid_range' }, { status: 400 });
  }

  if (range === 'total') {
    const rows = await sql<StatsRow[]>`
      SELECT
        document_id,
        views,
        category_views,
        search_views,
        link_views,
        other_views
      FROM document_stats_total
    `;

    return NextResponse.json({
      ok: true,
      range,
      items: rows.map(toItem),
    });
  }

  if (range === 'day') {
    const rows = await sql<StatsRow[]>`
      SELECT
        document_id,
        views,
        category_views,
        search_views,
        link_views,
        other_views
      FROM document_stats_daily
      WHERE day = CURRENT_DATE
    `;

    return NextResponse.json({
      ok: true,
      range,
      items: rows.map(toItem),
    });
  }

  const rows = await sql<StatsRow[]>`
    SELECT
      document_id,
      SUM(views)::bigint AS views,
      SUM(category_views)::bigint AS category_views,
      SUM(search_views)::bigint AS search_views,
      SUM(link_views)::bigint AS link_views,
      SUM(other_views)::bigint AS other_views
    FROM document_stats_daily
    WHERE day >= (CURRENT_DATE - INTERVAL '6 days')
    GROUP BY document_id
  `;

  return NextResponse.json({
    ok: true,
    range,
    items: rows.map(toItem),
  });
}