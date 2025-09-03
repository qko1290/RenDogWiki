// =============================================
// File: app/wiki/lib/db.ts  (전체 코드)
// =============================================
/**
 * Supabase(Postgres) 유틸
 * - 'postgres' 드라이버 사용 (pgBouncer/Transaction Pooler 호환)
 * - 템플릿 태그 그대로 사용:  await sql`SELECT * FROM npc WHERE id = ${id}`
 * - 트랜잭션:               await withTx(async (tx) => { await tx`...`; })
 * - 중요: Pooler는 PREPARE 미지원 → prepare:false 필수
 */

import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL is not set');

export type SQL = ReturnType<typeof postgres>;

/**
 * Supabase Transaction Pooler(6543)와 호환되는 옵션
 * - prepare:false  : PREPARE 미지원(Pooler) 환경 필수
 * - ssl:'require'  : DSN의 sslmode=require와 중복되어도 무방
 * - max:1          : 서버리스에서 최소 연결
 */
export const sql: SQL = postgres(DB_URL, {
  prepare: false,
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 30,
}) as unknown as SQL;

/** 트랜잭션 유틸 */
export async function withTx<T>(fn: (tx: SQL) => Promise<T>): Promise<T> {
  // postgres의 begin 타입이 콜백 반환을 배열로 추론하는 이슈가 있어
  // 최종 반환을 명시적으로 캐스팅하여 타입 오류를 억제한다.
  return (sql as any).begin((tx: SQL) => fn(tx)) as Promise<T>;
}

/** 단일 행 유틸(선택) */
export async function one<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T | null> {
  const rows = (await (sql as any)(strings, ...values)) as T[];
  return rows?.[0] ?? null;
}
