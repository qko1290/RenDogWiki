// =============================================
// File: app/components/image/CreateFolder.tsx
// =============================================
/**
 * 이미지 탐색기에서 새 폴더를 만드는 작은 모달 UI.
 * - parentId(상위 폴더)와 폴더 이름을 입력받아 /api/image/folder/create 호출
 * - 성공 시 onCreated(folder) 콜백, onClose()로 부모에 닫힘 알림
 * - 외부 버튼 없이 바로 열고 싶으면 forceOpen 사용
 */

import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";

type Props = {
  parentId: number | null;
  onClose: () => void;
  onCreated?: (folder: any) => void;
  className?: string;
  /** 외부 버튼 없이 바로 모달을 띄워야 할 때 true */
  forceOpen?: boolean;
};

export default function CreateFolder({
  parentId,
  onCreated,
  onClose,
  className,
  forceOpen,
}: Props) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // forceOpen이 true로 바뀌면 모달을 연다.
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      // 새로 열릴 때 깔끔한 상태로
      setFolderName("");
      setError(null);
    }
  }, [forceOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // 중복 제출 방지
    setError(null);

    const name = folderName.trim();
    if (!name) {
      setError("이름을 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/image/folder/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parent_id: parentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "생성 실패");
        setLoading(false);
        return;
      }

      // 성공
      setOpen(false);
      setFolderName("");
      setLoading(false);
      onCreated?.(data.folder);
      onClose(); // 부모에도 닫힘 알림
    } catch {
      setError("서버 오류");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // 요청 중에는 닫기 방지
    setOpen(false);
    // 닫을 때 내부 상태 정리
    setFolderName("");
    setError(null);
    onClose();
  };

  return (
    <>
      {/* 외부 트리거 버튼 (forceOpen 사용 시 숨김) */}
      {!forceOpen && (
        <button
          className={className ?? "image-explorer-btn"}
          onClick={() => {
            setOpen(true);
            setFolderName("");
            setError(null);
          }}
        >
          폴더 생성
        </button>
      )}

      {/* Modal.title prop을 사용하지 않고 내부에서 제목을 렌더링 */}
      <Modal open={open} onClose={handleClose}>
        <h3 className="text-lg font-semibold mb-3">폴더 생성</h3>

        <form onSubmit={handleCreate}>
          <input
            className="border px-3 py-2 rounded w-full"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="폴더 이름"
            autoFocus
          />

          {error && (
            <div className="text-red-500 text-sm mt-2" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4 justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={handleClose}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
              disabled={loading}
            >
              {loading ? "생성 중..." : "생성"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
