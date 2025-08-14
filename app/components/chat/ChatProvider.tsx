// =============================================
// File: app/components/chat/ChatProvider.tsx
// =============================================
'use client';

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import Ably from 'ably'; // ← named export 없이 기본만 사용
import type { ChatMessage } from '@/wiki/lib/chat-types';
import { getAbly } from './ably-singleton';

/**
 * 채팅 전역 상태
 * - 초기/이전 로딩, 전송, 리액션 토글, Ably 실시간 수신/병합
 * - id 커서 기반 페이징, 메모리 보호용 윈도우 사이즈 제한
 * - 이벤트 키 혼용 대비: 'new-message'와 'message.created' 모두 구독
 */

type SendPayload = { text: string; reply_to_id: number | null };

type ChatContextValue = {
  connected: boolean;
  messages: ChatMessage[];

  hasMore: boolean;
  loadingMore: boolean;
  loadInitial: (limit?: number) => Promise<void>;
  loadOlder: (limit?: number) => Promise<void>;

  send: (p: SendPayload) => Promise<void>;
  toggleReaction: (id: number, type: 'like' | 'dislike') => Promise<void>;

  replyingTo: ChatMessage | null;
  setReplyingTo: (m: ChatMessage | null) => void;

  atBottom: boolean;
  setAtBottom: (b: boolean) => void;
};

const ChatContext = createContext<ChatContextValue>({
  connected: false,
  messages: [],
  hasMore: true,
  loadingMore: false,
  loadInitial: async () => {},
  loadOlder: async () => {},
  send: async () => {},
  toggleReaction: async () => {},
  replyingTo: null,
  setReplyingTo: () => {},
  atBottom: true,
  setAtBottom: () => {},
});

const PAGE_SIZE = 30;
const MAX_WINDOW = 300;

