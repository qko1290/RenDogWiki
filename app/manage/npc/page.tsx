// =============================================
// File: app/manage/npc/page.tsx
// =============================================

/**
 * NPC 관리 메인 페이지
 * - 마을(Village) 목록, NPC 목록, NPC 상세정보(사진/위치/대사) 편집
 * - 마을/아이콘/순서/추가/수정/Drag&Drop, NPC 정보 추가/수정/정렬 등 지원
 * - 모든 상태 관리 및 API 연동, 각종 입력/모달 처리
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import Modal from "@/components/common/Modal";
import WikiHeader from "@/components/common/Header";
import ImageSelectModal from "@/components/image/ImageSelectModal";
import '@/wiki/css/npc-manager.css';

// DnD(드래그&드롭) 라이브러리 import
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 타입 선언: 마을 및 NPC 정보
 */
type Village = {
  id: number;
  name: string;        // 마을 이름(이모지/이미지 포함)
  icon: string;        // 아이콘(이모지/이미지 URL)
  order: number;       // 리스트 정렬용
};
type Npc = {
  id: number;
  name: string;        // NPC 이름
  village_id: number;  // 소속 마을 id
  icon: string;        // 아이콘(이모지/이미지 URL)
  order: number;       // 정렬
  reward: string | null;       // 보상 설명(사용 안함)
  reward_icon: string | null;  // 보상 아이콘(사용 안함)
  requirement: string | null;  // 요구조건(사용 안함)
  line: string | null;         // 대사(설명)
  location_x: number;          // 위치 X
  location_y: number;          // 위치 Y
  location_z: number;          // 위치 Z
  quest: string;               // 연동 퀘스트명(사용 안함)
  npc_type: string;            // 유형(일반/기타)
  pictures?: string[];         // 사진 리스트(URL)
};

/** URL이 이미지인지 체크 (이모지/URL 구분용) */
const isImageUrl = (url: string) => url.startsWith('http');

/**
 * NPC/마을 전체 관리 컴포넌트
 */
