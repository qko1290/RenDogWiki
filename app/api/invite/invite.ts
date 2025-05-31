// 파일: app/api/invite/invite.ts
import axios from "axios";
import type { AxiosResponse } from "axios";

type TokenResponse = {
  token_type: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
};

export async function inviteUser(email: string, displayName: string) {
  try {
    // 1단계: 애플리케이션 토큰 발급
    const tokenRes: AxiosResponse<TokenResponse> = await axios.post(
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // 2단계: 초대 요청
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
