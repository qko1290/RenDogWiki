// =============================================
// File: app/wiki/lib/fetcher.ts
// =============================================
/**
 * 클라이언트 공통 fetch/토스트/확인 유틸
 * - apiFetch: ok 검사, JSON 자동 직렬화, 204 처리, 기본 no-store, timeout/abort 지원
 * - toast: success/error/info 간단 토스트
 * - confirmDialog: window.confirm 래핑(추후 커스텀 모달로 대체 가능)
 * 사용처: 클라이언트 컴포넌트 전용
 */
'use client';

export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  /** body가 일반 객체면 자동 JSON.stringify + Content-Type 설정 */
  body?: any;
  /** 기대 응답 형태(기본: json 시도 후 실패 시 text) */
  expected?: 'json' | 'text' | 'void';
  /** 밀리초 타임아웃 (지나면 Abort) */
  timeoutMs?: number;
  /** 에러 발생 시 토스트 노출 억제 */
  suppressErrorToast?: boolean;
};

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function isAbortError(e: unknown) {
  return e instanceof DOMException && e.name === 'AbortError';
}

/** 내부: JSON 파싱 시도(실패하면 text 반환) */
async function parseResponse(res: Response, expected?: ApiFetchOptions['expected']) {
  if (expected === 'void' || res.status === 204) return undefined;
  if (expected === 'text') return res.text();
  if (expected === 'json') return res.json();

  // expected 미지정: json 우선, 실패 시 text
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** API 호출 표준 함수 */
export async function apiFetch<T = any>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    body,
    expected,
    timeoutMs,
    suppressErrorToast,
    cache = 'no-store',
    headers: inHeaders,
    ...rest
  } = options;

  const headers = new Headers(inHeaders || {});
  const init: RequestInit = { ...rest, cache, headers };

  // 객체 body 자동 직렬화
  if (body !== undefined) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (isFormData) {
      init.body = body as FormData;
    } else if (typeof body === 'string' || body instanceof Blob || body instanceof ArrayBuffer) {
      init.body = body as BodyInit;
    } else {
      headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
      init.body = JSON.stringify(body);
    }
  }

  // timeout/abort
  let controller: AbortController | undefined;
  let timer: any;
  if (timeoutMs && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    init.signal = controller.signal;
    timer = setTimeout(() => controller?.abort(), timeoutMs);
  }

  try {
    const res = await fetch(url, init);
    const data = await parseResponse(res, expected);

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      if (!suppressErrorToast) toast.error(msg);
      throw new ApiError(msg, res.status, data);
    }
    return data as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ─────────────── 간단 토스트 ─────────────── */
type ToastKind = 'success' | 'error' | 'info';

function ensureToastRoot() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('rd-toast-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rd-toast-root';
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '9999',
      bottom: '18px',
      right: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none',
    } as CSSStyleDeclaration);
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message: string, kind: ToastKind = 'info', duration = 2200) {
  if (typeof document === 'undefined') return;
  const root = ensureToastRoot();
  if (!root) return;

  const colors = {
    success: { bg: '#10b981', fg: '#fff' },
    error: { bg: '#ef4444', fg: '#fff' },
    info: { bg: '#1f2937', fg: '#fff' },
  }[kind];

  const item = document.createElement('div');
  Object.assign(item.style, {
    background: colors.bg,
    color: colors.fg,
    padding: '10px 12px',
    borderRadius: '10px',
    boxShadow: '0 10px 30px rgba(0,0,0,.18)',
    fontSize: '14px',
    fontWeight: '600',
    maxWidth: '420px',
    pointerEvents: 'auto',
    transform: 'translateY(12px)',
    opacity: '0',
    transition: 'transform .18s ease, opacity .18s ease',
  } as CSSStyleDeclaration);
  item.textContent = message;
  root.appendChild(item);

  requestAnimationFrame(() => {
    item.style.transform = 'translateY(0)';
    item.style.opacity = '1';
  });

  setTimeout(() => {
    item.style.transform = 'translateY(12px)';
    item.style.opacity = '0';
    setTimeout(() => root.removeChild(item), 180);
  }, duration);
}

export const toast = {
  success: (m: string, ms?: number) => showToast(m, 'success', ms),
  error: (m: string, ms?: number) => showToast(m, 'error', ms),
  info: (m: string, ms?: number) => showToast(m, 'info', ms),
};

/* ─────────────── 확인 다이얼로그 ─────────────── */
export async function confirmDialog(message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(message));
}
