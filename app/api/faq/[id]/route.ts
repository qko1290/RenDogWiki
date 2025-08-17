// app/api/faq/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

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

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const rows = await sql`
      SELECT id, title, content, tags, uploader, created_at, updated_at
      FROM faq_questions
      WHERE id = ${id}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return new NextResponse(null, { status: 204 });

    return NextResponse.json({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: pgArrayToJs(r.tags),
      uploader: r.uploader,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  } catch (e) {
    console.error('FAQ 단건 조회 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    const title: string | null = body?.title != null ? String(body.title).trim() : null;
    const content: string | null = body?.content != null ? String(body.content).trim() : null;
    const tagsCsv: string | null =
      body?.tags != null
        ? (Array.isArray(body.tags) ? body.tags.join(',') : String(body.tags)).trim()
        : null;

    // COALESCE/CASE로 동적 업데이트 대체
    const rows = await sql`
      UPDATE faq_questions
      SET
        title = COALESCE(${title}, title),
        content = COALESCE(${content}, content),
        tags = CASE WHEN ${tagsCsv} IS NULL THEN tags ELSE string_to_array(${tagsCsv}, ',') END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, title, content, tags, uploader, created_at, updated_at
    `;
    const r = rows[0];
    if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 });

    return NextResponse.json({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: pgArrayToJs(r.tags),
      uploader: r.uploader,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  } catch (e) {
    console.error('FAQ 수정 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    await sql`DELETE FROM faq_questions WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('FAQ 삭제 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
