// app/api/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeContent(v: unknown): any {
  if (v == null) return [];
  if (typeof v === 'string') {
    try { const parsed = JSON.parse(v); return parsed ?? []; } catch { return []; }
  }
  return v;
}
function normalizeTags(v: unknown): string[] {
  if (Array.isArray(v)) return Array.from(new Set(v.map(s => typeof s === 'string' ? s.trim() : '').filter(Boolean)));
  if (typeof v === 'string') return Array.from(new Set(v.split(',').map(s => s.trim()).filter(Boolean)));
  return [];
}

export async function POST(req: NextRequest) {
  const getColInfo = async (table: string, column: string) => {
    const rows = (await sql`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${table} AND column_name=${column}
      LIMIT 1
    `) as unknown as Array<{ data_type?: string; udt_name?: string }>;
    const r = rows?.[0] || {};
    return {
      isArray: r.data_type === 'ARRAY' || (r.udt_name || '').startsWith('_'),
      isJsonOrJsonb: r.data_type === 'json' || r.data_type === 'jsonb' || r.udt_name === 'json' || r.udt_name === 'jsonb',
      isJsonb: r.data_type === 'jsonb' || r.udt_name === 'jsonb',
    };
  };

  try {
    const body = await req.json().catch(() => ({} as any));
    const idRaw = body?.id;
    const idNum: number | null = idRaw === null || idRaw === undefined ? null : Number(idRaw);

    const titleRaw = typeof body?.title === 'string' ? body.title : '';
    const title = titleRaw.trim();

    const hasPath = Object.prototype.hasOwnProperty.call(body, 'path');
    const pathVal = body?.path;

    // ⚠️ path=0(숫자)도 허용하도록 체크 수정
    const pathMissing = !hasPath || pathVal === null || pathVal === undefined || String(pathVal) === '';
    if (pathMissing || !title) {
      return NextResponse.json({ error: 'path와 title은 필수입니다.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const icon = typeof body?.icon === 'string' ? body.icon : '';
    const contentNorm = normalizeContent(body?.content);
    const contentJson = JSON.stringify(contentNorm);
    const tagsArr = normalizeTags(body?.tags);
    const tagsCsv = tagsArr.join(',');

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    const tagsCol = await getColInfo('documents', 'tags');
    const contentCol = await getColInfo('document_contents', 'content');

    let documentId: number;
    let created = false;

    // 신규 생성
    if (!Number.isFinite(idNum as number)) {
      const dup = await sql/*sql*/`
        SELECT id FROM documents WHERE path = ${pathVal} AND title = ${title} LIMIT 1
      `;
      if (Array.isArray(dup) && dup.length > 0) {
        return NextResponse.json(
          { error: '같은 카테고리(경로)에 동일한 제목의 문서가 존재합니다.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // 같은 path에서 다음 order
      const maxRow = await sql/*sql*/`
        SELECT COALESCE(MAX("order"), -1) + 1 AS next
        FROM documents
        WHERE path = ${pathVal}
      `;
      const nextOrder = Number(maxRow[0]?.next ?? 0);

      const inserted = tagsCol.isArray
        ? await sql/*sql*/`
            INSERT INTO documents (title, path, icon, tags, "order")
            VALUES (${title}, ${pathVal}, ${icon}, ${tagsArr as unknown as string[]}::text[], ${nextOrder})
            RETURNING id
          `
        : await sql/*sql*/`
            INSERT INTO documents (title, path, icon, tags, "order")
            VALUES (${title}, ${pathVal}, ${icon}, ${tagsCsv}, ${nextOrder})
            RETURNING id
          `;
      documentId = Number(inserted[0].id);

      if (contentCol.isJsonOrJsonb) {
        await sql/*sql*/`
          INSERT INTO document_contents (document_id, content)
          VALUES (${documentId}, ${contentJson}${contentCol.isJsonb ? sql`::jsonb` : sql`::json`})
        `;
      } else {
        await sql/*sql*/`
          INSERT INTO document_contents (document_id, content)
          VALUES (${documentId}, ${contentJson})
        `;
      }

      created = true;
    }
    // 수정
    else {
      documentId = Number(idNum);

      const conflict = await sql/*sql*/`
        SELECT 1 FROM documents
        WHERE path = ${pathVal} AND title = ${title} AND id <> ${documentId}
        LIMIT 1
      `;
      if (Array.isArray(conflict) && conflict.length > 0) {
        return NextResponse.json(
          { error: '같은 카테고리(경로)에 동일한 제목의 문서가 존재합니다.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (tagsCol.isArray) {
        await sql/*sql*/`
          UPDATE documents SET
            title = ${title},
            path = ${pathVal},
            icon = ${icon},
            tags = ${tagsArr as unknown as string[]}::text[],
            updated_at = NOW()
          WHERE id = ${documentId}
        `;
      } else {
        await sql/*sql*/`
          UPDATE documents SET
            title = ${title},
            path = ${pathVal},
            icon = ${icon},
            tags = ${tagsCsv},
            updated_at = NOW()
          WHERE id = ${documentId}
        `;
      }

      const exists = await sql/*sql*/`
        SELECT 1 FROM document_contents WHERE document_id = ${documentId} LIMIT 1
      `;
      if (Array.isArray(exists) && exists.length > 0) {
        if (contentCol.isJsonOrJsonb) {
          await sql/*sql*/`
            UPDATE document_contents
            SET content = ${contentJson}${contentCol.isJsonb ? sql`::jsonb` : sql`::json`}
            WHERE document_id = ${documentId}
          `;
        } else {
          await sql/*sql*/`
            UPDATE document_contents
            SET content = ${contentJson}
            WHERE document_id = ${documentId}
          `;
        }
      } else {
        if (contentCol.isJsonOrJsonb) {
          await sql/*sql*/`
            INSERT INTO document_contents (document_id, content)
            VALUES (${documentId}, ${contentJson}${contentCol.isJsonb ? sql`::jsonb` : sql`::json`})
          `;
        } else {
          await sql/*sql*/`
            INSERT INTO document_contents (document_id, content)
            VALUES (${documentId}, ${contentJson})
          `;
        }
      }
    }

    const categoryLabel = await resolveCategoryName(
      Number.isFinite(Number(pathVal)) ? Number(pathVal) : null
    );

    await logActivity({
      action: created ? 'document.create' : 'document.update',
      username,
      targetType: 'document',
      targetId: documentId,
      targetName: title,
      targetPath: categoryLabel,
      meta: { tags: tagsArr, icon, created },
    });

    return NextResponse.json(
      { success: true, id: documentId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[문서 저장 API] 서버 내부 에러:', err);
    return NextResponse.json(
      { error: '서버 내부 에러', details: String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
