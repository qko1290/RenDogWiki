// =============================================
// File: app/wiki/WikiPageClient.tsx
// =============================================
'use client';

import WikiPageInner from '@/components/wiki/WikiPageInner';

type User = {
  id: number;
  username: string;
  minecraft_name: string;
  email: string;
} | null;

export default function WikiPageClient({ user }: { user: User }) {
  return <WikiPageInner user={user} />;
}