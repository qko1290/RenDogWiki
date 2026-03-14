// =============================================
// File: app/wiki/lib/db.ts
// (전체 코드)
// - postgres 드라이버 singleton 구성
// - Supabase Transaction Pooler 호환
// - 연결 불안정 시 pool 압박을 줄이기 위해 max=1 유지
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

    // pooler 압박 최소화
    max: 1,

    // 오래 물고 있지 않게
    connect_timeout: 8,

    // 유휴 연결 정리
    idle_timeout: 10,

    onnotice: () => {},
  }) as unknown as SQL;
}

export const sql: SQL = global.__wiki_sql__ ?? createSql();

// production에서도 같은 인스턴스 내 재사용 가능하도록 보관
global.__wiki_sql__ = sql;

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