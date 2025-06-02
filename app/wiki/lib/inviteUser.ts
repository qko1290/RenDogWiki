// File: app/wiki/lib/inviteUser.ts

/**
 * Microsoft Graph API를 통한 테넌트 외부 사용자 초대 유틸
 * - OAuth2 client_credentials 플로우로 Graph API 토큰 발급
 * - 초대 메일 자동 발송
 * - .env.local 기반 정보 사용
 */

import axios from "axios";
import type { AxiosResponse } from "axios";

// 액세스 토큰 응답 타입
type TokenResponse = {
  token_type: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
};

// 초대 로직
export async function inviteUser(email: string, displayName: string) {
  try {
    // 1. OAuth2 토큰 발급
    const tokenRes: AxiosResponse<TokenResponse> = await axios.post(
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    const accessToken = tokenRes.data.access_token;

    // 2. Graph API로 초대 전송
    const inviteRes = await axios.post(
      "https://graph.microsoft.com/v1.0/invitations",
      {
        invitedUserEmailAddress: email,
        inviteRedirectUrl: process.env.NEXTAUTH_URL || "http://localhost:3000/login",
        invitedUserDisplayName: displayName,
        sendInvitationMessage: true,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("초대 성공:", inviteRes.data);
    return inviteRes.data;
  } catch (err) {
    console.error("초대 실패:", err);
    throw err;
  }
}
