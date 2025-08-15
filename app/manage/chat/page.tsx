// =============================================
// File: app/manage/chat/page.tsx
// =============================================
'use client';

import ChatProvider from '@/app/components/chat/ChatProvider';
import WikiHeader from '@/components/common/Header';
import ChatPanel from '@/app/components/chat/ChatPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@/wiki/css/chat.css';

type UserInfo = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
  role?: string;
};

export default function ChatPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [uuid, setUuid] = useState<string | null>(null);

  // 헤더 DOM 참조 (높이에 맞춰 메인 높이 자동 조절: CSS grid/flex 없이 변수로도 가능하지만
  // 여기서는 레이아웃 클래스로 해결하므로 ref는 선택 사항)
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.minecraft_name) return;
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/mojang/uuid?name=${encodeURIComponent(user.minecraft_name)}`,
          { signal: ac.signal }
        );
        if (!r.ok) { setUuid(null); return; }
        const j = await r.json();
        if (!ac.signal.aborted) setUuid(j.uuid);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setUuid(null);
      }
    })();
    return () => ac.abort();
  }, [user?.minecraft_name]);

  const avatarUrl = useMemo(() => {
    const base = 'https://crafatar.com/avatars';
    return `${base}/${uuid ?? user?.minecraft_name}?overlay`;
  }, [uuid, user?.minecraft_name]);

  return (
    <ChatProvider>
      <div className="chat-page">
        {/* 헤더 영역 (고정 높이, 페이지 스크롤 숨김 상태로도 정상) */}
        <div ref={headerRef} className="chat-page__header">
          <WikiHeader user={user} />
        </div>

        {/* 메인 영역: 헤더 아래 남은 높이를 모두 사용 */}
        <main className="chat-page__main">
          <div className="chat-page__inner">
            <ChatPanel />
          </div>
        </main>
      </div>
    </ChatProvider>
  );
}
