// =============================================
// File: app/api/categories/route.ts
// =============================================
/**
 * 카테고리 전체 리스트 조회 및 신규 카테고리 생성 API
 * - [GET] 전체 카테고리 목록 조회(트리, 목록, 드롭다운 등에 사용)
 * - [POST] 신규 카테고리 생성(카테고리 추가 버튼)
 * - Postgres DB 사용, categories 테이블 관리
 * - parent_id, order, document_path, icon 등 트리/디자인 관리 필드
 * - order는 Postgres 예약어이므로 쌍따옴표 필수
 */

import { db } from '@/wiki/lib/db'; // DB
import { NextRequest, NextResponse } from 'next/server';

/**
 * [카테고리 전체 조회] GET
 * - 모든 카테고리 row 반환(parent_id, order 순 정렬)
 * - wiki 페이지/카테고리 관리 페이지 트리/목록/드롭다운 등에서 사용
 * - order: 같은 parent_id 를 가진 카테고리 끼리 정렬하는 기준
 * - parent_id: 트리 계층 구조(null로 설정할 시 루트로 연결됨)
 * - order는 예약어라 반드시 "order" 쌍따옴표 사용
 */
export async function GET() {
  // 전체 row parent_id, order 기준 정렬
  const result = await db.query(
    'SELECT * FROM categories ORDER BY parent_id, "order"'
  );
  // 프론트에 배열로 반환
  return NextResponse.json(result.rows);
}

/**
 * [카테고리 신규 생성] POST
 * - 프론트 카테고리 관리 페이지의 "카테고리 추가" 버튼에서 호출
 * - parent_id: 소속 카테고리 번호  
 * - order: 같은 parent 내에서의 표시 순서(없으면 0)
 * - document_path: 대표 문서 경로 (카테고리 클릭 시 로드되는 문서의 경로)
 * - icon: 카테고리 아이콘
 * - 반환: 새로 생성된 카테고리 id
 */
export async function POST(req: NextRequest) {
  // 1. 입력값 파싱
  const { name, parent_id, order, document_id, icon } = await req.json();

  // 2. 필수값(name) 체크
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // 3. 신규 카테고리 INSERT
  // parent_id, order, document_path, icon은 선택값(없으면 null/0)
  // Postgres "order" 예약어 주의
  // RETURNING id로 신규 PK 반환
  const parentIdFixed =
    parent_id === undefined || parent_id === '' || parent_id === null
      ? null
      : Number(parent_id);
  const orderFixed =
    order === undefined || order === '' || order === null ? 0 : Number(order);

  const result = await db.query(
    'INSERT INTO categories (name, parent_id, "order", document_id, icon) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [name, parentIdFixed, orderFixed, document_id || null, icon || null]
  );

  // 4. 생성된 id 반환
  return NextResponse.json({ id: result.rows[0].id });
}
