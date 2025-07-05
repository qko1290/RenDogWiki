// =============================================
// File: app/components/image/CreateFolder.tsx
// =============================================
/**
 * 이미지 폴더 생성 컴포넌트
 * - 폴더 생성 버튼 + 모달로 구성
 * - forceOpen 옵션: 버튼 없이 무조건 모달만 오픈
 */

import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";

// Props 타입
type Props = {
  parentId: number | null;                       // 부모 폴더 id (최상위면 null)
  onCreated?: (folder: any) => void;             // 생성 성공 시 콜백
  className?: string;                            // 버튼 커스텀 클래스
  forceOpen?: boolean;                           // 버튼 없이 무조건 모달만 열기
};

// 메인 컴포넌트
export default function CreateFolder({ parentId, onCreated, className, forceOpen }: Props) {
  // 모달 오픈/이름/로딩/에러 상태
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // forceOpen 옵션: true로 바뀌면 모달 자동 열기
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  // 폴더 생성 핸들러
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!folderName.trim()) return setError("이름을 입력하세요.");
    setLoading(true);

    try {
      const res = await fetch("/api/image/folder/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName.trim(), parent_id: parentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "생성 실패");
        setLoading(false);
        return;
      }
      // 성공 시: 모달 닫기/입력 초기화/로딩 해제/콜백 호출
      setOpen(false);
      setFolderName("");
      setLoading(false);
      if (onCreated) onCreated(data.folder);
    } catch (err) {
      setError("서버 오류");
      setLoading(false);
    }
  };

  // 렌더 (버튼+모달)
  return (
    <>
      {/* forceOpen이 아닐 때만 폴더 생성 버튼 표시 (툴바용) */}
      {!forceOpen && (
        <button className={className ?? "image-explorer-btn"} onClick={() => setOpen(true)}>
          폴더 생성
        </button>
      )}
      {/* 폴더 생성 모달(항상 존재, open만 컨트롤) */}
      <Modal open={open} onClose={() => setOpen(false)} title="폴더 생성">
        <form onSubmit={handleCreate}>
          <input
            className="border px-3 py-2 rounded w-full"
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            placeholder="폴더 이름"
            autoFocus
          />
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          <div className="flex gap-2 mt-4 justify-end">
            <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={() => setOpen(false)}>
              취소
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>
              {loading ? "생성 중..." : "생성"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
