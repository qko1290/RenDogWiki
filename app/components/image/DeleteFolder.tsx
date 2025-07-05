// =============================================
// File: app/components/image/DeleteFolder.tsx
// =============================================
/**
 * 이미지 폴더 삭제 버튼 + 확인 모달 컴포넌트
 * - 버튼 클릭 시 폴더(및 하위 폴더/이미지) 완전 삭제
 * - "open/onOpen/onClose" props로 외부에서 모달 컨트롤 가능
 */

import { useState, useEffect } from 'react';
import Modal from "@/components/common/Modal";

// Props 타입 및 컴포넌트 선언
export default function DeleteFolder({
  folderId,
  onDeleted,
  disabled = false,
  folderName,
  className,
  open,
  onOpen,
  onClose,
}: {
  folderId: number | null;     // 삭제할 폴더 id (null이면 버튼 비활성)
  onDeleted?: () => void;      // 삭제 성공 후 콜백(트리 갱신용)
  disabled?: boolean;          // 버튼 비활성
  folderName?: string;         // 폴더명
  className?: string;          // 버튼 커스텀 클래스
  open?: boolean;              // 외부에서 모달 컨트롤
  onOpen?: () => void;         // 외부 모달 열기 핸들러
  onClose?: () => void;        // 외부 모달 닫기 핸들러
}) {
  // 내부 open/로딩 상태
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;

  // 모달 닫히면 loading도 항상 초기화
  useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  // 폴더 삭제 핸들러 (확인 -> API 호출 -> 콜백/알림)
  async function handleDelete() {
    if (folderId == null) return;
    setLoading(true);
    const res = await fetch('/api/image/folder/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: folderId }),
    });
    setLoading(false);

    if (res.ok) {
      if (onDeleted) onDeleted();           // 부모 트리 갱신 등
      if (onClose) onClose();
      setInternalOpen(false);               // 내부 open 제어시
    } else {
      const data = await res.json();
      alert(data.error || '삭제 실패');
    }
  }

  // 렌더: 버튼 + 모달
  return (
    <>
      {/* 삭제 버튼 */}
      <button
        onClick={() => { onOpen ? onOpen() : setInternalOpen(true); }}
        className={className ?? "image-explorer-btn danger"}
        disabled={disabled || loading || folderId == null}
        title="폴더 삭제"
      >
        {loading ? '삭제 중...' : '🗑 삭제'}
      </button>

      {/* 삭제 확인 모달 */}
      <Modal open={isOpen} onClose={onClose ? onClose : () => setInternalOpen(false)} title="폴더 삭제 확인">
        <div className="py-2">
          <div className="mb-3 text-base text-gray-800">
            <span className="font-semibold">{folderName || ''}</span> 폴더를 정말 삭제할까요?<br />
            <span className="text-sm text-gray-500">※ 하위 폴더와 이미지도 모두 삭제됩니다.</span>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={onClose ? onClose : () => setInternalOpen(false)}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
