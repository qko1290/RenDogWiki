// =============================================
// File: app/manage/head/page.tsx
// =============================================
/**
 * 머리찾기(Head) 관리 페이지
 * - 마을(추가/수정/삭제/아이콘) 및 각 마을별 머리찾기(좌표, 사진, 순서) 관리
 * - dnd-kit으로 머리찾기 리스트 드래그 정렬/순서 동기화 지원
 * - 이미지 선택, 다양한 모달 UI 등 완비
 */

'use client';

import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";
import WikiHeader from "@/components/common/Header";
import ImageSelectModal from "@/components/image/ImageSelectModal";
import '@/wiki/css/head-manager.css';
import '@/wiki/css/npc-manager.css';

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ===== 타입 정의 =====
type Village = {
  id: number;
  name: string;
  icon: string;
  order: number;
  head_icon?: string | null;
};
type Head = {
  id: number;
  village_id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures: string[];
};

export default function HeadManager() {
  // ===== 유저 인증 =====
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user ?? null));
  }, []);

  // ===== 상태: 마을/머리찾기/선택 =====
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
  const [headList, setHeadList] = useState<Head[]>([]);
  const [selectedHead, setSelectedHead] = useState<Head | null>(null);

  // ===== 모달/임시 입력 상태 =====
  // - 마을 추가/수정/이미지
  const [villageModalOpen, setVillageModalOpen] = useState(false);
  const [villageName, setVillageName] = useState('');
  const [villageIcon, setVillageIcon] = useState('');
  const [villageHeadIcon, setVillageHeadIcon] = useState<string>('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [headIconModalOpen, setHeadIconModalOpen] = useState(false);

  const [editVillageOpen, setEditVillageOpen] = useState(false);
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);
  const [editVillageName, setEditVillageName] = useState('');
  const [editVillageIcon, setEditVillageIcon] = useState('');
  const [editVillageHeadIcon, setEditVillageHeadIcon] = useState<string>('');
  const [editImageModalOpen, setEditImageModalOpen] = useState(false);
  const [editHeadIconModalOpen, setEditHeadIconModalOpen] = useState(false);

  // - 머리찾기 추가/수정
  const [headModalOpen, setHeadModalOpen] = useState(false);
  const [tmpLoc, setTmpLoc] = useState<[number, number, number]>([0,0,0]);
  const [tmpPictures, setTmpPictures] = useState<string[]>([]);
  const [editLocOpen, setEditLocOpen] = useState(false);
  const [editPicOpen, setEditPicOpen] = useState(false);
  const [editLoc, setEditLoc] = useState<[number, number, number]>([0,0,0]);
  const [editPics, setEditPics] = useState<string[]>([]);

  // ===== 드래그 앤 드롭 센서 =====
  const sensors = useSensors(useSensor(PointerSensor));

  // ===== 마을/머리찾기 불러오기 =====
  useEffect(() => {
    fetch("/api/villages")
      .then(res => res.json())
      .then(data => setVillages(data));
  }, []);

  useEffect(() => {
    if (selectedVillage) {
      fetch(`/api/head?village_id=${selectedVillage.id}`)
        .then(res => res.json())
        .then(data => setHeadList(Array.isArray(data) ? data : []));
      setSelectedHead(null);
    } else {
      setHeadList([]); setSelectedHead(null);
    }
  }, [selectedVillage]);

  // ===== 상세 선택시 임시값 초기화 =====
  useEffect(() => {
    if (selectedHead) {
      setTmpLoc([selectedHead.location_x, selectedHead.location_y, selectedHead.location_z]);
      setTmpPictures(selectedHead.pictures || []);
    }
  }, [selectedHead]);

  // ===== 마을 추가 =====
  const handleAddVillage = async () => {
    const maxOrder = villages.length ? Math.max(...villages.map(v => v.order)) : 0;
    await fetch("/api/villages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: villageName,
        icon: villageIcon,
        order: maxOrder + 1,
        head_icon: villageHeadIcon || null,
      }),
    });
    fetch("/api/villages").then(res => res.json()).then(data => setVillages(data));
    setVillageModalOpen(false); setVillageName(''); setVillageIcon(''); setVillageHeadIcon('');
  };

  // ===== 머리찾기 추가 =====
  const handleAddHead = async () => {
    if (!selectedVillage) return;
    const maxOrder = headList.length ? Math.max(...headList.map(h => h.order)) : 0;
    await fetch("/api/head", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        village_id: selectedVillage.id,
        order: maxOrder + 1,
        location_x: tmpLoc[0],
        location_y: tmpLoc[1],
        location_z: tmpLoc[2],
        pictures: tmpPictures,
      }),
    });
    fetch(`/api/head?village_id=${selectedVillage.id}`)
      .then(res => res.json())
      .then(data => setHeadList(Array.isArray(data) ? data : []));
    setHeadModalOpen(false); setTmpLoc([0,0,0]); setTmpPictures([]);
  };

  // ===== 사진 추가/삭제 =====
  const handleAddPicture = (url: string) => { setTmpPictures(arr => [...arr, url]); setImageModalOpen(false); };
  const handleRemovePicture = (idx: number) => { setTmpPictures(arr => arr.filter((_, i) => i !== idx)); };

  // ===== 마을 수정 모달/패치/삭제 =====
  const openEditVillage = (v: Village) => {
    setEditingVillage(v);
    setEditVillageName(v.name);
    setEditVillageIcon(v.icon);
    setEditVillageHeadIcon(v.head_icon || '');
    setEditVillageOpen(true);
  };

  const handleEditVillage = async () => {
    if (!editingVillage) return;
    try {
      await fetch(`/api/villages/${editingVillage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editVillageName,
          icon: editVillageIcon,
          head_icon: editVillageHeadIcon || null,
        }),
      });
      const res = await fetch("/api/villages");
      const data = await res.json();
      setVillages(data);
      setEditVillageOpen(false);
      setEditingVillage(null);
      setEditVillageName(''); setEditVillageIcon(''); setEditVillageHeadIcon('');
      if (selectedVillage && selectedVillage.id === editingVillage.id) {
        setSelectedVillage({ ...selectedVillage, name: editVillageName, icon: editVillageIcon, head_icon: editVillageHeadIcon });
      }
    } catch (e) {
      alert("수정 중 오류가 발생했습니다.");
      console.error(e);
    }
  };

  const handleDeleteVillage = async () => {
    if (!editingVillage) return;
    if (!window.confirm('정말 이 마을을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/villages/${editingVillage.id}`, { method: "DELETE" });
      const res = await fetch("/api/villages");
      const data = await res.json();
      setVillages(data);
      setEditVillageOpen(false); setEditingVillage(null);
      setEditVillageName(''); setEditVillageIcon('');
      if (selectedVillage && selectedVillage.id === editingVillage.id) setSelectedVillage(null);
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
      console.error(e);
    }
  };

  // ===== DnD: 머리찾기 항목 =====
  function SortableHeadItem({ head, selected, onClick }: { head: Head; selected: Head | null; onClick: () => void; }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: head.id });
    const village = villages.find(v => v.id === head.village_id);
    const headIcon = village?.head_icon;
    return (
      <li ref={setNodeRef}
        className={[
          "head-list-item",
          isDragging ? "dragging" : "",
          selected?.id === head.id ? "selected" : "",
        ].join(" ")}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
      >
        <span className="drag-handle" {...listeners} title="순서 변경">⠿</span>
        <span className="head-list-info" onClick={onClick}>
          <span className="head-list-icon">
            {headIcon
              ? headIcon.startsWith('http')
                ? <img src={headIcon} alt="head_icon" className="head-list-village-head-icon" />
                : <span className="head-list-village-head-emoji">{headIcon}</span>
              : null}
          </span>
          <span className="head-list-order">{head.order}.</span>
          <span className="head-list-coord">( {head.location_x}, {head.location_y}, {head.location_z} )</span>
        </span>
      </li>
    );
  }

  // ===== DnD 완료시 순서 동기화 =====
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = headList.findIndex(h => h.id === active.id);
    const newIndex = headList.findIndex(h => h.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newList = arrayMove(headList, oldIndex, newIndex);
    const newListWithOrder = newList.map((h, idx) => ({ ...h, order: idx + 1 }));
    setHeadList(newListWithOrder);

    for (const h of newListWithOrder) {
      await fetch(`/api/head/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: h.order }),
      });
    }
  };

  // ===== 좌표/사진 편집 모달 오픈 시 임시값 초기화 =====
  useEffect(() => {
    if (editLocOpen && selectedHead)
      setEditLoc([selectedHead.location_x, selectedHead.location_y, selectedHead.location_z]);
    if (editPicOpen && selectedHead)
      setEditPics(selectedHead.pictures ? [...selectedHead.pictures] : []);
  }, [editLocOpen, editPicOpen, selectedHead]);

  // ===== 좌표 수정 저장 =====
  const handleEditLoc = async () => {
    if (!selectedHead) return;
    await fetch(`/api/head/${selectedHead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...selectedHead,
        location_x: editLoc[0],
        location_y: editLoc[1],
        location_z: editLoc[2],
      }),
    });
    fetch(`/api/head?village_id=${selectedHead.village_id}`)
      .then(res => res.json())
      .then(data => {
        setHeadList(Array.isArray(data) ? data : []);
        setSelectedHead(data.find((h: Head) => h.id === selectedHead.id) || null);
      });
    setEditLocOpen(false);
  };

  // ===== 사진 수정 저장 =====
  const handleEditPics = async () => {
    if (!selectedHead) return;
    await fetch(`/api/head/${selectedHead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selectedHead, pictures: editPics }),
    });
    fetch(`/api/head?village_id=${selectedHead.village_id}`)
      .then(res => res.json())
      .then(data => {
        setHeadList(Array.isArray(data) ? data : []);
        setSelectedHead(data.find((h: Head) => h.id === selectedHead.id) || null);
      });
    setEditPicOpen(false);
  };

  // ====== 렌더링 ======
  return (
    <>
      <WikiHeader user={user} />

      {/* 마을 추가 모달 */}
      <Modal
        open={villageModalOpen}
        onClose={() => { setVillageModalOpen(false); setVillageName(''); setVillageIcon(''); setVillageHeadIcon(''); }}
        title="마을 추가"
        width="370px"
      >
        <div className="head-modal-body">
          <div>
            <label className="head-modal-label">마을 이름</label>
            <input className="head-modal-input" placeholder="마을 이름" maxLength={40} value={villageName}
              onChange={e => setVillageName(e.target.value)} />
          </div>
          <div>
            <label className="head-modal-label">마을 아이콘</label>
            <div className="head-modal-icon-input-row">
              <input className="head-modal-emoji-input" placeholder="🏘️" maxLength={2}
                value={villageIcon && !villageIcon.startsWith('http') ? villageIcon : ''}
                onChange={e => setVillageIcon(e.target.value)} />
              <span className="head-modal-icon-sep">또는</span>
              <button className="head-modal-image-btn" onClick={() => setImageModalOpen(true)}>이미지 선택</button>
              {villageIcon && villageIcon.startsWith('http') && (
                <img src={villageIcon} className="head-modal-preview-icon" alt="icon" />
              )}
            </div>
          </div>
          <div>
            <label className="head-modal-label">머리 아이콘</label>
            <div className="head-modal-icon-input-row">
              <button className="head-modal-image-btn" onClick={() => setHeadIconModalOpen(true)}>이미지 선택</button>
              {villageHeadIcon && villageHeadIcon.startsWith('http') && (
                <img src={villageHeadIcon} className="head-modal-preview-icon" alt="head_icon" />
              )}
              {villageHeadIcon && !villageHeadIcon.startsWith('http') && (
                <span className="head-modal-preview-icon">{villageHeadIcon}</span>
              )}
            </div>
          </div>
          <div className="head-modal-btn-row">
            <button className="head-modal-cancel-btn" onClick={() => setVillageModalOpen(false)}>취소</button>
            <button className="head-modal-submit-btn"
              disabled={!villageName.trim() || !villageIcon.trim()}
              onClick={handleAddVillage}>추가</button>
          </div>
        </div>
        <ImageSelectModal open={imageModalOpen} onClose={() => setImageModalOpen(false)}
          onSelectImage={(url) => { setVillageIcon(url); setImageModalOpen(false); }} />
        <ImageSelectModal open={headIconModalOpen} onClose={() => setHeadIconModalOpen(false)}
          onSelectImage={(url) => { setVillageHeadIcon(url); setHeadIconModalOpen(false); }} />
      </Modal>

      {/* 마을 수정 모달 */}
      <Modal
        open={editVillageOpen}
        onClose={() => { setEditVillageOpen(false); setEditingVillage(null); setEditVillageName(''); setEditVillageIcon(''); setEditVillageHeadIcon(''); }}
        title="마을 정보 수정"
        width="370px"
      >
        <div className="head-modal-body">
          <div>
            <label className="head-modal-label">마을 이름</label>
            <input className="head-modal-input" maxLength={40} value={editVillageName}
              onChange={e => setEditVillageName(e.target.value)} />
          </div>
          <div>
            <label className="head-modal-label">마을 아이콘</label>
            <div className="head-modal-icon-input-row">
              <input className="head-modal-emoji-input" maxLength={2}
                value={editVillageIcon && !editVillageIcon.startsWith('http') ? editVillageIcon : ''}
                onChange={e => setEditVillageIcon(e.target.value)} />
              <span className="head-modal-icon-sep">또는</span>
              <button className="head-modal-image-btn" onClick={() => setEditImageModalOpen(true)}>이미지 선택</button>
              {editVillageIcon && editVillageIcon.startsWith('http') && (
                <img src={editVillageIcon} className="head-modal-preview-icon" alt="icon" />
              )}
            </div>
          </div>
          <div>
            <label className="head-modal-label">머리 아이콘</label>
            <div className="head-modal-icon-input-row">
              <button className="head-modal-image-btn" onClick={() => setEditHeadIconModalOpen(true)}>이미지 선택</button>
              {editVillageHeadIcon && editVillageHeadIcon.startsWith('http') && (
                <img src={editVillageHeadIcon} className="head-modal-preview-icon" alt="head_icon" />
              )}
              {editVillageHeadIcon && !editVillageHeadIcon.startsWith('http') && (
                <span className="head-modal-preview-icon">{editVillageHeadIcon}</span>
              )}
            </div>
          </div>
          <div className="head-modal-btn-row">
            <button className="head-modal-cancel-btn" onClick={() => setEditVillageOpen(false)}>취소</button>
            <button className="head-modal-submit-btn"
              disabled={!editVillageName.trim() || !editVillageIcon.trim()}
              onClick={handleEditVillage}>저장</button>
            <button className="head-modal-cancel-btn" style={{ background: "#e43" }} onClick={handleDeleteVillage}>삭제</button>
          </div>
        </div>
        <ImageSelectModal open={editImageModalOpen} onClose={() => setEditImageModalOpen(false)}
          onSelectImage={(url) => { setEditVillageIcon(url); setEditImageModalOpen(false); }} />
        <ImageSelectModal open={editHeadIconModalOpen} onClose={() => setEditHeadIconModalOpen(false)}
          onSelectImage={(url) => { setEditVillageHeadIcon(url); setEditHeadIconModalOpen(false); }} />
      </Modal>

      {/* 머리찾기 추가 모달 */}
      <Modal
        open={headModalOpen}
        onClose={() => { setHeadModalOpen(false); setTmpLoc([0,0,0]); setTmpPictures([]); }}
        title="머리찾기 추가"
        width="400px"
      >
        <div className="head-modal-body">
          <div>
            <label className="head-modal-label">좌표 (X,Y,Z)</label>
            <div className="head-modal-coord-input-row">
              {["X", "Y", "Z"].map((label, idx) => (
                <input
                  key={label}
                  type="number"
                  className="head-modal-input head-modal-coord-input"
                  placeholder={label}
                  value={tmpLoc[idx]}
                  onChange={e => {
                    const copy = [...tmpLoc] as [number, number, number];
                    copy[idx] = Number(e.target.value);
                    setTmpLoc(copy);
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="head-modal-label">사진</label>
            <div className="head-modal-pic-list">
              {tmpPictures.map((pic, idx) => (
                <div className="head-modal-pic-thumb-box" key={idx}>
                  <img src={pic} className="head-modal-pic-thumb-img" />
                  <button className="head-modal-pic-thumb-remove" onClick={() => handleRemovePicture(idx)} title="삭제">×</button>
                </div>
              ))}
              <button className="head-modal-pic-add-btn" onClick={() => setImageModalOpen(true)} type="button">＋</button>
            </div>
          </div>
          <div className="head-modal-btn-row">
            <button className="head-modal-cancel-btn" onClick={() => setHeadModalOpen(false)}>취소</button>
            <button className="head-modal-submit-btn" disabled={tmpLoc.some(v => isNaN(v))} onClick={handleAddHead}>추가</button>
          </div>
        </div>
        <ImageSelectModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          onSelectImage={handleAddPicture}
        />
      </Modal>

      {/* ====== 메인 레이아웃 ====== */}
      <div className="head-manager-container">
        {/* --- 왼쪽: 마을 목록 --- */}
        <div className="head-sidebar">
          <div className="head-sidebar-header">
            <h3>마을 목록</h3>
            <button className="head-sidebar-add-btn" onClick={() => setVillageModalOpen(true)}>+ 마을 추가</button>
          </div>
          <ul className="head-village-list">
            {villages.sort((a, b) => a.order - b.order).map((v) =>
              <li key={v.id}
                className={`head-village-item${selectedVillage?.id === v.id ? " selected" : ""}`}
                onClick={() => setSelectedVillage(v)}
              >
                <span className="head-village-info">
                  <span className="head-village-icon">
                    {v.icon && (v.icon.startsWith('http')
                      ? <img src={v.icon} alt="icon" />
                      : <span className="head-village-emoji">{v.icon}</span>
                    )}
                  </span>
                  <span className="head-village-name">{v.name}</span>
                </span>
                {/* 세로 점 3개(⋮) */}
                <button className="head-village-menu-btn" onClick={e => { e.stopPropagation(); openEditVillage(v); }} tabIndex={-1}
                  aria-label="마을 편집" title="마을 정보 수정/삭제">⋮</button>
              </li>
            )}
          </ul>
        </div>

        {/* --- 가운데: 머리찾기 리스트 (dnd 지원) --- */}
        <div className="head-list-area">
          <div className="head-list-header-row">
            <h3 className="head-list-header">
              {selectedVillage ? `${selectedVillage.name} 머리찾기` : "머리찾기 목록"}
            </h3>
            <button
              className="head-sidebar-add-btn head-add-btn"
              disabled={!selectedVillage}
              onClick={() => setHeadModalOpen(true)}
              title={selectedVillage ? "" : "마을을 먼저 선택하세요"}
            >
              + 머리 추가
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={headList.map(h => h.id)} strategy={verticalListSortingStrategy}>
              <ul className="head-list">
                {headList
                  .sort((a, b) => a.order - b.order)
                  .map(h => <SortableHeadItem key={h.id} head={h} selected={selectedHead} onClick={() => setSelectedHead(h)} />)}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        {/* --- 오른쪽: 머리찾기 상세/편집 --- */}
        <div className="head-detail-area">
          {selectedHead ? (
            <div>
              <div className="head-detail-title">
                {selectedVillage?.head_icon && (
                  selectedVillage.head_icon.startsWith('http')
                    ? <img src={selectedVillage.head_icon} style={{ width: 32, height: 32, verticalAlign: 'middle', marginRight: 8 }} />
                    : <span style={{ fontSize: 32, marginRight: 8 }}>{selectedVillage.head_icon}</span>
                )}
                {selectedHead.order}번 머리
              </div>
              <div className="head-detail-row">
                <button className="head-edit-btn" onClick={() => setEditLocOpen(true)} title="좌표 수정">🖉</button>
                <b>좌표:</b>&nbsp;
                <span className="head-detail-coord">( {selectedHead.location_x}, {selectedHead.location_y}, {selectedHead.location_z} )</span>
              </div>
              <div className="head-detail-row">
                <button className="head-edit-btn" onClick={() => setEditPicOpen(true)} title="사진 수정">🖉</button>
                <b>사진:</b>
                <span className="head-detail-pic-list">
                  {(selectedHead.pictures || []).map((pic, i) =>
                    <img key={i} className="head-detail-pic-img" src={pic} />
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="head-detail-empty">머리찾기 대상을 선택하세요.</div>
          )}
        </div>
      </div>

      {/* 좌표 수정 모달 */}
      <Modal open={editLocOpen} onClose={() => setEditLocOpen(false)} title="좌표 수정" width="350px">
        <div className="head-modal-body">
          <div className="head-modal-coord-input-row">
            {["X", "Y", "Z"].map((label, idx) => (
              <input
                key={label}
                type="number"
                className="head-modal-input head-modal-coord-input"
                placeholder={label}
                value={editLoc[idx]}
                onChange={e => {
                  const copy = [...editLoc] as [number, number, number];
                  copy[idx] = Number(e.target.value);
                  setEditLoc(copy);
                }}
              />
            ))}
          </div>
          <div className="head-modal-btn-row">
            <button className="head-modal-cancel-btn" onClick={() => setEditLocOpen(false)}>취소</button>
            <button className="head-modal-submit-btn"
              disabled={editLoc.some(v => isNaN(v))}
              onClick={handleEditLoc}
            >저장</button>
          </div>
        </div>
      </Modal>

      {/* 사진 수정 모달 */}
      <Modal open={editPicOpen} onClose={() => setEditPicOpen(false)} title="사진 수정" width="410px">
        <div className="head-modal-body">
          <div className="head-modal-pic-list">
            {editPics.map((pic, idx) => (
              <div className="head-modal-pic-thumb-box" key={idx}>
                <img className="head-modal-pic-thumb-img" src={pic} />
                <button className="head-modal-pic-thumb-remove" onClick={() => setEditPics(editPics.filter((_, i) => i !== idx))} title="삭제">×</button>
              </div>
            ))}
            <button
              className="head-modal-pic-add-btn"
              onClick={() => setImageModalOpen(true)}
              type="button"
            >＋</button>
          </div>
          <div className="head-modal-btn-row">
            <button className="head-modal-cancel-btn" onClick={() => setEditPicOpen(false)}>취소</button>
            <button className="head-modal-submit-btn" onClick={handleEditPics}>저장</button>
          </div>
          <ImageSelectModal open={imageModalOpen} onClose={() => setImageModalOpen(false)}
            onSelectImage={(url) => { setEditPics([...editPics, url]); setImageModalOpen(false); }} />
        </div>
      </Modal>
    </>
  );
}
