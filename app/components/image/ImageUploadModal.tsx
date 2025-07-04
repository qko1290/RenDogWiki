import { useRef, useState } from "react";
import Modal from "@/components/common/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  folderId: number | null;
  onUploaded: (images: any[]) => void;
};

export default function ImageUploadModal({ open, onClose, folderId, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev =>
        [...prev, ...newFiles.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))]
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev =>
        [...prev, ...newFiles.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))]
      );
    }
  };

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
      onUploaded(data.images);
      onClose();
    } else {
      alert(data.error || "업로드 실패");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="이미지 업로드">
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
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleSelect}
        />
      </div>
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
