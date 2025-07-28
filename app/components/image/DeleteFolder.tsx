// =============================================
// File: app/components/image/DeleteFolder.tsx
// =============================================
/**
 * 이미지 폴더 삭제 버튼 + 확인 모달 컴포넌트
 * - 버튼 클릭 시 지정 폴더(및 하위 폴더/이미지)를 완전 삭제
 * - open/onOpen/onClose props로 외부에서 모달 상태 제어 가능(컨트롤러 패턴)
 * - 내부에서 직접 상태 관리도 지원(외부에서 미제공 시)
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
  onDeleted?: () => void;      // 삭제 성공 후 콜백(부모 트리 갱신 등)
  disabled?: boolean;          // 버튼 비활성화 여부
  folderName?: string;         // 폴더명(모달 내 출력용)
  className?: string;          // 버튼 커스텀 클래스
  open?: boolean;              // 외부에서 모달 상태 컨트롤
  onOpen?: () => void;         // 외부 모달 열기 핸들러
  onClose?: () => void;        // 외부 모달 닫기 핸들러
}) {
  // 내부 loading(삭제 중) 및 open(모달 상태) 관리
  const [loading, setLoading] = useState(false);          // 삭제 요청 중 여부
  const [internalOpen, setInternalOpen] = useState(false); // 내부 open 관리
  // open prop이 넘어오면 외부 컨트롤, 아니면 내부 상태로 open 제어
  const isOpen = open !== undefined ? open : internalOpen;

  // 모달 닫힐 때마다 loading 초기화(ESC/외부 클릭 등 모든 경우 포함)
  useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  /**
   * 폴더 삭제 API 호출 핸들러
   * - 확인 모달 내 "삭제" 버튼에서 실행
   * - 성공 시 onDeleted/onClose 콜백, 실패시 에러 알림
   */
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
      // 1. 삭제 후 콜백(트리 갱신, 모달 닫기)
      if (onDeleted) onDeleted();
      if (onClose) onClose();
      setInternalOpen(false); // 내부 관리 중이면 닫기
    } else {
      // 2. 실패: 에러메시지 출력
      const data = await res.json();
      alert(data.error || '삭제 실패');
    }
  }

  // ===== 렌더: 삭제 버튼 + 모달 =====
  return (
    <>
      {/* 삭제 버튼 (외부 컨트롤 or 내부 상태로 동작) */}
      <button
        onClick={() => { onOpen ? onOpen() : setInternalOpen(true); }}
        className={className ?? "image-explorer-btn danger"}
        disabled={disabled || loading || folderId == null}
        title="폴더 삭제"
      >
        {loading ? '삭제 중...' : '🗑 삭제'}
      </button>

      {/* 삭제 확인 모달 */}
      <Modal
        open={isOpen}
        onClose={onClose ? onClose : () => setInternalOpen(false)}
        title="폴더 삭제 확인"
      >
        <div className="py-2">
          <div className="mb-3 text-base text-gray-800">
            <span className="font-semibold">{folderName || ''}</span> 폴더를 정말 삭제할까요?<br />
            <span className="text-sm text-gray-500">
              ※ 하위 폴더와 이미지도 모두 삭제됩니다.
            </span>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            {/* 취소 버튼: 모달 닫기(외부/내부) */}
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={onClose ? onClose : () => setInternalOpen(false)}
              disabled={loading}
            >
              취소
            </button>
            {/* 삭제 버튼: 실제 삭제 요청 */}
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
