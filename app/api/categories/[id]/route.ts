// =============================================
// File: app/api/categories/[id]/route.ts
// =============================================
/**
 * 단일 카테고리의 정보 수정, 삭제, 순서(정렬) 변경을 담당하는 API 라우트
 * - [PUT] 카테고리 정보 수정 (이름, 상위 카테고리, 순서, 대표문서, 아이콘)
 * - [DELETE] 카테고리 삭제 (하위 카테고리 연쇄삭제는 아직 미구현이에요)
 * - [POST] 카테고리 순서 변경 (드래그 앤 드롭 시 order 갱신)
 * - id는 카테고리의 고유번호
 */

import { sql } from '@/wiki/lib/db'; // DB (neon 방식)
import { NextRequest, NextResponse } from 'next/server'; // Next.js API 타입

/**
 * [카테고리 정보 수정] PUT
 * - name은 반드시 입력
 * - parent_id(상위 카테고리), order(순서), document_path(대표문서 경로), icon(아이콘)은 선택(없으면 null/0)
 * - id는 URL 파라미터에서 추출 (카테고리 고유번호)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 입력값 파싱
  const { name, parent_id, order, document_id, icon } = await req.json();
  const { id } = params; // URL에서 id 추출

  // 유효성 검사 name(이름) 필수, 빈값/공백 X
  if (!name || name.trim() === '') {
    // 빈 문자열도 허용하지 않음
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const parentIdFixed =
    parent_id === undefined || parent_id === '' || parent_id === null || parent_id === 0
      ? null
      : Number(parent_id);
  const orderFixed =
    order === undefined || order === '' || order === null ? 0 : Number(order);

  // 필드 업데이트
  await sql`
    UPDATE categories SET
      name = ${name},
      parent_id = ${parentIdFixed},
      "order" = ${orderFixed},
      document_id = ${document_id === undefined || document_id === null || document_id === '' ? null : Number(document_id)},
      icon = ${icon || null}
    WHERE id = ${Number(id)}
  `;

  if (document_id) {
    // 1) 이 카테고리의 기존 대표문서 전부 false
    await sql`
      UPDATE documents
      SET is_featured = false
      WHERE id IN (SELECT document_id::integer FROM categories WHERE id = ${Number(id)})
    `;
    // 2) 새로 지정된 문서만 true
    await sql`
      UPDATE documents SET is_featured = true WHERE id = ${Number(document_id)}
    `;
  }

  // 성공 응답
  return NextResponse.json({ message: 'updated' });
}

/**
 * [카테고리 삭제] DELETE
 * - 카테고리 관리 페이지에서 "삭제" 버튼 클릭 시 호출
 * - id(카테고리 고유번호)는 URL 파라미터로 전달됨
 * - 하위 카테고리 연쇄 삭제 로직은 아직 구현되지 않았어요
 * - 현재는 단일 카테고리만 바로 삭제
 */
export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  // 1. 재귀적으로 모든 하위 카테고리 id 조회
  const subCatResult = await sql`
    WITH RECURSIVE subcategories AS (
      SELECT id FROM categories WHERE id = ${id}
      UNION ALL
      SELECT c.id FROM categories c
        INNER JOIN subcategories sc ON c.parent_id = sc.id
    )
    SELECT id FROM subcategories
  `;
  const catIds = subCatResult.map((r: any) => r.id);

  if (catIds.length === 0) {
    return NextResponse.json({ message: 'not found' }, { status: 404 });
  }

  // 2. 해당 카테고리 id에 속한 문서 id 전부 조회
  const docResult = await sql`
    SELECT id FROM documents WHERE path = ANY(${catIds})
  `;
  const docIds = docResult.map((r: any) => r.id);

  // 3. 문서 본문 삭제 －＞ 문서 삭제 (존재할 때만)
  if (docIds.length > 0) {
    await sql`
      DELETE FROM document_contents WHERE document_id = ANY(${docIds})
    `;
    await sql`
      DELETE FROM documents WHERE id = ANY(${docIds})
    `;
  }

  // 4. 카테고리 삭제 (루트 포함 모든 하위)
  await sql`
    DELETE FROM categories WHERE id = ANY(${catIds})
  `;

  return NextResponse.json({ message: 'deleted' });
}

/**
 * [순서 변경(정렬)] POST
 * - 카테고리 관리 트리에서 드래그 앤 드롭 시 order 변경에 사용
 * - order 값만 변경
 * - 클라이언트가 드롭 후 계산한 순서를 그대로 전달함
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { order } = await req.json();
  const { id } = params;

  // DB에서 order(순서)만 업데이트
  await sql`
    UPDATE categories SET "order" = ${order} WHERE id = ${id}
  `;
  return NextResponse.json({ message: 'order updated' });
}