export default function ChatProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const oldestIdRef = useRef<number | null>(null);
  const newestIdRef = useRef<number | null>(null);

  // 실시간(Ably)
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<any>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const didInitRef = useRef(false);

  const toInt = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
    return null;
  };

  function parseAblyData<T = unknown>(data: unknown): T | null {
    if (data && typeof data === 'object') return data as T;
    if (typeof data === 'string') {
      try { return JSON.parse(data) as T; } catch { return null; }
    }
    return null;
  }

  // 정렬 + 윈도우 트림 + 커서 갱신
  const sortTrimAndSetCursors = useCallback((arr: ChatMessage[]) => {
    arr.sort((a, b) => a.id - b.id);
    if (arr.length > MAX_WINDOW) arr.splice(0, arr.length - MAX_WINDOW);
    oldestIdRef.current = arr.length ? arr[0].id : null;
    newestIdRef.current = arr.length ? arr[arr.length - 1].id : null;
    return arr;
  }, []);

  // 실시간/로딩 결과 병합
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming?.length) return;
    setMessages(prev => {
      const map = new Map<number, ChatMessage>();
      prev.forEach(m => map.set(m.id, m));
      incoming.forEach(m => map.set(m.id, m));
      return sortTrimAndSetCursors(Array.from(map.values()));
    });
  }, [sortTrimAndSetCursors]);

  // 리스트 API
  const fetchList = useCallback(async (qs: string) => {
    const res = await fetch(`/api/chat/list${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('list-failed');
    const data = await res.json();
    const list = (data.messages ?? []) as ChatMessage[];
    list.sort((a, b) => a.id - b.id);
    return list;
  }, []);

  const loadInitial = useCallback(async (limit = PAGE_SIZE) => {
    const list = await fetchList(`?limit=${limit}`);
    setMessages(sortTrimAndSetCursors(list.slice()));
    setHasMore(list.length === limit);
  }, [fetchList, sortTrimAndSetCursors]);

  // 이전 페이지 로딩
  const loadOlder = useCallback(async (limit = PAGE_SIZE) => {
    if (loadingMore || !hasMore) return;
    const cursor = oldestIdRef.current;
    if (!cursor) return;

    setLoadingMore(true);
    try {
      const beforeExclusive = Math.max(1, cursor - 1);
      const older = await fetchList(`?limit=${limit}&before_id=${beforeExclusive}`);

      let added = 0;
      setMessages(prev => {
        const prevTopId = cursor;
        const prevIds = new Set(prev.map(m => m.id));
        const filtered = older.filter(m => (prevTopId == null || m.id < prevTopId) && !prevIds.has(m.id));
        added = filtered.length;
        if (!added) return prev;
        return sortTrimAndSetCursors([...filtered, ...prev]);
      });

      setHasMore(added > 0 && older.length === limit);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchList, hasMore, loadingMore, sortTrimAndSetCursors]);

  // 실시간 구독
  const setupRealtime = useCallback(() => {
    if (ablyRef.current) return;

    const client = getAbly();
    ablyRef.current = client;

    setConnected(client.connection.state === 'connected');
    const onConn = (s: any) => {
      setConnected(s.current === 'connected');
    };
    client.connection.on(onConn);

    const ch = client.channels.get('rdwiki-chat');
    channelRef.current = ch;

    const onMessage = (msg: any) => {
      const m = parseAblyData<ChatMessage>(msg.data);
      if (!m || toInt((m as any).id) == null) return;
      merge([m]);
    };
    ch.subscribe('new-message', onMessage);
    ch.subscribe('message.created', onMessage);

    const onReaction = (msg: any) => {
      const p = parseAblyData<{ id: number; like_count: number; dislike_count: number }>(msg.data);
      if (!p || toInt(p.id) == null) return;
      setMessages(prev => prev.map(m => m.id === p.id
        ? { ...m, like_count: p.like_count, dislike_count: p.dislike_count }
        : m
      ));
    };
    ch.subscribe('reaction.updated', onReaction);

    cleanupRef.current = () => {
      try { ch.unsubscribe('new-message', onMessage); } catch {}
      try { ch.unsubscribe('message.created', onMessage); } catch {}
      try { ch.unsubscribe('reaction.updated', onReaction); } catch {}
      try { client.connection.off(onConn as any); } catch {}
      channelRef.current = null;
      ablyRef.current = null;
    };
  }, [merge]);

  // 초기 1회
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    loadInitial(PAGE_SIZE).catch(() => {});
    try { setupRealtime(); } catch { setConnected(false); }
    return () => cleanupRef.current();
  }, [loadInitial, setupRealtime]);

  // 전송
  const send = useCallback(async (p: SendPayload) => {
    const payload = { text: String(p.text ?? '').slice(0, 2000), reply_to_id: p.reply_to_id ?? null };
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'send-failed');
    }
    if (!connected) {
      const latest = await fetchList(`?limit=${PAGE_SIZE}`);
      merge(latest);
    }
  }, [connected, fetchList, merge]);

  // 리액션 토글(낙관적 -> 실패 시 동기화)
  const toggleReaction = useCallback(async (id: number, type: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m => {
      if (m.id !== id) return m;
      let { like_count, dislike_count, i_liked, i_disliked } = m as any;
      if (type === 'like') {
        if (i_liked) { like_count = Math.max(0, like_count - 1); i_liked = false; }
        else { like_count += 1; i_liked = true; if (i_disliked) { dislike_count = Math.max(0, dislike_count - 1); i_disliked = false; } }
      } else {
        if (i_disliked) { dislike_count = Math.max(0, dislike_count - 1); i_disliked = false; }
        else { dislike_count += 1; i_disliked = true; if (i_liked) { like_count = Math.max(0, like_count - 1); i_liked = false; } }
      }
      return { ...m, like_count, dislike_count, i_liked, i_disliked };
    }));

    const res = await fetch('/api/chat/toggle-reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ message_id: id, type }),
    });

    if (!res.ok) {
      const latest = await fetchList(`?limit=${PAGE_SIZE}`);
      merge(latest);
    } else {
      const d = await res.json().catch(() => null);
      if (d?.ok) {
        setMessages(prev => prev.map(m => m.id === id
          ? { ...m, like_count: d.like_count, dislike_count: d.dislike_count, i_liked: d.i_liked, i_disliked: d.i_disliked }
          : m));
      }
    }
  }, [fetchList, merge]);

  return (
    <ChatContext.Provider value={{
      connected,
      messages,
      hasMore,
      loadingMore,
      loadInitial,
      loadOlder,
      send,
      toggleReaction,
      replyingTo,
      setReplyingTo,
      atBottom,
      setAtBottom,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
export const useChatRT = useChat;
