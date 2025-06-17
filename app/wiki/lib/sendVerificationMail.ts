import nodemailer from 'nodemailer';

export async function sendVerificationMail(email: string, token: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = `${site}/verify/${token}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"RenDog Wiki" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: '📧 RenDog Wiki 이메일 인증',
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
