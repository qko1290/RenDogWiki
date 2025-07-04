import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";

type Props = {
  parentId: number | null;
  onCreated?: (folder: any) => void;
  className?: string;
  forceOpen?: boolean; // 추가!
};

export default function CreateFolder({ parentId, onCreated, className, forceOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // forceOpen이 true로 바뀌면 자동 오픈
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

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
      setOpen(false);
      setFolderName("");
      setLoading(false);
      if (onCreated) onCreated(data.folder);
    } catch (err) {
      setError("서버 오류");
      setLoading(false);
    }
  };

  return (
    <>
      {!forceOpen && ( // forceOpen이 아니면만 버튼 노출 (툴바 버튼용)
        <button className={className ?? "image-explorer-btn"} onClick={() => setOpen(true)}>
          폴더 생성
        </button>
      )}
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
