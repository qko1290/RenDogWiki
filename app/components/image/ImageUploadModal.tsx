// =============================================
// File: app/components/image/ImageUploadModal.tsx
// =============================================
/**
 * 이미지 업로드 모달 컴포넌트
 * - 여러 장 드래그/선택 업로드 지원
 * - 중복 파일 필터링, 업로드 진행 상태 표시
 */

import { useRef, useState } from "react";
import Modal from "@/components/common/Modal";

// Props 타입 선언
type Props = {
  open: boolean;                       // 모달 열림/닫힘 상태
  onClose: () => void;                 // 모달 닫기 콜백
  folderId: number | null;             // 업로드할 폴더 id (null이면 비활성)
  onUploaded: (images: any[]) => void; // 업로드 성공 시 이미지 배열 콜백
};

// 이미지 업로드 모달 본체
export default function ImageUploadModal({ open, onClose, folderId, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);         // 선택/드롭된 파일 목록
  const [loading, setLoading] = useState(false);          // 업로드 중 여부
  const inputRef = useRef<HTMLInputElement>(null);        // 파일 선택용 input ref

  // 파일 input/드롭 이벤트 핸들러
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev =>
        [
          ...prev,
          ...newFiles.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))
        ]
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev =>
        [
          ...prev,
          ...newFiles.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))
        ]
      );
    }
  };

  // S3/DB 업로드 요청
  const handleUpload = async () => {
    if (!files.length || !folderId) return;
    setLoading(true);
    const form = new FormData();
    files.forEach(f => form.append("files", f));
    form.append("folder_id", String(folderId));
    const res = await fetch("/api/image/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded(data.images); // 부모 갱신
      onClose();
    } else {
      alert(data.error || "업로드 실패");
    }
  };

  // 렌더: 모달, 드롭존, 버튼 등 UI
  return (
    <Modal open={open} onClose={onClose} title="이미지 업로드">
      {/* 드래그/클릭 선택 영역 */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="border rounded p-6 bg-gray-50 text-center mb-4"
        style={{ minHeight: 100, cursor: "pointer" }}
        onClick={() => inputRef.current?.click()}
      >
        {files.length === 0 ? (
          <div className="text-lg text-gray-400">이미지 파일을 여기에 드래그하거나 클릭하세요</div>
        ) : (
          <div>
            {files.map(f => (
              <div key={f.name + f.size} className="text-sm">{f.name}</div>
            ))}
          </div>
        )}
        {/* 파일 선택 input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleSelect}
        />
      </div>
      {/* 하단: 취소/업로드 버튼 */}
      <div className="flex gap-2 justify-end">
        <button className="px-4 py-2 bg-gray-200 rounded" onClick={onClose}>취소</button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={handleUpload}
          disabled={loading || !files.length}
        >
          {loading ? "업로드 중..." : "업로드"}
        </button>
      </div>
    </Modal>
  );
}
