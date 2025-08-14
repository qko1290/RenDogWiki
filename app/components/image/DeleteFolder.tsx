// =============================================
// File: app/components/image/DeleteFolder.tsx
// =============================================
'use client';

/**
 * 이미지 탐색기의 폴더 삭제 버튼 + 확인 모달.
 * - 외부 제어(open/onOpen/onClose) 또는 내부 상태로 열림/닫힘을 관리
 * - 삭제 성공 시 onDeleted() 호출, 이후 onClose()/내부 닫기 처리
 * - 로딩/비활성/예외 처리 일관성 유지
 */

import { useState, useEffect } from 'react';
import Modal from "@/components/common/Modal";

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
  folderId: number | null;
  onDeleted?: () => void;
  disabled?: boolean;
  folderName?: string;
  className?: string;
  /** 외부에서 모달 열림을 제어하려면 open/onOpen/onClose 사용 */
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  // 외부 제어 우선, 없으면 내부 상태 사용
  const isOpen = open !== undefined ? open : internalOpen;

  // 모달이 닫히면 로딩 해제(중복 요청/잔여 상태 방지)
  useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  async function handleDelete() {
    if (folderId == null || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/image/folder/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderId }),
      });

      if (!res.ok) {
        // 실패 응답 안전 파싱
        let msg = '삭제 실패';
        try {
          const data = await res.json();
          msg = data?.error || msg;
        } catch {
          // body 없음/JSON 아님
        }
        alert(msg);
        setLoading(false);
        return;
      }

      // 성공
      onDeleted?.();
      if (onClose) onClose();
      else setInternalOpen(false);
    } catch {
      alert('서버 오류');
      setLoading(false);
    }
  }

  const openModal = () => {
    if (onOpen) onOpen();
    else setInternalOpen(true);
  };

  const closeModal = () => {
    if (loading) return; // 처리 중 닫기 방지
    if (onClose) onClose();
    else setInternalOpen(false);
  };

  return (
    <>
      <button
        onClick={openModal}
        className={className ?? "image-explorer-btn danger"}
        disabled={disabled || loading || folderId == null}
        title="폴더 삭제"
      >
        {loading ? '삭제 중...' : '🗑 삭제'}
      </button>

      {/* Modal.title prop 미사용: 내부에서 제목 렌더링 */}
      <Modal open={isOpen} onClose={closeModal}>
        <h3 className="text-lg font-semibold mb-3">폴더 삭제 확인</h3>
        <div className="py-2">
          <div className="mb-3 text-base text-gray-800">
            <span className="font-semibold">{folderName || ''}</span> 폴더를 정말 삭제할까요?<br />
            <span className="text-sm text-gray-500">
              ※ 하위 폴더와 이미지도 모두 삭제됩니다.
            </span>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={closeModal}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded"
              onClick={handleDelete}
              disabled={loading || folderId == null}
            >
              {loading ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
