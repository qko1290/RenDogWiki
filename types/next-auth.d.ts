// File: types/next-auth.d.ts

/**
 * next-auth 세션/토큰 타입 확장 정의
 * - Minecraft 계정 정보(uuid, name, skin) 추가
 * - 세션 및 JWT 모두에서 minecraft 필드 사용 가능
 */

import NextAuth from "next-auth";
import { JWT } from "next-auth/jwt";

// 세션 타입 확장
declare module "next-auth" {
  interface Session {
    minecraft?: {
      uuid: string;
      name: string;
      skin: string | null;
    };
  }
}

// JWT 타입 확장
declare module "next-auth/jwt" {
  interface JWT {
    minecraft?: {
      uuid: string;
      name: string;
      skin: string | null;
    };
  }
}