export default function NpcManager() {
  // ----- 공통 상태 -----
  const [user, setUser] = useState<any>(null);

  // 마을 및 NPC 상태
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
  const [npcList, setNpcList] = useState<Npc[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);

  // 모달/입력값 통합 관리
  const [modal, setModal] = useState({
    village: false,      // 마을 추가
    npc: false,          // NPC 추가
    editName: false,     // 이름 수정
    editIcon: false,     // 아이콘(이모지/이미지) 수정
    editLoc: false,      // 위치 수정
    editLine: false,     // 대사 수정
    pictures: false,     // 사진 리스트 관리
    addPicture: false,   // 사진 추가(선택)
    imageSelect: false,  // 마을 아이콘 이미지 선택
  });
  const [villageName, setVillageName] = useState('');
  const [villageIcon, setVillageIcon] = useState('');
  const [npcName, setNpcName] = useState('');
  const [tmpName, setTmpName] = useState('');
  const [tmpLoc, setTmpLoc] = useState<[number, number, number]>([0, 0, 0]);
  const [tmpLine, setTmpLine] = useState('');
  const [npcPictures, setNpcPictures] = useState<string[]>([]);

  // DnD 센서 (마우스 드래그)
  const sensors = useSensors(useSensor(PointerSensor));

  // ----- 유저 정보 로딩 -----
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user ?? null));
  }, []);

  // ----- 마을 목록 로딩 -----
  useEffect(() => {
    fetch("/api/villages")
      .then(res => res.json())
      .then(data => setVillages(Array.isArray(data) ? data : []));
  }, []);

  // ----- NPC 목록 (마을 선택시만) -----
  useEffect(() => {
    if (selectedVillage) {
      fetch(`/api/npcs?village_id=${selectedVillage.id}`)
        .then(res => res.json())
        .then(data => setNpcList(Array.isArray(data) ? data : []));
      setSelectedNpc(null);
    } else {
      setNpcList([]); setSelectedNpc(null);
    }
  }, [selectedVillage]);

  // ----- NPC 선택시 임시 입력값/사진 초기화 -----
  useEffect(() => {
    if (!selectedNpc) return;
    setTmpName(selectedNpc.name);
    setTmpLoc([selectedNpc.location_x, selectedNpc.location_y, selectedNpc.location_z]);
    setTmpLine(selectedNpc.line || "");
    setNpcPictures(Array.isArray(selectedNpc.pictures) ? selectedNpc.pictures : []);
  }, [selectedNpc]);

  // ----- 모달 open/close 헬퍼 -----
  const closeModal = useCallback((key: keyof typeof modal) => setModal(m => ({ ...m, [key]: false })), []);
  const openModal = useCallback((key: keyof typeof modal) => setModal(m => ({ ...m, [key]: true })), []);

  // ----- 마을 추가 -----
  const handleAddVillage = async () => {
    const maxOrder = villages.length ? Math.max(...villages.map(v => v.order)) : 0;
    await fetch("/api/villages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: villageName, icon: villageIcon, order: maxOrder + 1 }),
    });
    fetch("/api/villages")
      .then(res => res.json())
      .then(data => setVillages(Array.isArray(data) ? data : []));
    setVillageName('');
    setVillageIcon('');
    closeModal('village');
  };

  // ----- NPC 추가 -----
  const handleAddNpc = async () => {
    if (!selectedVillage) return;
    const maxOrder = npcList.length ? Math.max(...npcList.map(n => n.order)) : 0;
    await fetch("/api/npcs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: npcName, village_id: selectedVillage.id, icon: "😀",
        order: maxOrder + 1, reward: null, reward_icon: null,
        requirement: null, line: null, location_x: 0, location_y: 0, location_z: 0,
        quest: "", npc_type: "normal"
      }),
    });
    fetch(`/api/npcs?village_id=${selectedVillage.id}`)
      .then(res => res.json())
      .then(data => setNpcList(Array.isArray(data) ? data : []));
    setNpcName('');
    closeModal('npc');
  };

  /**
   * NPC 정보 patch (부분 수정)
   * @param fields 변경할 필드만 전달(병합)
   */
  const patchNpc = async (fields: Partial<Npc>) => {
    if (!selectedNpc) return;
    await fetch(`/api/npcs/${selectedNpc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selectedNpc, ...fields }),
    });
    // 목록/선택 갱신
    if (selectedVillage) {
      const updated = await fetch(`/api/npcs?village_id=${selectedVillage.id}`).then(r => r.json());
      setNpcList(Array.isArray(updated) ? updated : []);
      const newSel = Array.isArray(updated) ? updated.find((n: Npc) => n.id === selectedNpc.id) : null;
      if (newSel) setSelectedNpc(newSel);
    }
  };

  /**
   * DnD NPC 리스트 아이템 컴포넌트
   * - 순서, 드래그 핸들, 아이콘(이모지/이미지) 지원
   */
  function SortableNpcItem({ npc, selected, onClick }: {
    npc: Npc;
    selected: Npc | null;
    onClick: () => void;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: npc.id });
    return (
      <li
        ref={setNodeRef}
        className={[
          "npc-list-item",
          isDragging ? "dragging" : "",
          selected?.id === npc.id ? "selected" : ""
        ].join(" ")}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        onClick={e => { if (!(e.target as HTMLElement).closest(".drag-handle")) onClick(); }}
      >
        <span className="drag-handle" {...listeners} title="순서 변경" onClick={e => e.stopPropagation()}>⠿</span>
        <span className="npc-list-order">{npc.order}.</span>
        {isImageUrl(npc.icon)
          ? <img className="npc-list-icon-img" src={npc.icon} alt="icon" />
          : <span className="npc-list-icon-emoji">{npc.icon}</span>
        }
        <span className="npc-list-name">{npc.name}</span>
      </li>
    );
  }

  /**
   * DnD 드래그 완료시 NPC 순서 reorder & DB 반영
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = npcList.findIndex(n => n.id === active.id);
    const newIndex = npcList.findIndex(n => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newList = arrayMove(npcList, oldIndex, newIndex).map((n, idx) => ({ ...n, order: idx + 1 }));
    setNpcList(newList);
    for (const n of newList) {
      await fetch(`/api/npcs/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...n }),
      });
    }
  };

  // 정렬용 memo
  const sortedVillages = useMemo(() => [...villages].sort((a, b) => a.order - b.order), [villages]);
  const sortedNpcList = useMemo(() => [...npcList].sort((a, b) => a.order - b.order), [npcList]);

  // ============================================================
  // 렌더링: 마을(좌), NPC리스트(중앙), NPC상세(우), 각종 모달 포함
  // ============================================================
  return (
    <>
      <WikiHeader user={user} />

      {/* ===== 마을 추가 모달 ===== */}
      <Modal open={modal.village} onClose={() => closeModal('village')} title="마을 추가" width="370px">
        <div className="npc-modal-body">
          <div>
            <label className="npc-modal-label">마을 이름</label>
            <input className="npc-modal-input" placeholder="마을 이름" maxLength={40}
              value={villageName} onChange={e => setVillageName(e.target.value)} />
          </div>
          <div>
            <label className="npc-modal-label">마을 아이콘</label>
            <div className="npc-modal-icon-input-row">
              {/* 이모지 or 이미지 URL (둘 중 하나만 입력) */}
              <input className="npc-modal-emoji-input" placeholder="🏘️" maxLength={2}
                value={villageIcon && !isImageUrl(villageIcon) ? villageIcon : ''}
                onChange={e => setVillageIcon(e.target.value)} />
              <span className="npc-modal-icon-sep">또는</span>
              <button className="npc-modal-image-btn" onClick={() => openModal('imageSelect')}>이미지 선택</button>
              {isImageUrl(villageIcon) && (
                <img src={villageIcon} className="npc-modal-preview-icon" alt="icon" />
              )}
            </div>
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => closeModal('village')}>취소</button>
            <button className="npc-modal-submit-btn"
              disabled={!villageName.trim() || !villageIcon.trim()}
              onClick={handleAddVillage}>추가</button>
          </div>
        </div>
        <ImageSelectModal
          open={modal.imageSelect}
          onClose={() => closeModal('imageSelect')}
          onSelectImage={url => { setVillageIcon(url); closeModal('imageSelect'); }}
        />
      </Modal>

      {/* ===== NPC 추가 모달 ===== */}
      <Modal open={modal.npc} onClose={() => closeModal('npc')} title="NPC 추가" width="370px">
        <div className="npc-modal-body">
          <div>
            <label className="npc-modal-label">NPC 이름</label>
            <input className="npc-modal-input" placeholder="NPC 이름" maxLength={40}
              value={npcName} onChange={e => setNpcName(e.target.value)} />
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => closeModal('npc')}>취소</button>
            <button className="npc-modal-submit-btn"
              disabled={!npcName.trim()} onClick={handleAddNpc}>추가</button>
          </div>
        </div>
      </Modal>

      {/* ===== 이름/아이콘/위치/대사/사진 관리 모달 ===== */}
      <Modal open={modal.editName} onClose={() => closeModal('editName')} title="이름 수정" width="350px">
        <div className="npc-modal-body">
          <input className="npc-modal-input" maxLength={40} value={tmpName}
            onChange={e => setTmpName(e.target.value)} />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => closeModal('editName')}>취소</button>
            <button className="npc-modal-submit-btn"
              disabled={!tmpName.trim()}
              onClick={async () => { await patchNpc({ name: tmpName }); closeModal('editName'); }}>수정</button>
          </div>
        </div>
      </Modal>
      <ImageSelectModal
        open={modal.editIcon}
        onClose={() => closeModal('editIcon')}
        onSelectImage={async (url) => { await patchNpc({ icon: url }); closeModal('editIcon'); }}
      />
      <Modal open={modal.editLoc} onClose={() => closeModal('editLoc')} title="위치 수정" width="350px">
        <div className="npc-modal-body">
          <div className="npc-modal-loc-row">
            {/* X/Y/Z 위치 입력 */}
            {["X", "Y", "Z"].map((label, idx) => (
              <div key={label} className="npc-modal-loc-col">
                <div className="npc-modal-loc-label">{label}</div>
                <input type="number" className="npc-modal-input" value={tmpLoc[idx]}
                  onChange={e => {
                    const copy = [...tmpLoc] as [number, number, number];
                    copy[idx] = Number(e.target.value);
                    setTmpLoc(copy);
                  }} />
              </div>
            ))}
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => closeModal('editLoc')}>취소</button>
            <button className="npc-modal-submit-btn"
              onClick={async () => { await patchNpc({ location_x: tmpLoc[0], location_y: tmpLoc[1], location_z: tmpLoc[2] }); closeModal('editLoc'); }}>수정</button>
          </div>
        </div>
      </Modal>
      <Modal open={modal.editLine} onClose={() => closeModal('editLine')} title="대사 수정" width="420px">
        <div className="npc-modal-body">
          <textarea className="npc-modal-input" style={{ minHeight: 100, resize: "vertical" }}
            value={tmpLine} onChange={e => setTmpLine(e.target.value)} maxLength={600} />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => closeModal('editLine')}>취소</button>
            <button className="npc-modal-submit-btn"
              onClick={async () => { await patchNpc({ line: tmpLine }); closeModal('editLine'); }}>수정</button>
          </div>
        </div>
      </Modal>
      <Modal open={modal.pictures} onClose={() => closeModal('pictures')} title="NPC 사진 관리" width="420px">
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {npcPictures.length === 0 && <span style={{ color: "#bbb" }}>등록된 사진이 없습니다.</span>}
            {npcPictures.map((url, idx) => (
              <div key={url + idx} style={{ position: "relative" }}>
                <img src={url} alt={`npc-pic-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #ccc" }} />
                <button
                  onClick={() => setNpcPictures(npcPictures.filter((_, i) => i !== idx))}
                  style={{ position: "absolute", top: -8, right: -8, border: "none", background: "#fff", borderRadius: "50%", width: 24, height: 24, boxShadow: "0 1px 4px #0002", cursor: "pointer" }}
                  title="삭제"
                >✕</button>
              </div>
            ))}
          </div>
          <div style={{ margin: "18px 0 8px" }}>
            <button className="npc-modal-image-btn" onClick={() => openModal('addPicture')}>+ 사진 추가</button>
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => closeModal('pictures')}>닫기</button>
            <button className="npc-modal-submit-btn"
              disabled={!selectedNpc}
              onClick={async () => { await patchNpc({ pictures: npcPictures }); closeModal('pictures'); }}>저장</button>
          </div>
        </div>
        {/* 실제 이미지 선택 모달 */}
        <ImageSelectModal
          open={modal.addPicture}
          onClose={() => closeModal('addPicture')}
          onSelectImage={url => {
            if (!npcPictures.includes(url)) setNpcPictures([...npcPictures, url]);
            closeModal('addPicture');
          }}
        />
      </Modal>

      {/* ===================================================== */}
      {/* === 메인 UI: 좌(마을) - 중앙(NPC) - 우(상세) === */}
      {/* ===================================================== */}
      <div className="npc-manager-container">
        {/* --- 마을 목록(좌측) --- */}
        <div className="npc-sidebar">
          <div className="npc-sidebar-header">
            <h3>마을 목록</h3>
            <button className="npc-sidebar-add-btn" onClick={() => openModal('village')}>+ 마을 추가</button>
          </div>
          <ul className="npc-village-list">
            {sortedVillages.map(v =>
              <li key={v.id} className={`npc-village-item${selectedVillage?.id === v.id ? " selected" : ""}`}
                onClick={() => setSelectedVillage(v)}>
                <span className="npc-village-icon">
                  {isImageUrl(v.icon)
                    ? <img src={v.icon} alt="icon" />
                    : <span className="npc-village-emoji">{v.icon}</span>}
                </span>
                {v.name}
              </li>
            )}
          </ul>
        </div>
        {/* --- NPC 리스트(중앙) --- */}
        <div className="npc-list-area">
          <div className="npc-list-header-row">
            <h3 className="npc-list-header">
              {selectedVillage ? `${selectedVillage.name} NPC` : "NPC 목록"}
            </h3>
            <button className="npc-sidebar-add-btn"
              disabled={!selectedVillage}
              onClick={() => openModal('npc')}
              title={selectedVillage ? "" : "마을을 먼저 선택하세요"}
            >+ NPC 추가</button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedNpcList.map(n => n.id)} strategy={verticalListSortingStrategy}>
              <ul className="npc-list">
                {sortedNpcList.map(n =>
                  <SortableNpcItem key={n.id} npc={n} selected={selectedNpc} onClick={() => setSelectedNpc(n)} />
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
        {/* --- NPC 상세정보(우측) --- */}
        <div className="npc-detail-area">
          {selectedNpc ? (
            <div>
              <div className="npc-detail-title">
                {isImageUrl(selectedNpc.icon)
                  ? <img src={selectedNpc.icon} alt="아이콘" className="npc-detail-img"
                      title="아이콘(이미지/이모지) 변경" onClick={() => openModal('editIcon')} />
                  : <span className="npc-detail-icon"
                      title="아이콘(이미지/이모지) 변경"
                      onClick={() => openModal('editIcon')}>{selectedNpc.icon}</span>
                }
                <span className="npc-detail-name">{selectedNpc.name}</span>
                <button className="npc-detail-edit-btn"
                  onClick={() => openModal('editName')} title="이름 수정">✏️</button>
              </div>
              <div className="npc-detail-block">
                {/* 사진 관리 */}
                <div style={{ marginBottom: 14 }}>
                  <span className="npc-detail-label" style={{ fontWeight: 500 }}>사진:</span>
                  <button className="npc-detail-edit-btn" style={{ marginLeft: 10, fontSize: 14 }}
                    onClick={() => openModal('pictures')}>관리</button>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {npcPictures.length === 0
                      ? <span style={{ color: "#bbb", fontSize: 13 }}>사진 없음</span>
                      : npcPictures.map((pic, idx) =>
                        <img key={pic + idx} src={pic} alt={`npc-pic-${idx}`}
                          style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', border: "1px solid #ddd" }} />
                      )
                    }
                  </div>
                </div>
              </div>
              <div className="npc-detail-block">
                <span className="npc-detail-label">
                  <button className="npc-detail-edit-btn" onClick={() => openModal('editLoc')} title="위치 수정">✏️</button>
                  위치:
                </span>
                &nbsp; ( {selectedNpc.location_x}, {selectedNpc.location_y}, {selectedNpc.location_z} )
                <br />
                <span className="npc-detail-label">
                  <button className="npc-detail-edit-btn" onClick={() => openModal('editLine')} title="대사 수정">✏️</button>
                  대사:
                </span>
                <div className="npc-detail-line">{selectedNpc.line || "-"}</div>
              </div>
            </div>
          ) : (
            <div className="npc-detail-empty">NPC를 선택하세요.</div>
          )}
        </div>
      </div>
    </>
  );
}
