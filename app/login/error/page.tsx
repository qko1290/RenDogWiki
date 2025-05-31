'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginErrorPage() {
  const params = useSearchParams();
  const error = params.get('error'); 

  let reason = '';
  let email = '';

  if (error?.startsWith('guest:')) {
    reason = 'guest';
    email = error.replace('guest:', '');
  }

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">로그인 실패</h1>
      {reason === 'guest' ? (
        <>
          <p className="mb-2">이 계정은 테넌트에 등록되어 있지 않아 로그인할 수 없습니다.</p>
          <p className="mb-2">초대 요청을 하시려면 아래 버튼을 클릭하세요.</p>
          <form method="POST" action="/api/invite">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="name" value={email} />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
              초대 요청 보내기
            </button>
          </form>
        </>
      ) : (
        <p>알 수 없는 이유로 로그인에 실패했습니다.</p>
      )}
    </div>
  );
}
