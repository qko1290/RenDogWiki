'use client';

/**
 * 퀘스트 NPC(마을별) 관리 페이지
 * - 마을별 퀘스트 NPC를 추가/정렬/수정/삭제/사진/보상/선행퀘 등 전부 관리
 * - 드래그&드롭 정렬, 보상/사진 등 리스트형 속성도 지원
 * - 모든 상태와 모달/서버연동 UI를 한 곳에서 통합 관리 (코어 파일)
 * - 유지보수와 확장성, 협업을 위한 설명 주석 포함 (실전용 가이드)
 */

import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";
import WikiHeader from "@/components/common/Header";
import ImageSelectModal from "@/components/image/ImageSelectModal";
import '@/wiki/css/npc-manager.css';
import '@/wiki/css/quest-manager.css';

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/** --- 데이터 타입 정의 --- */
type Village = {
  id: number;
  name: string;
  icon: string;  // 이모지 or 이미지 url
  order: number;
};
type QuestReward = { icon: string; text: string };
type Npc = {
  id: number;
  name: string;
  village_id: number;
  icon: string; // 이모지 or url
  order: number;
  rewards?: QuestReward[]; // 보상 리스트
  requirement: string | null; // 선행퀘
  line: string | null;        // 대사
  location_x: number;
  location_y: number;
  location_z: number;
  quest: string;              // 퀘스트 설명
  npc_type: string;           // "quest"
  pictures?: string[];        // NPC 사진 리스트
};
type SortableNpcItemProps = { npc: Npc; selected: Npc | null; onClick: () => void; };

