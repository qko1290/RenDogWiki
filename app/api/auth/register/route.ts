/**
 * 회원가입 API (PostgreSQL 버전)
 * - POST:
 *   - 중복 이메일/아이디/마인크래프트닉네임 있으면 에러
 *   - 비밀번호 해시 후 DB 저장
 *   - 인증 메일 전송
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationMail } from '@/wiki/lib/sendVerificationMail';

export async function POST(req: NextRequest) {
  try {
    const { email, username, password, minecraftName } = await req.json();

    if (!email || !username || !password || !minecraftName) {
      // 1. 필수값 누락
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
    }

    // 2. 중복 검사 (Postgres: 파라미터 $1, $2, $3)
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2 OR minecraft_name = $3',
      [email, username, minecraftName]
    );
    const existing = result.rows;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: '이미 존재하는 이메일/아이디/닉네임입니다.' }, { status: 409 });
    }

    // 3. 비밀번호 해시화 및 인증토큰 생성
    const hashed = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');

    // 4. DB 저장 (verified = false)
    await db.query(
      `INSERT INTO users (email, username, password_hash, minecraft_name, verified, verification_token)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [email, username, hashed, minecraftName, token]
    );

    // 5. 이메일 전송
    await sendVerificationMail(email, token);

    // 6. 성공 메시지 반환
    return NextResponse.json({ message: '회원가입 성공. 이메일을 확인해주세요.' });
  } catch (e) {
    console.error('회원가입 에러:', e);
    return NextResponse.json({ error: '서버 내부 오류 (로그를 확인하세요)' }, { status: 500 });
  }
}
