// =============================================
// File: app/wiki/lib/db.ts
// =============================================
/**
 * Neon 서버리스(PostgreSQL) 연결 유틸리티
 * - @neondatabase/serverless 사용, Pool 불필요
 * - sql`SELECT ...` 형태로 쿼리
 */
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);
