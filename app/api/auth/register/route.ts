// =============================================
// File: app/api/auth/register/route.ts
// =============================================
/**
 * 회원가입 API 라우트 (PostgreSQL 버전)
 * - POST: 회원가입 요청 처리
 *   - 중복 이메일, 아이디, 마인크래프트 닉네임 모두 체크(3중복 동시 체크)
 *   - 비밀번호는 bcrypt로 해시 후 저장
 *   - 인증용 랜덤 토큰 생성 및 DB 저장
 *   - 회원가입 즉시 인증 메일 발송(토큰 포함)
 * - 협업/유지보수 유의사항:
 *   - 모든 필수 입력값 누락/중복/DB 저장/메일 발송 단계마다 분기 및 예외처리
 *   - sendVerificationMail: 메일 발송 유틸 함수(메일 템플릿/발송은 lib/sendVerificationMail.ts 참고)
 *   - 회원 생성 시 기본 verified=false, verification_token은 가입 시 생성
 */

import { NextRequest, NextResponse } from 'next/server'; // Next.js API 타입
import { db } from '@/wiki/lib/db'; // PostgreSQL 쿼리 유틸
import bcrypt from 'bcryptjs'; // 비밀번호 해시
import crypto from 'crypto'; // 인증 토큰(랜덤값) 생성용
import { sendVerificationMail } from '@/wiki/lib/sendVerificationMail'; // 인증메일 발송 함수

/**
 * [회원가입 처리] POST
 * - email, username, password, minecraftName을 모두 받아야 정상 처리
 * - 중복 검사 후, 가입 처리 → 인증 메일 발송 → 성공 메시지 반환
 * - 각 단계별로 실패 시 적절한 에러와 상태코드 반환
 */
export async function POST(req: NextRequest) {
  try {
    // --- 1. 입력값 파싱 및 필수값 체크 ---
    // 클라이언트에서 보낸 데이터(JSON) 파싱
    const { email, username, password, minecraftName } = await req.json();

    // 하나라도 빠졌을 때 400 반환
    if (!email || !username || !password || !minecraftName) {
      // [필수값 누락] 모든 항목을 입력해야 정상 처리
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
    }

    // --- 2. 중복 체크 (이메일, 아이디, 닉네임) ---
    // email, username, minecraftName 중 하나라도 기존에 있으면 가입 불가
    // Postgres 파라미터: $1(email), $2(username), $3(minecraft_name)
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2 OR minecraft_name = $3',
      [email, username, minecraftName]
    );
    const existing = result.rows;

    // 기존 회원이 1명 이상 존재하면 409(Conflict) 반환
    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: '이미 존재하는 이메일/아이디/닉네임입니다.' }, { status: 409 });
    }

    // --- 3. 비밀번호 해시 및 인증 토큰 생성 ---
    // bcrypt로 비밀번호 해싱(10회 반복)
    const hashed = await bcrypt.hash(password, 10);

    // 인증용 랜덤 토큰(32바이트 hex)
    const token = crypto.randomBytes(32).toString('hex');

    // --- 4. DB에 회원 정보 저장 ---
    // - verified: false(가입 직후엔 미인증)
    // - verification_token: 생성한 토큰 값 저장
    await db.query(
      `INSERT INTO users (email, username, password_hash, minecraft_name, verified, verification_token)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [email, username, hashed, minecraftName, token]
    );

    // --- 5. 인증 메일 발송 ---
    //   - 발송 실패 시도 catch로 감지
    //   - sendVerificationMail(이메일, 토큰) 호출
    await sendVerificationMail(email, token);

    // --- 6. 성공 메시지 반환 ---
    //   - 프론트엔드에 안내 메시지 전송
    return NextResponse.json({ message: '회원가입 성공. 이메일을 확인해주세요.' });
  } catch (e) {
    // --- 예외 발생 시 500 에러와 함께 상세 로그 출력 ---
    console.error('회원가입 에러:', e);
    return NextResponse.json({ error: '서버 내부 오류 (로그를 확인하세요)' }, { status: 500 });
  }
}
