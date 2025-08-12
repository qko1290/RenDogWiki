// =============================================
// File: app/api/image/folder/move/route.ts
// =============================================
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const idRaw = body?.id;
  const newParentRaw = body?.new_parent_id; // null | number

  const user = getAuthUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const id = Number(idRaw);
  const new_parent_id = newParentRaw === null || newParentRaw === undefined
    ? null
    : Number(newParentRaw);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: '올바른 id가 필요합니다' }, { status: 400 });
  }
  if (new_parent_id !== null && (!Number.isFinite(new_parent_id) || new_parent_id <= 0)) {
    return NextResponse.json({ error: '올바른 new_parent_id가 필요합니다' }, { status: 400 });
  }
  if (new_parent_id === id) {
    return NextResponse.json({ error: '자기 자신으로 이동할 수 없습니다' }, { status: 400 });
  }

  // 1) 이동 대상 폴더 존재 확인
  const rows = await sql`SELECT id, name, parent_id FROM image_folders WHERE id = ${id} LIMIT 1`;
  const folder = rows[0];
  if (!folder) return NextResponse.json({ error: '폴더 없음' }, { status: 404 });

  // 2) 새 부모가 존재하는지(루트 허용)
  if (new_parent_id !== null) {
    const parentRows = await sql`SELECT id FROM image_folders WHERE id = ${new_parent_id} LIMIT 1`;
    if (!parentRows[0]) return NextResponse.json({ error: '새 부모 폴더 없음' }, { status: 404 });
  }

  // 3) 순환 방지: 새 부모가 나의 하위면 안 됨
  if (new_parent_id !== null) {
    const cyc = await sql`
      WITH RECURSIVE sub AS (
        SELECT id FROM image_folders WHERE parent_id = ${id}
        UNION ALL
        SELECT f.id FROM image_folders f
        JOIN sub s ON f.parent_id = s.id
      )
      SELECT 1 AS x FROM sub WHERE id = ${new_parent_id} LIMIT 1
    `;
    if (cyc.length) {
      return NextResponse.json({ error: '하위 폴더로 이동할 수 없습니다' }, { status: 400 });
    }
  }

  // 4) 새 부모 아래에 동일 이름 존재하는지
  const dup = await sql`
    SELECT id FROM image_folders
    WHERE parent_id IS NOT DISTINCT FROM ${new_parent_id}
      AND name = ${folder.name}
      AND id <> ${id}
    LIMIT 1
  `;
  if (dup.length) {
    return NextResponse.json({ error: '동일 위치에 같은 이름의 폴더가 이미 있습니다' }, { status: 409 });
  }

  // 5) 이동
  await sql`UPDATE image_folders SET parent_id = ${new_parent_id} WHERE id = ${id}`;

  return NextResponse.json({ ok: true, folder: { id, new_parent_id } });
}
