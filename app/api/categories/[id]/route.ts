// =============================================
// File: app/api/categories/[id]/route.ts
// =============================================
/**
 * 이 파일은 단일 카테고리의 정보 수정, 삭제, 순서(정렬) 변경을 담당하는 API 라우트입니다
 * - 카테고리 수정/삭제는 카테고리 관리 페이지의 관리 UI에서 호출됩니다
 * - 정렬 변경은 페이지 좌측의 카테고리 목록을 드래그 앤 드롭하는 동작에서 호출됩니다
 */

import { db } from '@/wiki/lib/db'; // MariaDB 쿼리 유틸
import { NextRequest, NextResponse } from 'next/server';

/**
 * [카테고리 정보 수정] PUT
 * - 프론트엔드 카테고리 관리 화면에서, 카테고리 정보 편집 시 호출
 * - name은 필수 요소입니다 (빠질 시 에러)
 * - parent_id, order, document_path, icon은 선택적이나, 전달이 없으면 기본값 적용(null)
 * - id는 카테고리의 고유 번호입니다 (트리 렌더링에 사용)
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 클라이언트에서 전달한 데이터 파싱
  const { name, parent_id, order, document_path, icon } = await req.json();
  const { id } = params; // URL에서 id 추출(카테고리 고유번호)

  // name은 빈 문자열 허용 X
  if (!name || name.trim() === '') {
    // 빈 문자열이면 console에 400을 반환하니 오류 시 확인해주세요요
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // 전달 받은 값으로 모든 필드 업데이트함 (없거나 빈값이면 null로 통일)
  await db.query(
    'UPDATE categories SET name = ?, parent_id = ?, `order` = ?, document_path = ?, icon = ? WHERE id = ?',
    [name, parent_id || null, order || 0, document_path || null, icon || null, id]
  );

  // 프론트엔드는 이 메시지를 근거로 수정 완료 UI 갱신
  return NextResponse.json({ message: 'updated' });
}

/**
 * [카테고리 삭제] DELETE
 * - 프론트엔드 카테고리 관리 화면에서 "삭제" 버튼 클릭 시 호출
 * - id(카테고리 고유번호)는 URL 파라미터로 전달됨
 * - 하위 카테고리 존재시 동작(연쇄 삭제 or 제한)은 아직 구현되지 않음음
 */
export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  await db.query('DELETE FROM categories WHERE id = ?', [id]);
  return NextResponse.json({ message: 'deleted' });
}

/**
 * [순서 변경(정렬)] POST
 * - 프론트의 드래그 앤 드롭 동작을 감지지하면 호출
 * - order만 단독으로 수정(다른 필드는 그대로에요)
 * - 클라이언트는 드롭된 순서를 계산하여 order 전달
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { order } = await req.json();
  const { id } = params;

  // DB에서 order(순서)만 업데이트
  await db.query('UPDATE categories SET `order` = ? WHERE id = ?', [order, id]);
  return NextResponse.json({ message: 'order updated' });
}
