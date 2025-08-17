// =============================================
// File: app/components/common/ModePicker.tsx
// =============================================
'use client';

import { useEffect, useMemo, useState } from 'react';

type ModeDef = { label: string; tag: string };

type ModePickerProps = {
  /** 표시할 모드 목록. 미지정 시 기본(PVP/CREATIVE/SURVIVAL) */
  modes?: readonly ModeDef[];
  /** 제어 컴포넌트: 현재 선택된 모드(tag) 또는 null(전체) */
  value?: string | null;
  /** 비제어 초기값 */
  defaultValue?: string | null;
  /** 값 변경 콜백 */
  onChange?: (next: string | null) => void;
  /** localStorage key (동기화 사용). null로 주면 비활성화 */
  persistKey?: string | null;
  /** URL 쿼리 키 (동기화 사용). null로 주면 비활성화 */
  syncUrlParam?: string | null;
  /** 브로드캐스트 이벤트명. null로 주면 비활성화 */
  broadcastEvent?: string | null;
  /** 컨테이너 className */
  className?: string;
  /** 버튼 공통 className */
  chipClassName?: string;
  /** reset(전체) 버튼 표시 여부 */
  showReset?: boolean;
};

const DEFAULT_MODES: readonly ModeDef[] = [
  { label: 'PVP',      tag: 'pvp' },
  { label: 'CREATIVE', tag: 'creative' },
  { label: 'SURVIVAL', tag: 'survival' },
] as const;

/** 내부 유틸: 현재 환경의 url/localStorage에서 초기 모드 읽기 */
function getInitialMode(
  modes: readonly ModeDef[],
  persistKey: string | null,
  syncUrlParam: string | null,
  fallback: string | null,
): string | null {
  if (typeof window === 'undefined') return fallback;
  const byUrl = syncUrlParam ? new URLSearchParams(window.location.search).get(syncUrlParam) : null;
  const byStore = persistKey ? window.localStorage.getItem(persistKey) : null;
  const base = byUrl ?? byStore ?? fallback;
  return base && modes.some(m => m.tag === base) ? base : null;
}

export default function ModePicker({
  modes = DEFAULT_MODES,
  value,
  defaultValue = null,
  onChange,
  persistKey = 'wiki:mode',
  syncUrlParam = 'mode',
  broadcastEvent = 'wiki-mode-change',
  className,
  chipClassName,
  showReset = true,
}: ModePickerProps) {
  const isControlled = value !== undefined;
  const initial = useMemo(
    () => getInitialMode(modes, persistKey, syncUrlParam, defaultValue),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // 최초 1회만 평가(동기화 소스 읽기)
  );
  const [inner, setInner] = useState<string | null>(initial);
  const current = isControlled ? (value as string | null) : inner;

  const setMode = (next: string | null) => {
    if (!isControlled) setInner(next);
    onChange?.(next);

    if (typeof window !== 'undefined') {
      // URL 동기화
      if (syncUrlParam) {
        const url = new URL(window.location.href);
        if (next) url.searchParams.set(syncUrlParam, next);
        else url.searchParams.delete(syncUrlParam);
        window.history.replaceState({}, '', url);
      }
      // localStorage 동기화
      if (persistKey) {
        if (next) localStorage.setItem(persistKey, next);
        else localStorage.removeItem(persistKey);
      }
      // 브로드캐스트
      if (broadcastEvent) {
        window.dispatchEvent(new CustomEvent(broadcastEvent, { detail: { mode: next } }));
      }
    }
  };

  // URL이 외부 요인으로 바뀌었을 때 반영(뒤로가기 등)
  useEffect(() => {
    if (typeof window === 'undefined' || !syncUrlParam) return;
    const onPop = () => {
      const q = new URLSearchParams(window.location.search).get(syncUrlParam);
      const next = q && modes.some(m => m.tag === q) ? q : null;
      if (!isControlled) setInner(next);
      onChange?.(next);
      if (broadcastEvent) {
        window.dispatchEvent(new CustomEvent(broadcastEvent, { detail: { mode: next } }));
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, onChange, syncUrlParam, broadcastEvent]);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 12,
        marginRight: 12,
        flexShrink: 0,
      }}
      aria-label="모드 선택"
    >
      {modes.map((m) => {
        const active = current === m.tag;
        return (
          <button
            key={m.tag}
            type="button"
            onClick={() => setMode(active ? null : m.tag)}
            className={chipClassName}
            title={active ? `${m.label} 필터 해제` : `${m.label}만 보기`}
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              padding: '6px 10px',
              borderRadius: 999,
              border: active ? '1.5px solid #3b82f6' : '1px solid #e5e7eb',
              background: active ? '#eaf2ff' : '#fff',
              color: active ? '#1f2937' : '#374151',
              boxShadow: active ? '0 1px 4px rgba(59,130,246,0.25)' : 'none',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {m.label}
          </button>
        );
      })}
      {showReset && (
        <button
          type="button"
          onClick={() => setMode(null)}
          title="모드 필터 해제"
          style={{
            fontSize: 12,
            padding: '6px 8px',
            color: '#6b7280',
            border: '1px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            textDecoration: current ? 'underline' : 'none',
          }}
        >
          전체
        </button>
      )}
    </div>
  );
}
