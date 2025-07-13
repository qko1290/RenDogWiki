// =============================================
// File: app/api/auth/register/route.ts
// =============================================
/**
 * 회원가입 API 라우트
 * - POST: 회원가입 요청 처리
 *   - 중복 이메일, 아이디, 마인크래프트 닉네임 모두 체크
 *   - 비밀번호는 bcrypt로 해시 변환 후 저장
 *   - 인증용 랜덤 토큰 생성 및 DB 저장
 *   - 회원가입 즉시 인증 메일 발송
 * - 유의사항:
 *   - sendVerificationMail: 메일 발송 유틸 함수
 *   - 회원 생성 시 기본 verified=false, verification_token은 가입 시 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db'; // DB (neon 방식)
import bcrypt from 'bcryptjs'; // 비밀번호 해시
import crypto from 'crypto'; // 인증 토큰 생성용
import { sendVerificationMail } from '@/wiki/lib/sendVerificationMail'; // 인증메일 발송 함수

/**
 * [회원가입 처리] POST
 * - email, username, password, minecraftName
 * - 중복 검사 후, 가입 처리 -> 인증 메일 발송 -> 성공 메시지 반환
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 입력값 파싱 및 필수값 체크
    const { email, username, password, minecraftName } = await req.json();

    // 하나라도 빠졌을 때 에러 반환
    if (!email || !username || !password || !minecraftName) {
      // 필수값 누락
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
    }

    // 2. 중복 체크 (이메일, 아이디, 닉네임)
    // email, username, minecraftName 중 하나라도 기존에 있으면 가입 불가
    const existing = await sql`
      SELECT * FROM users WHERE email = ${email} OR username = ${username} OR minecraft_name = ${minecraftName}
    `;

    // 중복된 값이 존재하면 에러 반환
    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: '이미 존재하는 이메일/아이디/닉네임입니다.' }, { status: 409 });
    }

    // 3. 비밀번호 해시 및 인증 토큰 생성
    // bcrypt로 비밀번호 해싱
    const hashed = await bcrypt.hash(password, 10);

    // 인증용 랜덤 토큰
    const token = crypto.randomBytes(32).toString('hex');

    // 4. DB에 회원 정보 저장
    // - verified: false(가입 직후엔 미인증)
    // - verification_token: 생성한 토큰 값 저장
    await sql`
      INSERT INTO users (email, username, password_hash, minecraft_name, verified, verification_token)
      VALUES (${email}, ${username}, ${hashed}, ${minecraftName}, false, ${token})
    `;

    // 5. 인증 메일 발송
    // 발송 실패 시도 catch로 감지
    // sendVerificationMail 호출
    await sendVerificationMail(email, token);

    // 6. 성공 메시지 반환
    return NextResponse.json({ message: '회원가입 성공. 이메일을 확인해주세요.' });
  } catch (e) {
    // 예외 발생 시 500 에러와 함께 상세 로그 출력
    // vercel 접속해서 log 확인하시면 됩니다
    console.error('회원가입 에러:', e);
    return NextResponse.json({ error: '서버 내부 오류 (로그를 확인하세요)' }, { status: 500 });
  }
}
