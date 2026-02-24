// =============================================
// File: app/components/image/ImageUploadModal.tsx
// (요청 4MB 제한 우회: 배치(분할) 업로드)
// =============================================
'use client';

/**
 * 이미지·영상 업로드 모달
 * - 클릭/드래그로 파일 선택, 중복 자동 제거(이름+사이즈 기준)
 * - ✅ 업로드 시 "요청 바디 4MB 제한"을 피하기 위해 파일을 배치로 쪼개 업로드
 */

import { useRef, useState } from "react";
import { ModalCard } from "@/components/common/Modal";

type ImageFile = {
  id: number;
  name: string;
  url: string;
  folder_id: number;
  mime_type?: string | null;
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

/**
 * 요청 바디 제한(약 4MB)을 피하기 위한 "안전 배치 크기"
 * - 멀티파트 오버헤드/헤더 등을 고려해 4MB보다 여유 있게 잡는 게 안전함.
 */
const MAX_BATCH_BYTES = 3.5 * 1024 * 1024; // 3.5MB (필요하면 3.0~3.8로 조절)

/** 단일 파일이 너무 크면(요청 자체가 막힘) 미리 차단/안내할 임계치 */
const SINGLE_FILE_LIMIT_BYTES = 3.9 * 1024 * 1024; // 3.9MB (오버헤드 고려)

export default function ImageUploadModal({ open, onClose, folderId, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progressText, setProgressText] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  /** 허용 확장자 (이미지/영상만) */
  const acceptFile = (f: File) => f.type.startsWith('image/') || f.type.startsWith('video/');

  /** 파일 배열을 병합(이름+사이즈 중복 제거) */
  const addFiles = (incoming: File[]) => {
    const merged = incoming.filter(acceptFile);
    setFiles(prev => [
      ...prev,
      ...merged.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))
    ]);
  };

  /** 파일 선택(input) */
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  /** 드래그&드롭 */
  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  /** 선택 파일 제거 */
  const handleRemove = (f: File) => {
    setFiles(prev => prev.filter(p => !(p.name === f.name && p.size === f.size)));
  };

  /** 모두 비우기 */
  const handleClear = () => setFiles([]);

  /** files를 "요청 크기 제한"에 맞춰 배치로 쪼개기 */
  const buildBatches = (list: File[]) => {
    const batches: File[][] = [];
    let cur: File[] = [];
    let curBytes = 0;

    for (const f of list) {
      // 파일 하나가 너무 크면 배치로도 해결 안 됨 → 안내 대상으로 남겨둠
      if (f.size > SINGLE_FILE_LIMIT_BYTES) {
        // 큰 파일은 단독 배치로 넣어도 결국 요청에서 막힐 수 있으므로,
        // 여기서는 업로드 전에 별도로 경고/중단 처리할 거라 일단 그대로 넣음.
        batches.push([f]);
        continue;
      }

      // 현재 배치에 추가하면 초과? 그럼 배치 확정하고 새 배치 시작
      if (cur.length > 0 && curBytes + f.size > MAX_BATCH_BYTES) {
        batches.push(cur);
        cur = [f];
        curBytes = f.size;
        continue;
      }

      // 배치에 추가
      cur.push(f);
      curBytes += f.size;
    }

    if (cur.length) batches.push(cur);
    return batches;
  };

  /** 단일 배치 업로드 */
  const uploadBatch = async (batch: File[], batchIndex: number, batchCount: number) => {
    if (!folderId) throw new Error("업로드할 폴더를 선택하세요.");

    // 단일 파일이 큰 경우(실제 제한은 플랫폼/프록시 따라 다름)
    // 이 요청은 서버에 도달하기 전에 막힐 가능성이 높아서, 미리 안내하고 중단하는 게 UX가 좋음.
    if (batch.length === 1 && batch[0].size > SINGLE_FILE_LIMIT_BYTES) {
      throw new Error(
        `파일이 너무 큽니다: ${batch[0].name} (${formatSize(batch[0].size)})\n` +
        `현재 환경에서 요청 크기 제한(약 4MB) 때문에 업로드가 막힐 수 있어요.\n` +
        `- 해결: 파일 자체를 4MB 미만으로 줄이거나, S3 직업로드(프리사인) 방식으로 전환이 필요합니다.`
      );
    }

    setProgressText(`업로드 중... (${batchIndex + 1}/${batchCount})`);

    const form = new FormData();
    batch.forEach(f => form.append("files", f));
    form.append("folder_id", String(folderId));

    const res = await fetch("/api/image/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || "업로드 실패");
    }

    return (data.images as ImageFile[]) || [];
  };

  /** 업로드 실행 (배치로 분할 업로드) */
  const handleUpload = async () => {
    if (!files.length) return;
    if (!folderId) {
      alert("업로드할 폴더를 선택하세요.");
      return;
    }

    setLoading(true);
    setProgressText("");

    try {
      const batches = buildBatches(files);
      const allUploaded: ImageFile[] = [];

      for (let i = 0; i < batches.length; i++) {
        const imgs = await uploadBatch(batches[i], i, batches.length);
        allUploaded.push(...imgs);
      }

      // 성공 처리
      setFiles([]);
      setProgressText("");
      if (inputRef.current) inputRef.current.value = "";

      if (allUploaded.length) onUploaded(allUploaded);
      onClose();
    } catch (err: any) {
      setProgressText("");
      alert(err?.message || "네트워크 오류로 업로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="이미지·영상 업로드"
      width={520}
    >
      <label
        htmlFor="rd-upload-input"
        className={`custum-file-upload ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={handleDrop}
      >
        <div className="icon" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M10 1c-.265 0-.52.105-.707.293L3.293 7.293A1 1 0 003 8v12a3 3 0 003 3h1a1 1 0 100-2H6a1 1 0 01-1-1V9h5a1 1 0 001-1V3h7a1 1 0 011 1v5a1 1 0 102 0V4a3 3 0 00-3-3h-8zM9 7H6.414L9 4.414V7zm5 8.5A2.5 2.5 0 0116.5 13 2.5 2.5 0 0119 15.5V17h1a2 2 0 110 4h-7a2 2 0 110-4h1v-1.5zM16.5 11a4.5 4.5 0 00-4.484 4.122C10.283 15.56 9 17.13 9 19a4 4 0 004 4h7a4 4 0 000-8h-.016A4.5 4.5 0 0016.5 11z" />
          </svg>
        </div>
        <div className="text">
          <span>클릭 또는 드래그하여 이미지/영상 업로드</span>
        </div>
        <input
          id="rd-upload-input"
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
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
            <button className="rd-btn secondary" onClick={handleClear} disabled={loading}>전체 비우기</button>
          </div>
        </div>
      )}

      {!!progressText && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          {progressText}
        </div>
      )}

      <div className="rd-card-button-wrapper" style={{ justifyContent: "flex-end" }}>
        <button className="rd-btn secondary" onClick={onClose} disabled={loading}>취소</button>
        <button
          className="rd-btn primary"
          onClick={handleUpload}
          disabled={loading || !files.length || !folderId}
        >
          {loading ? "업로드 중..." : "업로드"}
        </button>
      </div>
    </ModalCard>
  );
}