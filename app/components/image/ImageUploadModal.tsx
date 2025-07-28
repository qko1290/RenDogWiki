// =============================================
// File: app/components/image/ImageUploadModal.tsx
// =============================================
/**
 * 이미지 업로드 모달 컴포넌트
 * - 여러 장 드래그/선택 업로드 지원
 * - 파일명+사이즈 중복 필터, 업로드 진행 상태 표시
 * - 업로드 완료 시 파일 목록/인풋 리셋 후 onUploaded 콜백
 */

import { useRef, useState } from "react";
import Modal from "@/components/common/Modal";

// (실제 프로젝트에서 ImageFile 타입이 있다면 불러와서 아래 any[]를 대체하세요)
type ImageFile = {
  id: number;
  name: string;
  url: string;
  folder_id: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  folderId: number | null;
  onUploaded: (images: ImageFile[]) => void; // any[] 대신 명확한 타입
};

export default function ImageUploadModal({ open, onClose, folderId, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 파일 input/드롭 이벤트 - 중복 파일 제외
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
      inputRef.current && (inputRef.current.value = "");
      onUploaded(data.images);
      onClose();
    } else {
      alert(data.error || "업로드 실패");
    }
  };

  // UI 렌더: 모달 + 드롭존 + 파일 리스트 + 버튼
  return (
    <Modal open={open} onClose={onClose} title="이미지 업로드">
      {/* 파일 드래그/클릭 선택 영역 */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="border rounded p-6 bg-gray-50 text-center mb-4"
        style={{ minHeight: 100, cursor: "pointer" }}
        onClick={() => inputRef.current?.click()}
      >
        {/* 파일 없으면 안내문, 있으면 파일 리스트 */}
        {files.length === 0 ? (
          <div className="text-lg text-gray-400">이미지 파일을 여기에 드래그하거나 클릭하세요</div>
        ) : (
          <div>
            {files.map(f => (
              <div key={f.name + f.size} className="text-sm">{f.name}</div>
            ))}
          </div>
        )}
        {/* 실제 파일 선택 input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleSelect}
        />
      </div>
      {/* 하단 버튼 */}
      <div className="flex gap-2 justify-end">
        <button className="px-4 py-2 bg-gray-200 rounded" onClick={onClose} disabled={loading}>취소</button>
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
