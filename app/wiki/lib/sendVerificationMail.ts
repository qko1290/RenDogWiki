// =============================================
// File: app/wiki/lib/sendVerificationMail.ts
// =============================================
/**
 * 회원가입 시 이메일 인증 메일 발송 유틸
 * - nodemailer를 이용해 Gmail로 메일 전송
 * - 인증 토큰을 포함한 링크를 HTML 메일로 전송
 */

import nodemailer from 'nodemailer';

 // 인증 메일 발송 함수
export async function sendVerificationMail(email: string, token: string) {
  // 1. 인증 URL 조합
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; // 사이트 루트
  const url = `${site}/verify/${token}`; // 인증 클릭시 이동할 주소

  // 2. Nodemailer 전송 객체 생성 (Gmail 기본)
  const transporter = nodemailer.createTransport({
    service: 'gmail', // 또는 'smtp'로 바꿔 사용 가능
    auth: {
      user: process.env.EMAIL_FROM, // 보내는 이메일 주소(환경변수)
      pass: process.env.EMAIL_PASS, // 앱 비밀번호(환경변수)
    },
  });

  // 3. 메일 발송
  await transporter.sendMail({
    from: `"RenDog Wiki" <${process.env.EMAIL_FROM}>`, // 보내는 사람 표시
    to: email, // 받는 사람
    subject: '📧 RenDog Wiki 이메일 인증', // 제목
    html: `
      <h2>이메일 인증</h2>
      <p>아래 버튼을 클릭해 이메일 인증을 완료해주세요:</p>
      <a href="${url}" style="padding: 8px 16px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 4px;">
        이메일 인증하기
      </a>
      <p>또는 다음 링크를 복사하여 브라우저에 붙여넣기:</p>
      <pre>${url}</pre>
    `
  });
}
