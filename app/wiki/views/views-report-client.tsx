'use client';

import React, { useEffect, useMemo, useState } from 'react';

// WikiPageInner에서도 쓰는 트리 빌더(파일은 "수정 금지"지만 import는 OK)
import { buildCategoryTree } from '@/wiki/lib/buildCategoryTree';

type ViewBreakdown = {
  total: number;
  category: number;
  search: number;
  link: number;
  other: number;
};

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

export default function ViewsReportClient() {
  const [range, setRange] = useState<RangeKey>('week');
  const [query, setQuery] = useState('');

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [categoryNameById, setCategoryNameById] = useState<Record<number, string>>({});
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});
  const [viewsMap, setViewsMap] = useState<Map<number, ViewBreakdown>>(new Map());

  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const loading = bootstrapLoading || statsLoading;

  // 1) bootstrap 로드 (문서/카테고리)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setBootstrapLoading(true);

        const r = await fetch(withTs('/api/bootstrap'), {
          cache: 'no-store',
        });
        if (!r.ok) throw new Error('bootstrap failed');

        const data: BootstrapResponse = await r.json();

        const docs: DocumentRow[] = Array.isArray(data?.documents)
          ? data.documents.map((doc: any) => ({
              id: Number(doc?.id),
              title: String(doc?.title ?? ''),
              path: doc?.path ?? 0,
            }))
          : [];

        const tree = buildCategoryTree(
          Array.isArray(data?.categories) ? data.categories : []
        ) as CategoryNode[];

        const nextCategoryNameById: Record<number, string> = {};
        const nextCategoryIdToPathMap: Record<number, number[]> = {};

        const walk = (nodes: CategoryNode[], parentPath: number[] = []) => {
          for (const node of nodes) {
            const currentPath = [...parentPath, node.id];
            nextCategoryNameById[node.id] = node.name;
            nextCategoryIdToPathMap[node.id] = currentPath;

            if (Array.isArray(node.children) && node.children.length > 0) {
              walk(node.children, currentPath);
            }
          }
        };

        walk(tree);

        if (cancelled) return;

        setDocuments(docs);
        setCategoryNameById(nextCategoryNameById);
        setCategoryIdToPathMap(nextCategoryIdToPathMap);
      } catch (e) {
        console.error('[views report] bootstrap failed', e);

        if (cancelled) return;

        setDocuments([]);
        setCategoryNameById({});
        setCategoryIdToPathMap({});
      } finally {
        if (!cancelled) setBootstrapLoading(false);
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
        setStatsLoading(true);

        const r = await fetch(withTs(`/api/view/stats?range=${range}`), {
          cache: 'no-store',
        });
        if (!r.ok) throw new Error('stats failed');

        const data = await r.json();
        const m = new Map<number, ViewBreakdown>();

        for (const it of data?.items || []) {
          const id = Number(it?.documentId);
          if (!Number.isFinite(id) || id <= 0) continue;

          m.set(id, {
            total: Number(it?.views ?? 0),
            category: Number(it?.categoryViews ?? 0),
            search: Number(it?.searchViews ?? 0),
            link: Number(it?.linkViews ?? 0),
            other: Number(it?.otherViews ?? 0),
          });
        }

        if (cancelled) return;
        setViewsMap(m);
      } catch (e) {
        console.error('[views report] stats failed', e);
        if (!cancelled) setViewsMap(new Map());
      } finally {
        if (!cancelled) setStatsLoading(false);
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
      const stat = viewsMap.get(d.id) ?? {
        total: 0,
        category: 0,
        search: 0,
        link: 0,
        other: 0,
      };

      return {
        documentId: d.id,
        title: d.title || `(제목없음 #${d.id})`,
        category: makeBreadcrumb(d),
        views: stat.total,
        categoryViews: stat.category,
        searchViews: stat.search,
        linkViews: stat.link,
        otherViews: stat.other,
      };
    });

    const nonZero = merged.filter((r) => r.views > 0);

    const filtered = !q
      ? nonZero
      : nonZero.filter((r) => {
          return (
            r.title.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            String(r.documentId).includes(q)
          );
        });

    filtered.sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      return a.title.localeCompare(b.title, 'ko');
    });

    return filtered;
  }, [documents, viewsMap, query, categoryIdToPathMap, categoryNameById]);

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>문서 조회수 통계</h2>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
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

      <div
        style={{
          marginTop: 12,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead
              style={{
                position: 'sticky',
                top: 0,
                background: '#f9fafb',
                zIndex: 1,
              }}
            >
              <tr>
                <Th style={{ width: 90 }}>문서ID</Th>
                <Th>문서 제목</Th>
                <Th>소속 카테고리</Th>
                <Th style={{ textAlign: 'right' }}>전체</Th>
                <Th style={{ textAlign: 'right' }}>카테고리</Th>
                <Th style={{ textAlign: 'right' }}>검색</Th>
                <Th style={{ textAlign: 'right' }}>하이퍼링크</Th>
                <Th style={{ textAlign: 'right' }}>기타</Th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <Td colSpan={8} style={{ padding: 18, color: '#6b7280' }}>
                    로딩중…
                  </Td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <Td colSpan={8} style={{ padding: 18, color: '#6b7280' }}>
                    표시할 데이터가 없습니다.
                  </Td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.documentId}>
                    <Td>{r.documentId}</Td>
                    <Td style={{ fontWeight: 600 }}>{r.title}</Td>
                    <Td>{r.category}</Td>
                    <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.views.toLocaleString()}
                    </Td>
                    <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.categoryViews.toLocaleString()}
                    </Td>
                    <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.searchViews.toLocaleString()}
                    </Td>
                    <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.linkViews.toLocaleString()}
                    </Td>
                    <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.otherViews.toLocaleString()}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RangeSwitch({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
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

function Th({
  style,
  children,
}: React.PropsWithChildren<{ style?: React.CSSProperties }>) {
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