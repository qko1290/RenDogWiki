import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import type { NextAuthOptions } from "next-auth";
import mysql from "mysql2/promise";
import axios from "axios";
import { RowDataPacket } from "mysql2";

// xbox 관련 타입 정의 부분이에요
// 지금 권한 문제로 막아뒀어요

type XboxLiveAuthResponse = {
  Token: string;
  DisplayClaims: {
    xui: { uhs: string }[];
  };
};

type XstsAuthResponse = {
  Token: string;
  DisplayClaims: {
    xui: { uhs: string }[];
  };
};

type MinecraftProfileResponse = {
  id: string;
  name: string;
};

const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      id: "microsoft",
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID!,
      authorization: {
        params: {
          scope: "openid email profile offline_access",
          prompt: "consent",
        },
      },
      //authorization: {
        //params: {
          //scope: "XboxLive.signin XboxLive.offline_access openid email profile offline_access",
          //prompt: "consent",
        //},
      //},
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    error: "/login/error",
  },
  callbacks: {
    async signIn({ user, account }) {
      console.log("▶️ signIn 시작", user);

      const accessToken = account?.access_token;
      if (!accessToken) {
        console.log("access_token 없음");
        return false;
      }

      const email = user.email || "";
      if (email.includes("live.com")) {
        console.warn("테넌트에 등록되지 않은 사용자:", email);
        // 👉 email 파라미터도 함께 넘겨 버튼용으로 활용
        throw new Error(`guest:${email}`);
      }


      console.log("access_token:", accessToken);

      let mcName = user.name || "Guest";
      let avatarUrl = "";

      /*
      let xblToken: string | null = null;
      let userHash: string | null = null;
      let xstsToken: string | null = null;

      // Xbox Live 로그인
      try {
        const xblRes = await axios.post<XboxLiveAuthResponse>(
          "https://user.auth.xboxlive.com/user/authenticate",
          {
            Properties: {
              AuthMethod: "RPS",
              SiteName: "user.auth.xboxlive.com",
              RpsTicket: `d=${accessToken}`,
            },
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT",
          },
          { headers: { "Content-Type": "application/json" } }
        );
        xblToken = xblRes.data.Token;
        userHash = xblRes.data.DisplayClaims.xui[0].uhs;
        console.log("Xbox Live 인증 성공");
      } catch (err) {
        console.warn("Xbox Live 인증 실패:", err);
      }

      // XSTS 인증
      if (xblToken) {
        try {
          const xstsRes = await axios.post<XstsAuthResponse>(
            "https://xsts.auth.xboxlive.com/xsts/authorize",
            {
              Properties: {
                SandboxId: "RETAIL",
                UserTokens: [xblToken],
              },
              RelyingParty: "rp://api.minecraftservices.com/",
              TokenType: "JWT",
            }
          );
          xstsToken = xstsRes.data.Token;
          console.log(" XSTS 인증 성공");
        } catch (err) {
          console.warn("XSTS 인증 실패:", err);
        }
      }

      // Minecraft 프로필 요청
      if (userHash && xstsToken) {
        try {
          const minecraftAuth = await axios.post<{ access_token: string }>(
            "https://api.minecraftservices.com/authentication/login_with_xbox",
            { identityToken: `XBL3.0 x=${userHash};${xstsToken}` }
          );

          const mcRes = await axios.get<MinecraftProfileResponse>(
            "https://api.minecraftservices.com/minecraft/profile",
            { headers: { Authorization: `Bearer ${minecraftAuth.data.access_token}` } }
          );

          mcName = mcRes.data.name;
          avatarUrl = `https://crafatar.com/avatars/${mcRes.data.id}?size=100`;

          console.log( "Minecraft 닉네임:", mcName);
          console.log("Minecraft 아바타 URL:", avatarUrl);
        } catch (err) {
          console.warn(" Minecraft 프로필 요청 실패:", err);
        }
      } else {
        console.log(" Minecraft 계정 인증을 건너뜀");
      }
      */

      // DB 저장
      const connection = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "rdwiki",
      });

      const [rows] = await connection.execute("SELECT * FROM users WHERE email = ?", [user.email]);

      if ((rows as any[]).length === 0) {
        await connection.execute(
          "INSERT INTO users (email, name, avatar_url) VALUES (?, ?, ?)",
          [user.email, mcName, avatarUrl]
        );
        console.log("사용자 등록 완료:", mcName);
      } else {
        console.log("이미 존재하는 사용자");
      }

      await connection.end();
      return true;
    },

    async session({ session }) {
      if (session.user?.email) {
        const connection = await mysql.createConnection({
          host: "localhost",
          user: "root",
          password: "",
          database: "rdwiki",
        });

        const [rows] = await connection.execute<RowDataPacket[]>(
          "SELECT name, avatar_url FROM users WHERE email = ?",
          [session.user.email]
        );

        await connection.end();

        if (rows.length > 0) {
          session.user.name = rows[0].name;
          (session.user as any).avatar_url = rows[0].avatar_url;
        }
      }

      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
