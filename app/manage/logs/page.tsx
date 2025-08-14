// =============================================
// File: app/manage/logs/page.tsx
// =============================================
/**
 * 활동 로그 페이지
 * - /api/activity/logs 에서 페이지네이션(cursor)로 조회
 * - 검색(q)로 사용자/대상/액션 필터
 * - 기존 동작/표현 유지. 중복 'image.rename' case 제거.
 */

'use client';

import { useEffect, useState } from 'react';

type LogRow = {
  id: number;
  action: string;
  username: string | null;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  target_path: string | null;
  meta: any | null;
  created_at: string; // ISO
};

export default function LogsPage() {
  const [items, setItems] = useState<LogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async (opts?: { append?: boolean; cursor?: number | null; q?: string }) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('limit', '30');
    if (opts?.cursor != null) params.set('cursor', String(opts.cursor));
    if (opts?.q && opts.q.trim().length > 0) params.set('q', opts.q.trim());

    try {
      const res = await fetch(`/api/activity/logs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      setItems(prev => (opts?.append ? [...prev, ...(data.items ?? [])] : (data.items ?? [])));
      setNextCursor(data.nextCursor ?? null);
    } catch (e: any) {
      console.error('[LogsPage] load failed', e);
      setError('로그를 불러오지 못했습니다.');
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ q }); }, []); // 최초 로드

  const onSearch = () => load({ q }); // 검색

  const more = () => {
    if (!nextCursor || loading) return;
    load({ append: true, cursor: nextCursor, q });
  };

  const fmt = (row: LogRow) => {
    const u = row.username || '알 수 없음';
    const name = row.target_name || '-';
    const path = row.target_path || '-';
    const meta = row.meta || {};

    switch (row.action) {
      case 'folder.rename': {
        const from = meta.from_name ?? meta.from ?? name;
        const to = meta.to_name ?? meta.to ?? name;
        const where = path ? ` (${path})` : '';
        return `${u}님이 폴더 ${from}의 이름을 ${to}로 변경했습니다`;
      }
      case 'folder.move': {
        const from = meta.from_parent_name ?? (meta.from_parent_id != null ? String(meta.from_parent_id) : '루트 폴더');
        const to   = meta.to_parent_name   ?? (meta.to_parent_id   != null ? String(meta.to_parent_id)   : '루트 폴더');
        return `${u}님이 폴더 ${name}를 ${from}에서 ${to}로 이동했습니다`;
      }
      case 'image.upload': {
        const count = meta.count ?? 1;
        const names = Array.isArray(meta.names) ? meta.names : (name ? [name] : []);
        const preview = names.slice(0, 3).join(', ');
        const tail = names.length > 3 ? ` 외 ${names.length - 3}개` : '';
        return `${u}님이 ${path} 폴더에 ${preview}${tail} 이미지를 업로드했습니다`;
      }
      case 'image.rename': {
        const from = (row.meta?.from_name ?? row.meta?.from ?? row.target_name ?? '이전 이름');
        const to   = (row.meta?.to_name   ?? row.meta?.to   ?? '새 이름');
        const where = row.target_path ? ` (${row.target_path})` : '';
        return `${u}님이 이미지 ${from}의 이름을 ${to}로 변경했습니다`;
      }
      // 기존 케이스들 유지
      case 'document.create': return `${u}님이 ${path} 카테고리에 ${name} 문서를 작성했습니다`;
      case 'document.update': return `${u}님이 ${name} 문서를 수정했습니다`;
      case 'document.delete': return `${u}님이 ${name} 문서를 삭제했습니다`;
      case 'category.create': return `${u}님이 ${name} 카테고리를 생성했습니다`;
      case 'category.update': return `${u}님이 ${name} 카테고리를 수정했습니다`;
      case 'category.delete': return `${u}님이 ${name} 카테고리를 삭제했습니다`;
      case 'category.reorder': return `${u}님이 카테고리 순서를 변경했습니다`;
      case 'folder.create': return `${u}님이 ${path} 폴더에 ${name} 폴더를 생성했습니다`;
      case 'folder.delete': return `${u}님이 폴더 ${name}를 삭제했습니다`;
      case 'image.delete': return `${u}님이 이미지 ${name}를 삭제했습니다`;
      case 'npc.create': return `${u}님이 NPC ${name}를 추가했습니다`;
      case 'npc.update': return `${u}님이 NPC ${name}를 수정했습니다`;
      case 'npc.delete': return `${u}님이 NPC ${name}를 삭제했습니다`;
      case 'head.create': return `${u}님이 머리찾기 ${name}를 추가했습니다`;
      case 'head.update': return `${u}님이 머리찾기 ${name}를 수정했습니다`;
      case 'head.delete': return `${u}님이 머리찾기 ${name}를 삭제했습니다`;
      default: return `${u}님이 ${row.action} 작업을 수행했습니다`;
    }
  };

  const time = (iso: string) => new Date(iso).toLocaleString('ko-KR', { hour12: false });

  return (
    <div style={{ maxWidth: 920, margin: '28px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>활동 로그</h1>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <input
          placeholder="사용자/대상/액션 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
          style={{ flex: 1, padding: '10px 12px', border:'1px solid #ddd', borderRadius: 8 }}
        />
        <button onClick={onSearch} disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 8, border:'1px solid #ccc', background:'#fff' }}>
          검색
        </button>
      </div>

      {error && <div style={{ color:'#d33', marginBottom: 12 }}>{error}</div>}

      <ul style={{ listStyle:'none', padding:0, margin:0 }}>
        {items.map(row => (
          <li key={row.id}
              style={{ display:'flex', justifyContent:'space-between',
                       gap:16, padding:'12px 14px', borderBottom:'1px solid #eee' }}>
            <div style={{ whiteSpace:'pre-wrap' }}>{fmt(row)}</div>
            <div style={{ color:'#888', minWidth: 180, textAlign:'right' }}>{time(row.created_at)}</div>
          </li>
        ))}
      </ul>

      <div style={{ display:'flex', justifyContent:'center', padding:16 }}>
        <button
          onClick={more}
          disabled={!nextCursor || loading}
          style={{ padding:'10px 16px', borderRadius: 8, border:'1px solid #ddd', background:'#fff' }}
        >
          {loading ? '불러오는 중…' : nextCursor ? '더 보기' : '더 이상 없음'}
        </button>
      </div>
    </div>
  );
}
