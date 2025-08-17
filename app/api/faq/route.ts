// app/api/faq/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = 'nodejs';

function pgArrayToJs(input: unknown): string[] {
  if (Array.isArray(input)) return input as string[];
  if (typeof input !== 'string') return [];
  const s = input.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return s ? [s] : [];
  const inner = s.slice(1, -1);
  if (!inner) return [];
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"' && inner[i - 1] !== '\\') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur.replace(/\\"/g, '"')); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.replace(/\\"/g, '"'));
  return out.map(v => v.trim()).filter(Boolean);
}
function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return [...new Set(tags.map(String).map(s => s.trim()).filter(Boolean))];
  if (typeof tags === 'string') return [...new Set(tags.split(',').map(s => s.trim()).filter(Boolean))];
  return [];
}

// GET /api/faq?q=&tags=&limit=&offset=
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') ?? '').trim();
    const tagsCsv = (sp.get('tags') ?? '').trim();
    const limit = Math.max(1, Math.min(100, Number(sp.get('limit') ?? 20)));
    const offset = Math.max(0, Number(sp.get('offset') ?? 0));

    // 조건을 파라미터화: q/tags가 비어있으면 무시되도록
    const rows = await sql`
      SELECT id, title, content, tags, uploader, created_at, updated_at
      FROM faq_questions
      WHERE (${q} = '' OR title ILIKE ${'%' + q + '%'} OR content ILIKE ${'%' + q + '%'})
        AND (${tagsCsv} = '' OR tags && string_to_array(${tagsCsv}, ','))
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await sql`
      SELECT COUNT(*) AS cnt
      FROM faq_questions
      WHERE (${q} = '' OR title ILIKE ${'%' + q + '%'} OR content ILIKE ${'%' + q + '%'})
        AND (${tagsCsv} = '' OR tags && string_to_array(${tagsCsv}, ','))
    `;

    return NextResponse.json(
      {
        items: rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          tags: pgArrayToJs(r.tags),
          uploader: r.uploader,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
        total: Number(totalRows[0]?.cnt ?? 0),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('FAQ 목록 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

// POST /api/faq  {title, content, tags?: string[]|csv}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = String(body?.title ?? '').trim();
    const content = String(body?.content ?? '').trim();
    const tagsCsv = normalizeTags(body?.tags).join(',');
    if (!title || !content) return NextResponse.json({ error: 'Missing title/content' }, { status: 400 });

    const user = getAuthUser();
    const uploader = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? 'anonymous';

    const rows = await sql`
      INSERT INTO faq_questions (title, content, tags, uploader)
      VALUES (${title}, ${content}, string_to_array(${tagsCsv}, ','), ${uploader})
      RETURNING id, title, content, tags, uploader, created_at, updated_at
    `;
    const r = rows[0];
    return NextResponse.json(
      {
        id: r.id,
        title: r.title,
        content: r.content,
        tags: pgArrayToJs(r.tags),
        uploader: r.uploader,
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('FAQ 생성 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
