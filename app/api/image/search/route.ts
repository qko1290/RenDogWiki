// app/api/image/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const lim = Number(searchParams.get('limit') || '200');
  const limit = Number.isFinite(lim) ? Math.min(500, Math.max(1, lim)) : 200;

  if (!q) {
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
  }

  const rows = await sql`
    SELECT id, name, url, folder_id
    FROM images
    WHERE name ILIKE ${'%' + q + '%'}
    ORDER BY id DESC
    LIMIT ${limit}
  `;

  return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}