/** --- 메인 컴포넌트 --- */
export default function QuestNpcManager() {
  /** [상단: 로그인/유저 정보] */
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user ?? null));
  }, []);

  /** [마을/퀘스트 목록 등 메인 상태] */
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);

  const [npcList, setNpcList] = useState<Npc[]>([]);  // 현재 마을의 퀘스트 npc 목록
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);

  /** [모달/입력 상태] */
  const [villageModalOpen, setVillageModalOpen] = useState(false);
  const [villageName, setVillageName] = useState('');
  const [villageIcon, setVillageIcon] = useState<string>('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [npcName, setNpcName] = useState('');

  // 각 항목 편집 모달
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editIconOpen, setEditIconOpen] = useState(false);
  const [editLocOpen, setEditLocOpen] = useState(false);
  const [editLineOpen, setEditLineOpen] = useState(false);
  const [editQuestOpen, setEditQuestOpen] = useState(false);
  const [editRewardOpen, setEditRewardOpen] = useState(false);
  const [editRequirementOpen, setEditRequirementOpen] = useState(false);

  // 임시입력값(모달에서 쓰는 값들)
  const [tmpName, setTmpName] = useState('');
  const [tmpLoc, setTmpLoc] = useState<[number, number, number]>([0, 0, 0]);
  const [tmpLine, setTmpLine] = useState('');
  const [tmpQuest, setTmpQuest] = useState('');
  const [tmpRewards, setTmpRewards] = useState<QuestReward[]>([]);
  const [editRewardImgModalIdx, setEditRewardImgModalIdx] = useState<number | null>(null);
  const [tmpRequirement, setTmpRequirement] = useState('');

  // 사진 관리
  const [npcPictures, setNpcPictures] = useState<string[]>([]);
  const [picturesModalOpen, setPicturesModalOpen] = useState(false);
  const [addPictureModalOpen, setAddPictureModalOpen] = useState(false);

  // dnd-kit용 센서
  const sensors = useSensors(useSensor(PointerSensor));

  /** [초기화: 마을/퀘스트 로딩] */
  useEffect(() => {
    fetch("/api/villages")
      .then(res => res.json())
      .then(data => setVillages(data));
  }, []);
  useEffect(() => {
    if (selectedVillage) {
      fetch(`/api/npcs?village_id=${selectedVillage.id}&npc_type=quest`)
        .then(res => res.json())
        .then(data => setNpcList(Array.isArray(data) ? data : []));
      setSelectedNpc(null);
    } else {
      setNpcList([]); setSelectedNpc(null);
    }
  }, [selectedVillage]);

  /** [NPC(퀘스트) 추가] */
  const handleAddNpc = async () => {
    if (!selectedVillage) return;
    const maxOrder = npcList.length ? Math.max(...npcList.map(n => n.order)) : 0;
    await fetch("/api/npcs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: npcName,
        village_id: selectedVillage.id,
        icon: "📜",
        order: maxOrder + 1,
        reward: null,
        reward_icon: null,
        requirement: null,
        line: null,
        location_x: 0, location_y: 0, location_z: 0,
        quest: "",
        npc_type: "quest",
      }),
    });
    fetch(`/api/npcs?village_id=${selectedVillage.id}&npc_type=quest`)
      .then(res => res.json())
      .then(data => setNpcList(Array.isArray(data) ? data : []));
    setNpcModalOpen(false);
    setNpcName('');
  };

  /** [NPC(퀘스트) 정보 일부 수정 - 모든 편집 모달에서 공용 사용] */
  const patchNpc = async (fields: Partial<Npc>) => {
    if (!selectedNpc) return;
    const res = await fetch(`/api/npcs/${selectedNpc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...selectedNpc,
        ...fields,
        npc_type: "quest",
      }),
    });
    if (res.ok && selectedVillage) {
      fetch(`/api/npcs?village_id=${selectedVillage.id}&npc_type=quest`)
        .then(res => res.json())
        .then(data => {
          setNpcList(Array.isArray(data) ? data : []);
          setSelectedNpc(data.find((n: Npc) => n.id === selectedNpc.id) || null);
        });
    }
  };

  /** [NPC 선택시 모달 임시입력값 초기화] */
  useEffect(() => {
    if (selectedNpc) {
      setTmpName(selectedNpc.name);
      setTmpLoc([selectedNpc.location_x, selectedNpc.location_y, selectedNpc.location_z]);
      setTmpLine(selectedNpc.line || "");
      setTmpQuest(selectedNpc.quest || "");
      setTmpRewards(Array.isArray(selectedNpc.rewards) ? selectedNpc.rewards : []);
      setTmpRequirement(selectedNpc.requirement || "");
      setNpcPictures(Array.isArray(selectedNpc.pictures) ? selectedNpc.pictures : []);
    }
  }, [selectedNpc]);

  /** [DnD: 리스트 아이템 정의 - 핸들/드래그 스타일/선택 강조] */
  function SortableNpcItem({ npc, selected, onClick }: SortableNpcItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: npc.id });
    const itemClass = [
      "npc-list-item",
      isDragging ? "dragging" : "",
      selected?.id === npc.id ? "selected" : "",
    ].join(" ");
    return (
      <li
        ref={setNodeRef}
        className={itemClass}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        onClick={e => {
          if ((e.target as HTMLElement).closest(".drag-handle")) return;
          onClick();
        }}
      >
        <span className="drag-handle" {...listeners} title="순서 변경" onClick={e => e.stopPropagation()}>⠿</span>
        <span className="npc-list-order">{npc.order}.</span>
        {npc.icon.startsWith('http')
          ? <img src={npc.icon} className="npc-list-icon-img" alt="icon" />
          : <span className="npc-list-icon-emoji">{npc.icon}</span>
        }
        <span className="npc-list-name">{npc.name}</span>
      </li>
    );
  }

  /** [DnD: 드래그앤드롭 완료시 순서 갱신/DB 반영] */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = npcList.findIndex(n => n.id === active.id);
    const newIndex = npcList.findIndex(n => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newList = arrayMove(npcList, oldIndex, newIndex);
    const newListWithOrder = newList.map((n, idx) => ({ ...n, order: idx + 1 }));
    setNpcList(newListWithOrder);

    for (const n of newListWithOrder) {
      await fetch(`/api/npcs/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n),
      });
    }
  };

  /** [메인 리턴: 전체 UI] */
  return (
    <>
      {/* [상단] 로그인/유저 정보 */}
      <WikiHeader user={user} />

      {/* ---------------- 마을 추가 모달 ---------------- */}
      <Modal open={villageModalOpen}
        onClose={() => { setVillageModalOpen(false); setVillageName(''); setVillageIcon(''); }}
        title="마을 추가" width="370px">
        <div className="npc-modal-body">
          <div>
            <label className="npc-modal-label">마을 이름</label>
            <input className="npc-modal-input" placeholder="마을 이름" maxLength={40} value={villageName}
              onChange={e => setVillageName(e.target.value)} />
          </div>
          <div>
            <label className="npc-modal-label">마을 아이콘</label>
            <div className="npc-modal-icon-input-row">
              <input className="npc-modal-emoji-input" placeholder="🏘️" maxLength={2}
                value={villageIcon && !villageIcon.startsWith('http') ? villageIcon : ''}
                onChange={e => setVillageIcon(e.target.value)} />
              <span className="npc-modal-icon-sep">또는</span>
              <button className="npc-modal-image-btn" onClick={() => setImageModalOpen(true)}>이미지 선택</button>
              {villageIcon && villageIcon.startsWith('http') && (
                <img src={villageIcon} className="npc-modal-preview-icon" alt="icon" />
              )}
            </div>
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setVillageModalOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              disabled={!villageName.trim() || !villageIcon.trim()}
              onClick={async () => {
                const maxOrder = villages.length ? Math.max(...villages.map(v => v.order)) : 0;
                await fetch("/api/villages", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: villageName, icon: villageIcon, order: maxOrder + 1 }),
                });
                fetch("/api/villages")
                  .then(res => res.json())
                  .then(data => setVillages(data));
                setVillageModalOpen(false); setVillageName(''); setVillageIcon('');
              }}
            >추가</button>
          </div>
        </div>
        {/* 이미지/이모지 모달 */}
        <ImageSelectModal open={imageModalOpen} onClose={() => setImageModalOpen(false)}
          onSelectImage={(url) => { setVillageIcon(url); setImageModalOpen(false); }} />
      </Modal>

      {/* ---------------- NPC(퀘스트) 추가 모달 ---------------- */}
      <Modal open={npcModalOpen}
        onClose={() => { setNpcModalOpen(false); setNpcName(''); }}
        title="퀘스트 NPC 추가" width="370px">
        <div className="npc-modal-body">
          <div>
            <label className="npc-modal-label">NPC 이름</label>
            <input className="npc-modal-input" placeholder="NPC 이름" maxLength={40}
              value={npcName} onChange={e => setNpcName(e.target.value)} />
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setNpcModalOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              disabled={!npcName.trim()}
              onClick={handleAddNpc}
            >추가</button>
          </div>
        </div>
      </Modal>

      {/* ---- 각종 편집 모달(이름/아이콘/위치/대사/퀘스트/보상/선행/사진) ---- */}
      {/* (모달 UI 내 편집/저장/취소 동작 주석 생략, 필요시 개별 설명 붙일 수 있음) */}
      <Modal open={editNameOpen} onClose={() => setEditNameOpen(false)} title="이름 수정" width="350px">
        <div className="npc-modal-body">
          <input className="npc-modal-input" maxLength={40} value={tmpName} onChange={e => setTmpName(e.target.value)} />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditNameOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              disabled={!tmpName.trim()}
              onClick={async () => { await patchNpc({ name: tmpName }); setEditNameOpen(false); }}>수정</button>
          </div>
        </div>
      </Modal>
      <ImageSelectModal open={editIconOpen} onClose={() => setEditIconOpen(false)}
        onSelectImage={async (url) => { await patchNpc({ icon: url }); setEditIconOpen(false); }} />
      <Modal open={editLocOpen} onClose={() => setEditLocOpen(false)} title="위치 수정" width="350px">
        <div className="npc-modal-body">
          <div className="npc-modal-loc-row">
            {["X", "Y", "Z"].map((label, idx) => (
              <div key={label} className="npc-modal-loc-col">
                <div className="npc-modal-loc-label">{label}</div>
                <input type="number" className="npc-modal-input"
                  value={tmpLoc[idx]} onChange={e => {
                    const copy = [...tmpLoc] as [number, number, number];
                    copy[idx] = Number(e.target.value); setTmpLoc(copy);
                  }} />
              </div>
            ))}
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditLocOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              onClick={async () => { await patchNpc({ location_x: tmpLoc[0], location_y: tmpLoc[1], location_z: tmpLoc[2] }); setEditLocOpen(false); }}>수정</button>
          </div>
        </div>
      </Modal>
      <Modal open={editLineOpen} onClose={() => setEditLineOpen(false)} title="대사 수정" width="420px">
        <div className="npc-modal-body">
          <textarea className="npc-modal-input quest-detail-textarea"
            value={tmpLine} onChange={e => setTmpLine(e.target.value)} maxLength={600} />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditLineOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              onClick={async () => { await patchNpc({ line: tmpLine }); setEditLineOpen(false); }}>수정</button>
          </div>
        </div>
      </Modal>
      {/* 퀘스트 내용/보상/선행퀘스트/사진 등 편집 모달은 동일 방식 */}
      <Modal open={editQuestOpen} onClose={() => setEditQuestOpen(false)} title="퀘스트 내용 수정" width="420px">
        <div className="npc-modal-body">
          <textarea className="npc-modal-input quest-detail-textarea"
            value={tmpQuest} onChange={e => setTmpQuest(e.target.value)} maxLength={400} />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditQuestOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              onClick={async () => { await patchNpc({ quest: tmpQuest }); setEditQuestOpen(false); }}>수정</button>
          </div>
        </div>
      </Modal>
      <Modal open={editRewardOpen} onClose={() => setEditRewardOpen(false)} title="보상 수정" width="480px">
        <div className="npc-modal-body">
          <label className="npc-modal-label">보상 목록</label>
          {tmpRewards.map((reward, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
              {/* 아이콘(이모지/이미지) */}
              <button style={{
                width: 38, height: 38, border: "1px solid #ddd", borderRadius: 7, background: "#f7f7fa", cursor: "pointer"
              }} onClick={() => setEditRewardImgModalIdx(idx)} title="이미지 선택">
                {reward.icon
                  ? (reward.icon.startsWith("http")
                    ? <img src={reward.icon} style={{ width: 28, height: 28, objectFit: "contain" }} alt="icon" />
                    : <span style={{ fontSize: 22 }}>{reward.icon}</span>
                  )
                  : <span style={{ color: "#bbb" }}>+</span>}
              </button>
              {/* 보상 설명 */}
              <input className="npc-modal-input" placeholder="보상 내용" maxLength={60}
                style={{ flex: 1 }}
                value={reward.text}
                onChange={e => {
                  const copy = tmpRewards.slice();
                  copy[idx].text = e.target.value;
                  setTmpRewards(copy);
                }} />
              {/* 삭제 */}
              <button className="npc-modal-cancel-btn" style={{ fontSize: 19, padding: 4 }}
                onClick={() => setTmpRewards(tmpRewards.filter((_, i) => i !== idx))}>삭제</button>
              {/* 이미지 선택 모달 */}
              {editRewardImgModalIdx === idx && (
                <ImageSelectModal open={true} onClose={() => setEditRewardImgModalIdx(null)}
                  onSelectImage={url => {
                    const copy = tmpRewards.slice();
                    copy[idx].icon = url;
                    setTmpRewards(copy);
                    setEditRewardImgModalIdx(null);
                  }} />
              )}
            </div>
          ))}
          {/* 추가 */}
          <button className="npc-modal-image-btn" style={{ marginTop: 8 }}
            onClick={() => setTmpRewards([...tmpRewards, { icon: "", text: "" }])}>+ 보상 추가</button>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditRewardOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              onClick={async () => { await patchNpc({ rewards: tmpRewards }); setEditRewardOpen(false); }}>수정</button>
          </div>
        </div>
      </Modal>
      <Modal open={editRequirementOpen} onClose={() => setEditRequirementOpen(false)} title="선행퀘스트 수정" width="420px">
        <div className="npc-modal-body">
          <input className="npc-modal-input" value={tmpRequirement} maxLength={200}
            onChange={e => setTmpRequirement(e.target.value)} />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditRequirementOpen(false)}>취소</button>
            <button className="npc-modal-submit-btn"
              onClick={async () => { await patchNpc({ requirement: tmpRequirement }); setEditRequirementOpen(false); }}>수정</button>
          </div>
        </div>
      </Modal>
      {/* 사진 관리 모달 (추가/삭제/썸네일) */}
      <Modal open={picturesModalOpen} onClose={() => setPicturesModalOpen(false)} title="NPC 사진 관리" width="420px">
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {npcPictures.length === 0 && <span style={{ color: "#bbb" }}>등록된 사진이 없습니다.</span>}
            {npcPictures.map((url, idx) => (
              <div key={url + idx} style={{ position: "relative" }}>
                <img src={url} alt={`npc-pic-${idx}`}
                  style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid #ccc" }} />
                <button onClick={() => setNpcPictures(npcPictures.filter((_, i) => i !== idx))}
                  style={{
                    position: "absolute", top: -8, right: -8, border: "none", background: "#fff",
                    borderRadius: "50%", width: 24, height: 24, boxShadow: "0 1px 4px #0002", cursor: "pointer"
                  }}
                  title="삭제">✕</button>
              </div>
            ))}
          </div>
          <div style={{ margin: "16px 0 8px" }}>
            <button className="npc-modal-image-btn" onClick={() => setAddPictureModalOpen(true)}>
              + 사진 추가
            </button>
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setPicturesModalOpen(false)}>닫기</button>
            <button className="npc-modal-submit-btn"
              disabled={!selectedNpc}
              onClick={async () => {
                await patchNpc({ pictures: npcPictures });
                setPicturesModalOpen(false);
              }}>저장</button>
          </div>
        </div>
        <ImageSelectModal open={addPictureModalOpen} onClose={() => setAddPictureModalOpen(false)}
          onSelectImage={(url) => {
            if (!npcPictures.includes(url)) setNpcPictures([...npcPictures, url]);
            setAddPictureModalOpen(false);
          }} />
      </Modal>

      {/* ------------------- 실제 화면 구조 (3단) ------------------- */}
      <div className="npc-manager-container">
        {/* 왼쪽: 마을 리스트 (이모지/이미지) */}
        <div className="npc-sidebar">
          <div className="npc-sidebar-header">
            <h3>마을 목록</h3>
            <button className="npc-sidebar-add-btn" onClick={() => setVillageModalOpen(true)}>
              + 마을 추가
            </button>
          </div>
          <ul className="npc-village-list">
            {villages.sort((a, b) => a.order - b.order).map(v =>
              <li key={v.id} className={`npc-village-item${selectedVillage?.id === v.id ? " selected" : ""}`}
                onClick={() => setSelectedVillage(v)}>
                <span className="npc-village-icon">
                  {v.icon.startsWith('http') ? (<img src={v.icon} alt="icon" />) : (<span className="npc-village-emoji">{v.icon}</span>)}
                </span>
                {v.name}
              </li>
            )}
          </ul>
        </div>
        {/* 가운데: 퀘스트 NPC 리스트 (DnD/추가) */}
        <div className="npc-list-area">
          <div className="npc-list-header-row">
            <h3 className="npc-list-header">
              {selectedVillage ? `${selectedVillage.name} 퀘스트` : "퀘스트 목록"}
            </h3>
            <button className="npc-sidebar-add-btn quest-add-btn"
              disabled={!selectedVillage} onClick={() => setNpcModalOpen(true)}
              title={selectedVillage ? "" : "마을을 먼저 선택하세요"}>
              + 퀘스트 추가
            </button>
          </div>
          {npcList.length === 0 ? (
            <div className="npc-detail-empty">해당 마을에 등록된 퀘스트가 없습니다.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={npcList.map(n => n.id)} strategy={verticalListSortingStrategy}>
                <ul className="npc-list">
                  {npcList
                    .sort((a, b) => a.order - b.order)
                    .map(n =>
                      <SortableNpcItem key={n.id} npc={n} selected={selectedNpc}
                        onClick={() => setSelectedNpc(n)} />
                    )}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
        {/* 오른쪽: 선택 퀘스트 상세/편집 (아이콘, 위치, 대사, 퀘스트, 보상, 사진 등) */}
        <div className="npc-detail-area">
          {selectedNpc ? (
            <div>
              <div className="quest-detail-title-row">
                <span className="quest-detail-icon-box"
                  title="아이콘(이모지/이미지) 변경" onClick={() => setEditIconOpen(true)}>
                  {selectedNpc.icon && typeof selectedNpc.icon === 'string' && selectedNpc.icon.startsWith('http')
                    ? (<img src={selectedNpc.icon} className="quest-detail-img" alt="아이콘" />)
                    : (<span className="quest-detail-icon">{selectedNpc.icon || "😀"}</span>)}
                </span>
                <span className="quest-detail-title">{selectedNpc.name}</span>
                <button className="quest-detail-edit-btn" onClick={() => setEditNameOpen(true)} title="이름 수정">🖉</button>
              </div>
              <div className="quest-detail-block">
                <div className="quest-detail-row">
                  <button className="quest-detail-edit-btn" onClick={() => setEditLocOpen(true)} title="위치 수정">🖉</button>
                  <b>위치:</b>
                  <span className="quest-detail-loc">
                    ( {selectedNpc.location_x}, {selectedNpc.location_y}, {selectedNpc.location_z} )
                  </span>
                </div>
                <div className="quest-detail-row">
                  <button className="quest-detail-edit-btn" onClick={() => setEditQuestOpen(true)} title="퀘스트 내용 수정">🖉</button>
                  <b>퀘스트:</b>
                  <span className="quest-detail-value">{selectedNpc.quest || "-"}</span>
                </div>
                <div className="quest-detail-row">
                  <button className="quest-detail-edit-btn" onClick={() => setEditRewardOpen(true)} title="보상 수정">🖉</button>
                  <b>보상:</b>
                  <span className="quest-detail-reward">
                    {Array.isArray(selectedNpc.rewards) && selectedNpc.rewards.length > 0
                      ? selectedNpc.rewards.map((rw, i) => (
                          <span key={i} style={{ marginRight: 16, display: "inline-flex", alignItems: "center" }}>
                            {rw.icon && (
                              rw.icon.startsWith("http")
                                ? <img src={rw.icon} className="quest-detail-reward-img" alt="reward" style={{ width: 24, height: 24, verticalAlign: "middle", marginRight: 4 }} />
                                : <span style={{ fontSize: 20, marginRight: 4 }}>{rw.icon}</span>
                            )}
                            <span>{rw.text}</span>
                          </span>
                        ))
                      : <span style={{ marginLeft: 6 }}>-</span>
                    }
                  </span>
                </div>
                <div className="quest-detail-row">
                  <button className="quest-detail-edit-btn" onClick={() => setEditRequirementOpen(true)} title="선행퀘스트 수정">🖉</button>
                  <b>선행퀘스트:</b>
                  <span className="quest-detail-value">{selectedNpc.requirement || '-'}</span>
                </div>
                <div className="quest-detail-row">
                  <button className="quest-detail-edit-btn" onClick={() => setPicturesModalOpen(true)} title="사진 관리">🖉</button>
                  <b>사진:</b>
                  <div className="quest-detail-pictures-list">
                    {npcPictures.length === 0 && <span style={{ color: "#bbb" }}>사진 없음</span>}
                    {npcPictures.map((pic, idx) => (
                      <span key={pic} style={{ display: "inline-block", marginRight: 6, position: 'relative' }}>
                        <img src={pic} alt="npc" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: "1px solid #ddd" }} />
                      </span>
                    ))}
                  </div>
                </div>
                <div className="quest-detail-desc-box">
                  <button className="quest-detail-edit-btn" onClick={() => setEditLineOpen(true)} title="대사 수정">🖉</button>
                  <div className="quest-detail-desc">{selectedNpc.line || <span className="quest-detail-desc-empty">- 대사 없음 -</span>}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="npc-detail-empty">퀘스트를 선택하세요.</div>
          )}
        </div>
      </div>
    </>
  );
}
