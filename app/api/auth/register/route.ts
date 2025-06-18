// C:\next\rdwiki\app\api\auth\register\route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationMail } from '@/wiki/lib/sendVerificationMail';

export async function POST(req: NextRequest) {
  try {
    const { email, username, password, minecraftName } = await req.json();

    if (!email || !username || !password || !minecraftName) {
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
    }

    // 중복 검사
    const [existing] = await db.query(
      'SELECT * FROM users WHERE email = ? OR username = ? OR minecraft_name = ?',
      [email, username, minecraftName]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: '이미 존재하는 이메일/아이디/닉네임입니다.' }, { status: 409 });
    }

    // 비밀번호 해시화
    const hashed = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');

    // DB 저장
    await db.query(
      `INSERT INTO users (email, username, password_hash, minecraft_name, verified, verification_token)
      VALUES (?, ?, ?, ?, 0, ?)`,
      [email, username, hashed, minecraftName, token]
    );

    // 이메일 전송
    await sendVerificationMail(email, token);

    return NextResponse.json({ message: '회원가입 성공. 이메일을 확인해주세요.' });
  } catch (e) {
    console.error('회원가입 에러:', e);
    return NextResponse.json({ error: '서버 내부 오류 (로그를 확인하세요)' }, { status: 500 });
  }
}

