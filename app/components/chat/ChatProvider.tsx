// =============================================
// File: app/components/chat/ChatProvider.tsx
// =============================================
'use client';

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';

// 런타임 클래스는 기본 import, 타입은 v2(named types)로 import
import Ably from 'ably';
import type { Realtime, Message, ConnectionStateChange } from 'ably';

import type { ChatMessage } from '@/wiki/lib/chat-types';
import { getAbly } from './ably-singleton';

/**
 * NOTE:
 * - ably 타입 버전에 따라 `RealtimeChannelCallbacks` / `RealtimeChannelPromise`
 *   이름이 없을 수 있습니다. 아래처럼 `ReturnType<Realtime['channels']['get']>`
 *   을 써서 채널 타입 의존성을 제거했습니다.
 */
type AnyRealtimeChannel = ReturnType<Realtime['channels']['get']>;

type SendPayload = { text: string; reply_to_id: number | null };

type ChatContextValue = {
  connected: boolean;
  messages: ChatMessage[];

  hasMore: boolean;
  loadingMore: boolean;
  loadInitial: (limit?: number) => Promise<void>;
  loadOlder: (limit?: number) => Promise<void>;

  /** 최신 동기화(수동 호출용) */
  syncLatest: () => Promise<void>;

  send: (p: SendPayload) => Promise<void>;
  toggleReaction: (id: number, type: 'like' | 'dislike') => Promise<void>;

  replyingTo: ChatMessage | null;
  setReplyingTo: (m: ChatMessage | null) => void;

  atBottom: boolean;
  setAtBottom: (b: boolean) => void;

  /** 답장 미리보기/스크롤을 위한 메시지 조회기 */
  getMessageById?: (id: number) => ChatMessage | null;
};

const ChatContext = createContext<ChatContextValue>({
  connected: false,
  messages: [],
  hasMore: true,
  loadingMore: false,
  loadInitial: async () => {},
  loadOlder: async () => {},
  syncLatest: async () => {},
  send: async () => {},
  toggleReaction: async () => {},
  replyingTo: null,
  setReplyingTo: () => {},
  atBottom: true,
  setAtBottom: () => {},
  getMessageById: () => null,
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

  // 최신 messages를 동기적으로 참조하기 위한 ref
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // 실시간(Ably)
  const ablyRef = useRef<Realtime | null>(null);
  const channelRef = useRef<AnyRealtimeChannel | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const didInitRef = useRef(false);

  // 자동 최신 동기화(폴링)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBackoffRef = useRef(0); // 네트워크 이슈 시 백오프 단계(0,1,2,...)

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

  /** 서버 리스트 API */
  const fetchList = useCallback(async (qs: string) => {
    const res = await fetch(`/api/chat/list${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('list-failed');
    const data = await res.json();
    const list = (data.messages ?? []) as ChatMessage[];
    list.sort((a, b) => a.id - b.id);
    return list;
  }, []);

  /** 최신 동기화(증분) — 서버가 after_id를 몰라도 안전하게 동작 */
  const syncLatest = useCallback(async () => {
    const after = newestIdRef.current ?? 0;

    try {
      // 1) 서버가 after_id를 지원한다면 효율적
      const list = await fetchList(`?limit=${PAGE_SIZE}&after_id=${after}`);

      // 2) 혹시 서버가 after_id를 무시해도, 클라에서 한 번 더 필터
      const filtered = list.filter(m => m.id > after);
      if (filtered.length) merge(filtered);

      // 성공했으니 백오프 리셋
      pollBackoffRef.current = 0;
    } catch {
      // 실패: 백오프 단계 증가(최대 4단계: 0/1/2/3/4)
      pollBackoffRef.current = Math.min(4, pollBackoffRef.current + 1);
    }
  }, [fetchList, merge]);

  const loadInitial = useCallback(async (limit = PAGE_SIZE) => {
    const list = await fetchList(`?limit=${limit}`);
    setMessages(sortTrimAndSetCursors(list.slice()));
    setHasMore(list.length === limit);
  }, [fetchList, sortTrimAndSetCursors]);

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

  /** Ably 구독 + 연결상태에 따른 동기화 트리거 */
  const setupRealtime = useCallback(() => {
    if (ablyRef.current) return;

    const client = getAbly();
    ablyRef.current = client;

    // 초기 연결 상태 반영
    setConnected(client.connection.state === 'connected');

    const onConn = (s: ConnectionStateChange) => {
      setConnected(s.current === 'connected');
      // 방금 연결됨 -> 혹시 누락된 메시지 보강
      if (s.current === 'connected') {
        syncLatest();
      }
    };
    client.connection.on(onConn);

    const ch = client.channels.get('rdwiki-chat');
    channelRef.current = ch;

    const onMessage = (msg: Message) => {
      const m = parseAblyData<ChatMessage>(msg.data);
      if (!m || toInt((m as any).id) == null) return;
      merge([m]);
    };
    ch.subscribe('new-message', onMessage);
    ch.subscribe('message.created', onMessage);

    const onReaction = (msg: Message) => {
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
  }, [merge, syncLatest]);

  // 초기 1회
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    loadInitial(PAGE_SIZE).catch(() => {});
    try { setupRealtime(); } catch { setConnected(false); }
    return () => cleanupRef.current();
  }, [loadInitial, setupRealtime]);

  /** === 폴링(자동 최신 동기화) ===
   * 연결 상태에 따라 주기 가변:
   * - 연결됨(connected): 45s(가벼운 신선도 유지)
   * - 연결 안 됨: 5s × 백오프(최대 5*2^4=80s)
   */
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const base = connected ? 45000 : 5000;
    const backoff = connected ? 0 : pollBackoffRef.current; // 연결 때는 백오프 사용 안함
    const interval = connected ? base : base * Math.pow(2, backoff || 0);

    pollTimerRef.current = setInterval(() => {
      syncLatest();
    }, interval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [connected, syncLatest]);

  /** 탭 가시성 복귀/포커스/네트워크 online 시 즉시 동기화 */
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') syncLatest(); };
    const onFocus = () => syncLatest();
    const onOnline = () => syncLatest();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [syncLatest]);

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

    // 실시간이 끊겨 있었던 경우, 내가 보낸 후 최신으로 보강
    if (!connected) {
      await syncLatest();
    }
  }, [connected, syncLatest]);

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
      await syncLatest(); // 실패 시 서버 상태로 재동기화
    } else {
      const d = await res.json().catch(() => null);
      if (d?.ok) {
        setMessages(prev => prev.map(m => m.id === id
          ? { ...m, like_count: d.like_count, dislike_count: d.dislike_count, i_liked: d.i_liked, i_disliked: d.i_disliked }
          : m));
      }
    }
  }, [syncLatest]);

  // 답장 미리보기/스크롤을 위한 메시지 조회기
  const getMessageById = useCallback((id: number) => {
    const inRef = messagesRef.current.find?.(x => x.id === id) ?? null;
    if (inRef) return inRef;
    const inState = messages.find?.(x => x.id === id) ?? null;
    return inState ?? null;
  }, [messages]);

  return (
    <ChatContext.Provider value={{
      connected,
      messages,
      hasMore,
      loadingMore,
      loadInitial,
      loadOlder,
      syncLatest,
      send,
      toggleReaction,
      replyingTo,
      setReplyingTo,
      atBottom,
      setAtBottom,
      getMessageById,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
export const useChatRT = useChat;
