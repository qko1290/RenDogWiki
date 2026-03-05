'use client';

import React, { useEffect, useMemo, useState } from 'react';

// WikiPageInner에서도 쓰는 트리 빌더(파일은 "수정 금지"지만 import는 OK)
import { buildCategoryTree } from '@/wiki/lib/buildCategoryTree';

type CategoryNode = {
  id: number;
  name: string;
  parent_id?: number | null;
  children?: CategoryNode[];
};

type DocumentRow = {
  id: number;
  title: string;
  path: string | number; // 카테고리 id(루트는 0)
};

type BootstrapResponse = {
  categories: any[];
  documents: any[];
  featured?: any;
};

type RangeKey = 'total' | 'day' | 'week';

function withTs(url: string) {
  return url + (url.includes('?') ? '&' : '?') + '_ts=' + Date.now();
}

function pathToStr(path: number[]) {
  return path.join('/');
}

export default function ViewsReportClient() {
  const [range, setRange] = useState<RangeKey>('week'); // ✅ 기본: 인기순(주간)
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [categoryNameById, setCategoryNameById] = useState<Record<number, string>>({});
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});

  const [viewsMap, setViewsMap] = useState<Map<number, number>>(new Map());

  // 1) bootstrap 로드 (문서/카테고리)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const r = await fetch(withTs('/api/bootstrap'), { cache: 'no-store' });
        if (!r.ok) throw new Error('bootstrap failed');
        const data = (await r.json()) as BootstrapResponse;

        const docs: DocumentRow[] = (data.documents || []).map((d: any) => ({
          id: Number(d.id),
          title: String(d.title ?? ''),
          path: d.path,
        }));

        // 카테고리 트리 + 경로 맵 구축
        const tree = buildCategoryTree(data.categories || []) as CategoryNode[];

        const idToPath: Record<number, number[]> = {};
        const nameMap: Record<number, string> = {};

        const walk = (nodes: CategoryNode[], path: number[] = []) => {
          for (const n of nodes) {
            const nextPath = [...path, Number(n.id)];
            idToPath[Number(n.id)] = nextPath;
            nameMap[Number(n.id)] = String(n.name ?? '');
            if (n.children?.length) walk(n.children, nextPath);
          }
        };
        walk(tree);

        if (cancelled) return;
        setDocuments(docs);
        setCategoryIdToPathMap(idToPath);
        setCategoryNameById(nameMap);
      } catch (e) {
        console.error('[views report] bootstrap failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) range별 조회수 로드
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(withTs(`/api/view/stats?range=${range}`), { cache: 'no-store' });
        if (!r.ok) throw new Error('stats failed');
        const data = await r.json();

        const m = new Map<number, number>();
        for (const it of data?.items || []) {
          const id = Number(it?.documentId);
          const v = Number(it?.views);
          if (Number.isFinite(id) && id > 0 && Number.isFinite(v)) m.set(id, v);
        }

        if (cancelled) return;
        setViewsMap(m);
      } catch (e) {
        console.error('[views report] stats failed', e);
        if (!cancelled) setViewsMap(new Map());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range]);

  // 3) 문서별 “소속 카테고리 이름(경로)” 만들기
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const makeBreadcrumb = (doc: DocumentRow) => {
      const raw = doc.path;
      const cid = /^\d+$/.test(String(raw)) ? Number(raw) : NaN;

      if (!Number.isFinite(cid) || cid === 0) return '루트';

      const p = categoryIdToPathMap[cid] || [cid];
      const names = p.map((id) => categoryNameById[id]).filter(Boolean);
      if (!names.length) return `카테고리#${cid}`;
      return names.join(' > ');
    };

    const merged = documents.map((d) => {
      const views = viewsMap.get(d.id) ?? 0;
      return {
        documentId: d.id,
        title: d.title || `(제목없음 #${d.id})`,
        category: makeBreadcrumb(d),
        views,
      };
    });

    // ✅ (1) 조회수 0은 표시하지 않기
    const nonZero = merged.filter(r => r.views > 0);

    // 검색 필터(제목/카테고리)
    const filtered = !q
      ? nonZero
      : nonZero.filter((r) => {
          return (
            r.title.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            String(r.documentId).includes(q)
          );
        });

    // ✅ 기본: 인기순(조회수 DESC), 동률이면 title
    filtered.sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      return a.title.localeCompare(b.title);
    });

    return filtered;
  }, [documents, viewsMap, query, categoryIdToPathMap, categoryNameById]);

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>문서 조회수 통계</h2>
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <RangeSwitch value={range} onChange={setRange} />

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색: 문서 제목 / 카테고리 / 문서ID"
          style={{
            height: 36,
            padding: '0 12px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            minWidth: 280,
            outline: 'none',
          }}
        />

        <div style={{ color: '#6b7280', fontSize: 13 }}>
          총 {rows.length.toLocaleString()}건
        </div>
      </div>

      <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
              <tr>
                <Th style={{ width: 90 }}>문서ID</Th>
                <Th>문서 제목</Th>
                <Th>소속 카테고리</Th>
                <Th style={{ width: 110, textAlign: 'right' }}>조회수</Th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <Td colSpan={4} style={{ padding: 18, color: '#6b7280' }}>
                    로딩중…
                  </Td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <Td colSpan={4} style={{ padding: 18, color: '#6b7280' }}>
                    표시할 데이터가 없습니다.
                  </Td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.documentId}-${r.views}-${pathToStr([])}`}>
                    {/* ✅ (2) 문서ID 하얀색 */}
                    <Td style={{ color: '#fff' }}>{r.documentId}</Td>

                    <Td style={{ fontWeight: 600 }}>{r.title}</Td>

                    {/* ✅ (2) 소속카테고리 하얀색 */}
                    <Td style={{ color: '#fff' }}>{r.category}</Td>

                    <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.views.toLocaleString()}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, color: '#6b7280', fontSize: 12, lineHeight: 1.5 }}>
        - 기본 정렬: 인기순(조회수 내림차순)<br />
        - 집계 기준: total=누적, day=오늘(CURRENT_DATE), week=최근 7일 합산<br />
        - 조회수는 화면에 렌더하지 않고, 문서가 열렸을 때만 증가
      </div>
    </div>
  );
}

function RangeSwitch({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  const items: { key: RangeKey; label: string }[] = [
    { key: 'total', label: '총합' },
    { key: 'day', label: '일간' },
    { key: 'week', label: '주간' },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            style={{
              height: 36,
              padding: '0 14px',
              border: 0,
              cursor: 'pointer',
              background: active ? '#111827' : 'transparent',
              color: active ? '#fff' : '#374151',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Th({ style, children }: React.PropsWithChildren<{ style?: React.CSSProperties }>) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        borderBottom: '1px solid #e5e7eb',
        fontSize: 13,
        color: '#374151',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  style,
  children,
  colSpan,
}: React.PropsWithChildren<{ style?: React.CSSProperties; colSpan?: number }>) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid #f3f4f6',
        fontSize: 13,
        ...style,
      }}
    >
      {children}
    </td>
  );
}