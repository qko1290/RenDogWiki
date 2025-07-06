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

import { db } from '@/wiki/lib/db'; // DB
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
  const { name, parent_id, order, document_path, icon } = await req.json();
  const { id } = params; // URL에서 id 추출

  // 유효성 검사 name(이름) 필수, 빈값/공백 X
  if (!name || name.trim() === '') {
    // 빈 문자열도 허용하지 않음
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // 필드 업데이트
  // - 없는 값(null/0 등)은 SQL에서 null/0 처리
  // - parent_id, document_path, icon은 없으면 null
  // - order는 없으면 0으로 강제 (최상위 루트에서 0으로 고정)
  const parentIdFixed =
    parent_id === undefined || parent_id === '' || parent_id === null || parent_id === 0
      ? null
      : Number(parent_id);
  const orderFixed =
    order === undefined || order === '' || order === null ? 0 : Number(order);

  await db.query(
    'UPDATE categories SET name = $1, parent_id = $2, "order" = $3, document_id = $4, icon = $5 WHERE id = $6',
    [
      name,
      parentIdFixed,
      orderFixed,
      document_path || null,
      icon || null,
      id,
    ]
  );

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
  // 단일 카테고리 삭제
  await db.query('DELETE FROM categories WHERE id = $1', [id]);
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
  await db.query('UPDATE categories SET "order" = $1 WHERE id = $2', [order, id]);
  return NextResponse.json({ message: 'order updated' });
}
