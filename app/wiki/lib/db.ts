// =============================================
// File: app/wiki/lib/db.ts
// (전체 코드)
// - postgres 드라이버 singleton 구성
// - Supabase Transaction Pooler 호환
// - CONNECT_TIMEOUT 시 오래 물고 있지 않도록 timeout 단축
// =============================================

import postgres from 'postgres';

function getDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

const DB_URL = getDbUrl();

export type SQL = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __wiki_sql__: SQL | undefined;
}

function createSql(): SQL {
  return postgres(DB_URL, {
    prepare: false,
    ssl: 'require',
    max: 2,
    connect_timeout: 8,
    idle_timeout: 10,
    onnotice: () => {},
  }) as unknown as SQL;
}

export const sql: SQL = global.__wiki_sql__ ?? createSql();

if (process.env.NODE_ENV !== 'production') {
  global.__wiki_sql__ = sql;
}

/** 트랜잭션 유틸 */
export async function withTx<T>(fn: (tx: SQL) => Promise<T>): Promise<T> {
  return (sql as any).begin((tx: SQL) => fn(tx)) as Promise<T>;
}

/** 단일 행 유틸 */
export async function one<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T | null> {
  const rows = (await (sql as any)(strings, ...values)) as T[];
  return rows?.[0] ?? null;
}