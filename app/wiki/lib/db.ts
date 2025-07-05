// =============================================
// File: app/wiki/lib/db.ts
// =============================================
/**
 * PostgreSQL 데이터베이스 Pool 생성/연결 유틸리티
 * - 서버 전체에서 DB 쿼리 시 공통 사용
 * - Pool: 커넥션 풀 관리
 */

import { Pool } from 'pg';

// Pool 인스턴스 생성
//   - connectionString: .env의 DATABASE_URL 환경변수 사용
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
