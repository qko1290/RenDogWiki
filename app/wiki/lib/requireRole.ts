// =============================================
// File: app/wiki/lib/requireRole.ts (전체 코드)
// =============================================
import { getAuthUser } from '@/app/wiki/lib/auth';
import { sql } from '@/app/wiki/lib/db';

export type Role = 'guest' | 'writer' | 'admin';

export async function requireAuth() {
  const user = getAuthUser();
  if (!user) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' as const };
  }
  return { ok: true as const, user };
}

export async function requireRole(allow: Role[]) {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  // ✅ DB에서 role을 다시 조회해서 신뢰성 확보
  const rows = await sql<{
    id: number;
    role: Role | null;
    minecraft_name: string | null;
    username: string | null;
  }[]>`
    select id, role, minecraft_name, username
    from users
    where id = ${auth.user.id}
    limit 1
  `;

  const row = rows?.[0];
  const role: Role = (row?.role ?? 'guest') as Role;

  if (!allow.includes(role)) {
    return { ok: false as const, status: 403, error: 'FORBIDDEN' as const };
  }

  return {
    ok: true as const,
    user: auth.user,
    dbUser: {
      id: row.id,
      role,
      minecraft_name: row.minecraft_name ?? '',
      username: row.username ?? '',
    },
  };
}