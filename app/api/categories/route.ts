// =============================================
// File: app/api/categories/route.ts (PostgreSQL 버전)
// =============================================
/**
 * 카테고리 전체 리스트 조회 및 신규 카테고리 생성 API 엔드포인트
 * - GET: 모든 카테고리 트리를 조회
 *   → 위키/카테고리 관리 페이지에서 트리 및 목록 렌더링에 사용
 * - POST: 새 카테고리 생성
 *   → 카테고리 추가 버튼에서 호출, 생성된 id 반환
 */

import { db } from '@/wiki/lib/db'; // Postgres 쿼리 래퍼
import { NextRequest, NextResponse } from 'next/server';

/**
 * [카테고리 전체 조회]
 * - 위키(wiki/page), 카테고리 관리 페이지(manage/category/page)에서
 *   트리 구조/드롭다운/목록 렌더링에 사용
 * - parent_id, order 기준 정렬
 * - rows: 전체 카테고리 정보를 배열로 반환
 */
export async function GET() {
  // 동일한 parent_id를 가진 요소들을 order 순으로 정렬
  // Postgres는 "order" 컬럼이 예약어라 쌍따옴표 사용!
  const result = await db.query('SELECT * FROM categories ORDER BY parent_id, "order"');
  return NextResponse.json(result.rows); // 프론트는 이 배열로 트리 구조 가공
}

/**
 * [카테고리 신규 생성] POST
 * - "카테고리 추가" 버튼에서 호출
 * - name(카테고리명)은 필수
 * - parent_id: 하위 카테고리를 생성할 시 정수 값을 가짐, RenDogWiki(명시적 최상위 루트)에 생성할 시 null 값을 가짐
 * - order: 같은 parent 내 순서 (없으면 0)
 * - document_path, icon: 연결문서/아이콘 (선택)
 */
export async function POST(req: NextRequest) {
  // 프론트에서 전달된 정보를 파싱
  const { name, parent_id, order, document_path, icon } = await req.json();

  // name은 반드시 입력
  if (!name)
    return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // DB에 신규 카테고리 삽입, 누락 필드는 기본값 적용 (RETURNING id로 새 PK 반환)
  const result = await db.query(
    'INSERT INTO categories (name, parent_id, "order", document_path, icon) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [name, parent_id || null, order || 0, document_path || null, icon || null]
  );

  // 생성된 id 반환 → 프론트는 이 id를 근거로 트리 즉시 갱신
  return NextResponse.json({ id: result.rows[0].id });
}
