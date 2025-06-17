// File: lib/auth.ts

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
};

export function getAuthUser(): AuthUser | null {
  const token = cookies().get('token')?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (err) {
    return null;
  }
}
