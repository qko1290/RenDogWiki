// =============================================
// File: app/components/image/ImageUploadModal.tsx
// =============================================
import { useRef, useState } from "react";
import { ModalCard } from "@/components/common/Modal";

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
  onUploaded: (images: ImageFile[]) => void;
};

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImageUploadModal({ open, onClose, folderId, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => {
    setFiles(prev => [
      ...prev,
      ...incoming.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))
    ]);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleRemove = (f: File) => {
    setFiles(prev => prev.filter(p => !(p.name === f.name && p.size === f.size)));
  };

  const handleClear = () => setFiles([]);

  const handleUpload = async () => {
    if (!files.length || !folderId) return;
    setLoading(true);
    const form = new FormData();
    files.forEach(f => form.append("files", f));
    form.append("folder_id", String(folderId));

    const res = await fetch("/api/image/upload", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded(data.images);
      onClose();
    } else {
      alert(data.error || "업로드 실패");
    }
  };

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="이미지 업로드"
      width={520}   // 필요시 조절
    >
      <label
        htmlFor="rd-upload-input"
        className={`custum-file-upload ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={handleDrop}
      >
        <div className="icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M10 1c-.265 0-.52.105-.707.293L3.293 7.293A1 1 0 003 8v12a3 3 0 003 3h1a1 1 0 100-2H6a1 1 0 01-1-1V9h5a1 1 0 001-1V3h7a1 1 0 011 1v5a1 1 0 102 0V4a3 3 0 00-3-3h-8zM9 7H6.414L9 4.414V7zm5 8.5A2.5 2.5 0 0116.5 13 2.5 2.5 0 0119 15.5V17h1a2 2 0 110 4h-7a2 2 0 110-4h1v-1.5zM16.5 11a4.5 4.5 0 00-4.484 4.122C10.283 15.56 9 17.13 9 19a4 4 0 004 4h7a4 4 0 000-8h-.016A4.5 4.5 0 0016.5 11z" />
          </svg>
        </div>
        <div className="text">
          <span>클릭 또는 드래그하여 이미지 업로드</span>
        </div>
        <input
          id="rd-upload-input"
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleSelect}
        />
      </label>

      {!!files.length && (
        <div className="rd-upload-filelist">
          {files.map(f => (
            <div key={f.name + f.size} className="rd-upload-file">
              <div className="name" title={f.name}>{f.name}</div>
              <div className="size">{formatSize(f.size)}</div>
              <button className="remove" onClick={() => handleRemove(f)} aria-label="제거">✕</button>
            </div>
          ))}
          <div className="rd-upload-tools">
            <button className="rd-btn secondary" onClick={handleClear}>전체 비우기</button>
          </div>
        </div>
      )}

      <div className="rd-card-button-wrapper" style={{ justifyContent: "flex-end" }}>
        <button className="rd-btn secondary" onClick={onClose} disabled={loading}>취소</button>
        <button
          className="rd-btn primary"
          onClick={handleUpload}
          disabled={loading || !files.length}
        >
          {loading ? "업로드 중..." : "업로드"}
        </button>
      </div>
    </ModalCard>
  );
}
