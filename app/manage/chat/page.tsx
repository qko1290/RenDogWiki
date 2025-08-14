// =============================================
// File: app/manage/chat/page.tsx
// =============================================
'use client';

import ChatProvider from '@/app/components/chat/ChatProvider';
import ChatPanel from '@/app/components/chat/ChatPanel';
import '@/wiki/css/chat.css';

export default function ChatPage() {
  return (
    <ChatProvider>
      <div style={{ maxWidth: 760, margin: '24px auto' }}>
        <ChatPanel />
      </div>
    </ChatProvider>
  );
}
