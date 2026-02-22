// =============================================
// File: app/components/editor/PriceTableInsertModal.tsx  (전체 코드)
// =============================================
'use client';

/**
 * 시세표 카드 삽입 모달 (DB 자동완성/선택 기반)
 * - 한 줄 카드 개수(1~5) 선택
 * - 각 카드 슬롯에 이름 입력 → /api/prices/suggest 후보 → 선택 시 /api/prices/get로 자동 로드
 * - 삽입 시 payload로 cardsPerRow + items(선택된 데이터) 전달
 * - 키보드 지원: ↑↓로 후보 이동, Enter 선택, Esc 닫기
 * - debounce + AbortController로 과도한 fetch 방지
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ModalCard } from '@/components/common/Modal';

type SuggestItem = {
  id: number;
  name: string;
  name_key: string;
  mode: string;
  updated_at?: string;
  score?: number;
};

type PriceItem = {
  id: number;
  name: string;
  name_key: string;
  mode: string;
  prices: string[];
  updated_at?: string;
};

export type InsertedPriceItem = {
  // PriceTableCard에 들어갈 최소 데이터(서버에서 받아오는 raw 기준)
  id: number;
  name: string;
  name_key: string;
  mode: string;
  prices: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;

  // ✅ 변경: 이제 “빈 카드 삽입”이 아니라 “선택된 아이템들로 초기 카드 생성”으로 삽입
  onInsert: (payload: { cardsPerRow: number; items: InsertedPriceItem[] }) => void;
};

const MIN = 1;
const MAX = 5;

function clamp(n: number) {
  return Math.min(MAX, Math.max(MIN, n));
}

// name_key 쪽과 동일한 느낌으로만 최소 정규화(백엔드가 최종 처리)
function normalizeQuery(q: string) {
  return (q ?? '').replace(/\u200B/g, '').trim();
}

export default function PriceTableInsertModal({ open, onClose, onInsert }: Props) {
  const [count, setCount] = useState(3);

  // 슬롯: count만큼 유지
  type Slot = {
    input: string;
    selected: InsertedPriceItem | null;
    loading: boolean;
    error: string | null;
    suggestions: SuggestItem[];
    dropdownOpen: boolean;
    activeIndex: number; // suggestions highlight
  };

  const makeEmptySlot = (): Slot => ({
    input: '',
    selected: null,
    loading: false,
    error: null,
    suggestions: [],
    dropdownOpen: false,
    activeIndex: 0,
  });

  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: clamp(count) }, makeEmptySlot));

  // 모달 열릴 때 에디터 툴바 드롭다운 닫기 + 초기화
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));

    // open 시점에 슬롯을 count 기준으로 재정렬/초기화 (기존 입력은 유지하고 싶으면 여기 로직 바꾸면 됨)
    setSlots((prev) => {
      const c = clamp(count);
      const next = prev.slice(0, c);
      while (next.length < c) next.push(makeEmptySlot());
      return next;
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // count 변경 시 슬롯 배열 길이 동기화
  useEffect(() => {
    const c = clamp(count);
    setSlots((prev) => {
      const next = prev.slice(0, c);
      while (next.length < c) next.push(makeEmptySlot());
      return next;
    });
  }, [count]);

  // 캐시 (모달 내에서만)
  const suggestCacheRef = useRef<Map<string, SuggestItem[]>>(new Map());
  const itemCacheRef = useRef<Map<number, InsertedPriceItem>>(new Map());

  // 슬롯별 AbortController 관리
  const abortRef = useRef<Map<number, AbortController>>(new Map());

  const updateSlot = useCallback((idx: number, patch: Partial<Slot>) => {
    setSlots((prev) => {
      if (!prev[idx]) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const clearSlotSelection = useCallback((idx: number) => {
    updateSlot(idx, {
      selected: null,
      error: null,
    });
  }, [updateSlot]);

  // suggest fetch (debounced per slot)
  useEffect(() => {
    if (!open) return;

    const timers: number[] = [];

    slots.forEach((slot, idx) => {
      const q = normalizeQuery(slot.input);

      // 선택된 상태에서 input이 완전히 동일하면 굳이 suggest 안열기
      // (원하면 선택 이후에도 다시 검색 가능하게 이 조건 완화 가능)
      if (slot.selected && q === slot.selected.name) {
        return;
      }

      if (q.length < 1) {
        // 입력 없으면 드롭다운 정리
        if (slot.suggestions.length || slot.dropdownOpen) {
          updateSlot(idx, { suggestions: [], dropdownOpen: false, activeIndex: 0, error: null });
        }
        return;
      }

      // debounce 180ms
      const t = window.setTimeout(async () => {
        const cacheKey = q.toLowerCase();
        if (suggestCacheRef.current.has(cacheKey)) {
          const cached = suggestCacheRef.current.get(cacheKey)!;
          updateSlot(idx, {
            suggestions: cached,
            dropdownOpen: true,
            activeIndex: 0,
            error: null,
          });
          return;
        }

        // 이전 요청 취소
        const prevAbort = abortRef.current.get(idx);
        if (prevAbort) prevAbort.abort();
        const ac = new AbortController();
        abortRef.current.set(idx, ac);

        try {
          // mode 필터를 원하면 query에 추가 가능: &mode=...
          const res = await fetch(`/api/prices/suggest?q=${encodeURIComponent(q)}&limit=10`, {
            method: 'GET',
            signal: ac.signal,
            cache: 'no-store',
          });

          if (!res.ok) throw new Error(`suggest failed: ${res.status}`);

          const data = await res.json();
          const items = Array.isArray(data?.items) ? (data.items as SuggestItem[]) : [];

          suggestCacheRef.current.set(cacheKey, items);

          updateSlot(idx, {
            suggestions: items,
            dropdownOpen: true,
            activeIndex: 0,
            error: null,
          });
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          updateSlot(idx, { error: '검색 실패', suggestions: [], dropdownOpen: false, activeIndex: 0 });
        }
      }, 180);

      timers.push(t);
    });

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      // 슬롯 abort는 남겨도 되지만, 정리하는게 안전
      abortRef.current.forEach((ac) => ac.abort());
      abortRef.current.clear();
    };
  }, [open, slots, updateSlot]);

  // 후보 선택 시 상세 로드
  const selectSuggestion = useCallback(async (slotIdx: number, s: SuggestItem) => {
    // 캐시 히트
    if (itemCacheRef.current.has(s.id)) {
      const cached = itemCacheRef.current.get(s.id)!;
      updateSlot(slotIdx, {
        selected: cached,
        input: cached.name, // input을 name으로 덮어씀
        dropdownOpen: false,
        suggestions: [],
        activeIndex: 0,
        error: null,
      });
      return;
    }

    // fetch
    updateSlot(slotIdx, { loading: true, error: null });

    try {
      const res = await fetch(`/api/prices/get?id=${encodeURIComponent(String(s.id))}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`get failed: ${res.status}`);

      const data = await res.json();
      const item = data?.item as PriceItem | undefined;
      if (!item || !item.id) throw new Error('invalid payload');

      const inserted: InsertedPriceItem = {
        id: item.id,
        name: item.name,
        name_key: item.name_key,
        mode: item.mode,
        prices: Array.isArray(item.prices) ? item.prices : [],
      };

      itemCacheRef.current.set(inserted.id, inserted);

      updateSlot(slotIdx, {
        selected: inserted,
        input: inserted.name,
        loading: false,
        dropdownOpen: false,
        suggestions: [],
        activeIndex: 0,
        error: null,
      });
    } catch (e) {
      updateSlot(slotIdx, {
        loading: false,
        error: '불러오기 실패',
        dropdownOpen: false,
      });
    }
  }, [updateSlot]);

  const handleInsert = useCallback(() => {
    const cardsPerRow = clamp(count);

    // 선택된 것만 넣음 (빈 슬롯 허용)
    const items: InsertedPriceItem[] = slots
      .map((s) => s.selected)
      .filter((x): x is InsertedPriceItem => !!x);

    onInsert({ cardsPerRow, items });
  }, [count, slots, onInsert]);

  // 키보드: 모달 전체 단축키 (Enter로 삽입은 input 포커스 상황 때문에 slot단에서 처리)
  const onModalKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // 슬롯별 input keydown: ↑↓ 엔터로 선택
  const onSlotKeyDown = (slotIdx: number): React.KeyboardEventHandler<HTMLInputElement> => {
    return (e) => {
      const slot = slots[slotIdx];
      if (!slot) return;

      if (e.key === 'ArrowDown') {
        if (!slot.dropdownOpen || slot.suggestions.length === 0) return;
        e.preventDefault();
        updateSlot(slotIdx, {
          activeIndex: (slot.activeIndex + 1) % slot.suggestions.length,
        });
      } else if (e.key === 'ArrowUp') {
        if (!slot.dropdownOpen || slot.suggestions.length === 0) return;
        e.preventDefault();
        updateSlot(slotIdx, {
          activeIndex:
            (slot.activeIndex - 1 + slot.suggestions.length) % slot.suggestions.length,
        });
      } else if (e.key === 'Enter') {
        // 후보 열려있으면 선택, 아니면 삽입
        e.preventDefault();
        if (slot.dropdownOpen && slot.suggestions.length > 0) {
          const pick = slot.suggestions[Math.max(0, Math.min(slot.activeIndex, slot.suggestions.length - 1))];
          if (pick) selectSuggestion(slotIdx, pick);
        } else {
          handleInsert();
        }
      } else if (e.key === 'Escape') {
        if (slot.dropdownOpen) {
          e.preventDefault();
          updateSlot(slotIdx, { dropdownOpen: false });
        }
      }
    };
  };

  const allSelectedCount = useMemo(
    () => slots.filter((s) => !!s.selected).length,
    [slots]
  );

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="시세표 카드 삽입"
      width={560}
      actions={
        <>
          <button className="rd-btn secondary" onClick={onClose}>
            취소
          </button>
          <button className="rd-btn primary" onClick={handleInsert}>
            삽입
          </button>
        </>
      }
    >
      <div onKeyDown={onModalKeyDown}>
        {/* 1) 카드 개수 */}
        <div style={{ fontSize: 15, color: '#475569', marginBottom: 10 }}>
          한 줄에 표시할 카드 개수를 선택하고, 각 카드에 들어갈 아이템을 검색해서 선택하세요.
        </div>

        <div
          role="group"
          aria-label="카드 개수 선택"
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              className="rd-btn"
              onClick={() => setCount(v)}
              aria-pressed={count === v}
              style={{
                minWidth: 56,
                height: 36,
                borderRadius: 10,
                background: count === v ? '#2563eb' : '#f3f4f6',
                color: count === v ? '#fff' : '#475569',
                fontWeight: 800,
              }}
            >
              {v}개
            </button>
          ))}
        </div>

        {/* 2) 슬롯 검색/선택 */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 12,
            background: '#fff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              아이템 선택 ({allSelectedCount}/{clamp(count)})
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              ↑↓ 이동 / Enter 선택 / Esc 닫기
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slots.map((slot, idx) => {
              const selected = slot.selected;

              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 10,
                    position: 'relative',
                    background: selected ? '#f8fafc' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: '#0f172a',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 13,
                        flex: '0 0 auto',
                      }}
                      aria-hidden
                    >
                      {idx + 1}
                    </div>

                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <input
                        value={slot.input}
                        onChange={(e) => {
                          const v = e.target.value;

                          // 입력이 바뀌면 선택 해제(“로컬 입력”을 없애고 반드시 검색/선택 흐름으로 만들기)
                          updateSlot(idx, {
                            input: v,
                            selected: null,
                            error: null,
                            dropdownOpen: true,
                          });
                        }}
                        onFocus={() => {
                          if (slot.suggestions.length > 0) updateSlot(idx, { dropdownOpen: true });
                        }}
                        onKeyDown={onSlotKeyDown(idx)}
                        placeholder="아이템 이름 입력 (자동완성)"
                        style={{
                          width: '100%',
                          height: 38,
                          borderRadius: 10,
                          border: '1px solid #d1d5db',
                          padding: '0 12px',
                          outline: 'none',
                          fontSize: 14,
                          fontWeight: 650,
                          color: '#0f172a',
                        }}
                      />

                      <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
                        {slot.loading ? (
                          <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 700 }}>
                            불러오는 중...
                          </span>
                        ) : slot.error ? (
                          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                            {slot.error}
                          </span>
                        ) : selected ? (
                          <span style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                            mode: <span style={{ color: '#0f172a' }}>{selected.mode}</span> / prices:{' '}
                            <span style={{ color: '#0f172a' }}>{selected.prices?.length ?? 0}</span>개
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            후보에서 선택하면 자동으로 시세가 채워집니다.
                          </span>
                        )}

                        {selected && (
                          <button
                            type="button"
                            className="rd-btn"
                            onClick={() => clearSlotSelection(idx)}
                            style={{
                              height: 26,
                              padding: '0 10px',
                              borderRadius: 999,
                              background: '#ffffff',
                              border: '1px solid #e5e7eb',
                              fontSize: 12,
                              fontWeight: 800,
                              color: '#ef4444',
                            }}
                          >
                            선택 해제
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 드롭다운 */}
                  {slot.dropdownOpen && slot.suggestions.length > 0 && (
                    <div
                      role="listbox"
                      style={{
                        position: 'absolute',
                        left: 46,
                        right: 10,
                        top: 54,
                        zIndex: 50,
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        boxShadow: '0 18px 40px rgba(15,23,42,0.10)',
                        overflow: 'hidden',
                      }}
                    >
                      {slot.suggestions.slice(0, 10).map((s, j) => {
                        const active = j === slot.activeIndex;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => updateSlot(idx, { activeIndex: j })}
                            onClick={() => selectSuggestion(idx, s)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 12px',
                              background: active ? '#eff6ff' : '#fff',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 850,
                                  color: '#0f172a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {s.name}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 650 }}>
                                {s.mode} · {s.name_key}
                              </div>
                            </div>

                            <div style={{ flex: '0 0 auto', fontSize: 12, color: '#94a3b8', fontWeight: 800 }}>
                              #{s.id}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
          • 빈 슬롯은 그대로 두고 삽입할 수 있어요. (나중에 카드에서 다시 검색/변경 가능)
        </div>
      </div>
    </ModalCard>
  );
}