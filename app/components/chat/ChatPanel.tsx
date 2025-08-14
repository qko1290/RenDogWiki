// =============================================
// File: app/components/chat/ChatPanel.tsx
// =============================================
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@/wiki/lib/chat-types';
import ChatMessageItem from './ChatMessageItem';
import { useChat } from './ChatProvider';

/**
 * 컴포넌트 목적
 * - 팀 채팅 화면을 구성하는 스크롤 영역 + 입력창
 * - 과거 메시지 무한 스크롤(위로 당겨서 더 보기), 하단 고정, 답장/리액션 연계
 * - 서버가 계산해 준 필드(reply_to_me, like/dislike 등)를 그대로 사용
 *
 * 사용 팁
 * - 스크롤: 상단 근처 -> loadOlder(), 하단 근처 여부 추적 -> 새 메시지 도착 시 자동 스크롤
 * - 입력: Enter 전송, Shift+Enter 줄바꿈, Ctrl/Cmd+Enter도 전송, IME 조합 중에는 전송 차단
 * - 전송 실패 시 입력 복구(낙관적 UI 최소화)
 */

const BOTTOM_THRESHOLD = 24;
const TOP_THRESHOLD = 24;
const MAX_LEN = 2000; // 서버 측도 2000으로 잘라서 저장하므로 클라에서 맞춰 제한

export default function ChatPanel() {
  const {
    messages, send, replyingTo, setReplyingTo,
    hasMore, loadingMore, loadOlder,
    atBottom, setAtBottom,
  } = useChat();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isComposing, setIsComposing] = useState(false); // IME 조합중 여부
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 최초 데이터 유입 시 한 번은 바닥으로 붙이기
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

  // 스크롤 핸들러: 상단 근처면 과거 로드, 하단 여부 갱신
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const nearTop = el.scrollTop <= TOP_THRESHOLD;
    if (nearTop && !loadingMore && hasMore) {
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      loadOlder().then(() => {
        // prepend된 만큼만 보정 -> 사용자가 보던 위치 유지
        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeight + prevTop;
        });
      });
    }

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
    setAtBottom(nearBottom);
  }, [hasMore, loadingMore, loadOlder, setAtBottom]);

  // 새 메시지 도착 시: 사용자가 하단에 있을 때만 자동 스크롤
  const lastId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [lastId, atBottom]);

  // 마운트 직후 한 번 더 바닥으로(미세한 레이아웃 지연 대비)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 40);
    return () => clearTimeout(t);
  }, []);

  // 입력창 자동 높이 조절
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    // 최대 높이를 넘지 않도록 CSS로 제한, 여기서는 scrollHeight만 반영
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  const canSend = useMemo(() => {
    return !sending && text.trim().length > 0;
  }, [sending, text]);

  const onSend = useCallback(async () => {
    if (!canSend) return;
    const payload = text.slice(0, MAX_LEN).trim();
    const reply_to_id = replyingTo?.id ?? null;

    // 낙관적 조작 최소화: 성공 전까지 입력 유지 대신, 실패 시 복구하되 성공 시 정리
    const prevText = text;
    const prevReply = replyingTo;

    setSending(true);
    setText('');
    setReplyingTo(null);

    try {
      await send({ text: payload, reply_to_id });
      // 하단에 있지 않았더라도 전송자는 보통 최신을 보고 싶어함 -> 하단으로
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {
      // 실패하면 입력 복구
      setText(prevText);
      setReplyingTo(prevReply);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [canSend, text, replyingTo, send, setReplyingTo]);

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // IME 조합 중에는 Enter 전송 금지
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

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-2">팀 채팅</h3>

      {/* 메시지 영역: 고정 높이 + 내부 스크롤 */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="border rounded-xl bg-white h-[520px] overflow-y-auto p-3"
      >
        {/* 상단 센티넬/상태 */}
        <div className="flex justify-center my-1">
          {loadingMore ? (
            <span className="text-xs text-neutral-500">이전 메시지 불러오는 중…</span>
          ) : hasMore ? (
            <span className="text-[11px] text-neutral-400">위로 올리면 더 보기</span>
          ) : (
            <span className="text-[11px] text-neutral-400">더 이상 메시지가 없습니다</span>
          )}
        </div>

        {/* 메시지들 */}
        <div className="flex flex-col gap-2">
          {messages.map((m: ChatMessage) => (
            <ChatMessageItem key={m.id} m={m} />
          ))}
        </div>
      </div>

      {/* 답장 배너 */}
      {replyingTo ? (
        <div className="mt-2 px-2 py-1 text-xs rounded-md bg-neutral-100 border border-neutral-200 flex items-center gap-2">
          <span className="text-neutral-600">
            reply to #{replyingTo.id}
            {replyingTo.text ? `: ${replyingTo.text.slice(0, 60)}` : ''}
          </span>
          <button
            type="button"
            onClick={dismissReply}
            className="ml-auto px-2 py-0.5 rounded border border-neutral-300 hover:bg-neutral-50"
          >
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

      {/* 하단으로 이동 버튼(사용자가 위를 보고 있을 때만 표시) */}
      {!atBottom ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              const el = scrollerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
              setAtBottom(true);
            }}
            className="px-3 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
          >
            최신 메시지로 이동
          </button>
        </div>
      ) : null}
    </div>
  );
}
