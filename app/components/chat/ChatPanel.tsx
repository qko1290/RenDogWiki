// =============================================
// File: app/components/chat/ChatPanel.tsx
// =============================================
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@/wiki/lib/chat-types';
import ChatMessageItem from './ChatMessageItem';
import { useChat } from './ChatProvider';
import '@/wiki/css/chat.css';

const BOTTOM_THRESHOLD = 24;
const TOP_THRESHOLD = 24;
const MAX_LEN = 2000;

function tinyAvatarUrl(m?: ChatMessage | null) {
  if (!m) return '';
  const u = (m as any).user ?? {};
  const uuid: string | undefined =
    (u.minecraft_uuid as string | undefined) ??
    ((m as any).minecraft_uuid as string | undefined);
  const name: string | undefined =
    (u.minecraft_name as string | undefined) ??
    ((m as any).minecraft_name as string | undefined) ??
    (u.name as string | undefined);
  if (uuid) return `https://crafatar.com/avatars/${uuid}?overlay&size=18`;
  if (name) return `https://crafthead.net/helm/${encodeURIComponent(name)}/18.png`;
  return `https://crafatar.com/avatars/94cf9511-c5d6-433a-b565-14010caac235?overlay&size=18`;
}

export default function ChatPanel() {
  const {
    messages, send, replyingTo, setReplyingTo,
    hasMore, loadingMore, loadOlder,
    atBottom, setAtBottom,
  } = useChat();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 최초 데이터 유입 시 바닥으로
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        setAtBottom(true);
      });
    }
  }, [messages.length, setAtBottom]);

  // 스크롤
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearTop = el.scrollTop <= TOP_THRESHOLD;
    if (nearTop && !loadingMore && hasMore) {
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      loadOlder().then(() => {
        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeight + prevTop;
        });
      });
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
    setAtBottom(nearBottom);
  }, [hasMore, loadingMore, loadOlder, setAtBottom]);

  // 새 메시지 자동 스크롤
  const lastId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [lastId, atBottom]);

  // 미세 보정
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 40);
    return () => clearTimeout(t);
  }, []);

  // 입력창 자동 높이
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  const canSend = useMemo(() => !sending && text.trim().length > 0, [sending, text]);

  const onSend = useCallback(async () => {
    if (!canSend) return;
    const payload = text.slice(0, MAX_LEN).trim();
    const reply_to_id = replyingTo?.id ?? null;

    const prevText = text;
    const prevReply = replyingTo;

    setSending(true);
    setText('');
    setReplyingTo(null);

    try {
      await send({ text: payload, reply_to_id });
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {
      setText(prevText);
      setReplyingTo(prevReply);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [canSend, text, replyingTo, send, setReplyingTo]);

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (isComposing) return;
    const isEnter = e.key === 'Enter';
    const sendOnPlainEnter = isEnter && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    const sendOnCtrlMetaEnter = isEnter && (e.ctrlKey || e.metaKey);
    if (sendOnPlainEnter || sendOnCtrlMetaEnter) {
      e.preventDefault();
      onSend();
    }
  };

  const dismissReply = useCallback(() => setReplyingTo(null), [setReplyingTo]);

  // 입력창 위 배너 데이터
  const bannerName = useMemo(() => {
    const u = (replyingTo as any)?.user ?? {};
    return (
      (u.minecraft_name as string | undefined) ??
      (u.name as string | undefined) ??
      ((replyingTo as any)?.minecraft_name as string | undefined) ??
      ((replyingTo as any)?.user_name as string | undefined) ??
      (replyingTo ? `user#${(replyingTo as any)?.user_id ?? (u?.id ?? '?')}` : '')
    );
  }, [replyingTo]);

  const bannerSnippet = useMemo(() => {
    const t = (replyingTo as any)?.text as string | undefined;
    if (!t) return '';
    const one = t.replace(/\s+/g, ' ').trim();
    return one.length > 60 ? one.slice(0, 57) + '…' : one;
  }, [replyingTo]);

  return (
    <div className="chat-panel">
      <h3 className="text-lg font-semibold mb-2">팀 채팅</h3>

      {/* 메시지 영역 */}
      <div className="chat-scroller-wrap">
        <div ref={scrollerRef} onScroll={onScroll} className="chat-scroller">
          <div className="flex justify-center my-1">
            {loadingMore ? (
              <span className="text-xs text-neutral-500">이전 메시지 불러오는 중…</span>
            ) : hasMore ? (
              <span className="text-[11px] text-neutral-400">위로 올리면 더 보기</span>
            ) : (
              <span className="text-[11px] text-neutral-400">더 이상 메시지가 없습니다</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {messages.map((m: ChatMessage) => (
              <ChatMessageItem key={m.id} m={m} />
            ))}
          </div>
        </div>

        {!atBottom && (
          <button
            type="button"
            onClick={() => {
              const el = scrollerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
              setAtBottom(true);
            }}
            className="chat-go-bottom"
            title="최신 메시지로 이동"
          >
            ▼ 최신
          </button>
        )}
      </div>

      {/* 입력창 위: 답장 배너(캡슐 스타일) */}
      {replyingTo ? (
        <div className="chat-reply-banner">
          <div className="chat-reply-pill chat-reply-pill--compact">
            {/* 작은 아바타 */}
            <img
              src={tinyAvatarUrl(replyingTo)}
              width={18}
              height={18}
              className="chat-reply-avatar"
              alt="reply target avatar"
              draggable={false}
              decoding="async"
            />
            <span className="chat-reply__name">{bannerName || '알 수 없음'}</span>
            {bannerSnippet ? (
              <span className="chat-reply__snippet">· {bannerSnippet}</span>
            ) : null}
          </div>
          <button type="button" className="chat-reply-cancel" onClick={dismissReply}>
            취소
          </button>
        </div>
      ) : null}

      {/* 입력영역 */}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={onKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="메시지를 입력하세요… (Enter 전송, Shift+Enter 줄바꿈)"
          className="flex-1 resize-none border rounded-lg p-2 min-h-[44px] max-h-[140px] outline-none focus:ring-2 focus:ring-neutral-200"
          maxLength={MAX_LEN}
          aria-label="채팅 입력"
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          className={[
            'px-4 py-2 rounded-lg text-white',
            canSend ? 'bg-black hover:opacity-90' : 'bg-neutral-400 cursor-not-allowed',
          ].join(' ')}
        >
          {sending ? '전송 중…' : '보내기'}
        </button>
      </div>
    </div>
  );
}
