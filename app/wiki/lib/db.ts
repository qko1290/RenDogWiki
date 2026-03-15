// =============================================
// File: app/wiki/lib/db.ts
// (전체 코드)
// - postgres 드라이버 singleton 구성
// - Supabase Transaction Pooler(6543) 호환
// - serverless 환경에서는 max=1로 보수 운영
// - CONNECT_TIMEOUT 계열 읽기 쿼리 1회 재시도 유틸 제공
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isDbConnectTimeoutError(err: unknown) {
  const e = err as any;
  const msg = String(e?.message ?? '');
  return (
    e?.code === 'CONNECT_TIMEOUT' ||
    e?.errno === 'CONNECT_TIMEOUT' ||
    msg.includes('CONNECT_TIMEOUT')
  );
}

function createSql(): SQL {
  return postgres(DB_URL, {
    prepare: false,
    ssl: 'require',

    // Supabase transaction pooler + serverless 조합에서는 과한 병렬 연결보다
    // "같은 인스턴스에서 1개 연결 재사용"이 더 안정적이다.
    max: 1,

    // 장애 시 너무 오래 매달리지 않게 조기 실패
    connect_timeout: 5,

    // 유휴 연결은 짧게 정리
    idle_timeout: 10,

    onnotice: () => {},
  }) as unknown as SQL;
}

export const sql: SQL = global.__wiki_sql__ ?? createSql();

// production에서도 같은 인스턴스 내 재사용
global.__wiki_sql__ = sql;

export async function runDbRead<T>(
  label: string,
  fn: () => Promise<T>,
  options: {
    retries?: number;
    retryDelayMs?: number;
  } = {}
): Promise<T> {
  const retries = options.retries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 150;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const canRetry = isDbConnectTimeoutError(err) && attempt < retries;
      if (!canRetry) {
        throw err;
      }

      console.warn(
        `[db] ${label} failed with CONNECT_TIMEOUT, retrying (${attempt + 1}/${retries})`
      );
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError;
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
  const rows = await runDbRead('one()', async () => {
    return ((await (sql as any)(strings, ...values)) as T[]) ?? [];
  });

  return rows?.[0] ?? null;
}