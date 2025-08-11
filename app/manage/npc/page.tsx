// =============================================
// File: app/manage/npc/page.tsx
// =============================================

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import WikiHeader from '@/components/common/Header';
import { ModalCard } from '@/components/common/RdModal';
import ImageSelectModal from '@/components/image/ImageSelectModal';

import {
  SectionHeader,
  EmptyState,
  IconCell,
  SortableList,
  DetailTitle,
} from '@/components/manager';

import '@/wiki/css/image.css';          // rd-* 모달/버튼/인풋
import '@/wiki/css/manager-common.css'; // mgr-* 공통 레이아웃/리스트/필
import '@/wiki/css/npc-manager.css';    // NPC 전용(아래 CSS와 세트)

type Village = { id: number; name: string; icon: string; order: number };
type Npc = {
  id: number;
  name: string;
  village_id: number;
  icon: string;        // 이모지 or 이미지 URL
  order: number;
  reward: string | null;
  reward_icon: string | null;
  requirement: string | null;
  line: string | null;
  location_x: number;
  location_y: number;
  location_z: number;
  quest: string;
  npc_type: string;    // "normal"
  pictures?: string[];
};

export default function NpcManager() {
  /** 유저 */
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    fetch('/api/auth/me').then(r => (r.ok ? r.json() : null)).then(d => setUser(d?.user ?? null));
  }, []);

  /** 마을/NPC 상태 */
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);

  const [npcList, setNpcList] = useState<Npc[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);

  /** 모달들 */
  const [villageModalOpen, setVillageModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [npcModalOpen, setNpcModalOpen] = useState(false);

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editIconOpen, setEditIconOpen] = useState(false);
  const [editLocOpen, setEditLocOpen] = useState(false);
  const [editLineOpen, setEditLineOpen] = useState(false);
  const [picturesModalOpen, setPicturesModalOpen] = useState(false);
  const [addPictureModalOpen, setAddPictureModalOpen] = useState(false);

  /** 입력값 */
  const [villageName, setVillageName] = useState('');
  const [villageIcon, setVillageIcon] = useState('');
  const [npcName, setNpcName] = useState('');

  const [tmpName, setTmpName] = useState('');
  const [tmpLoc, setTmpLoc] = useState<[number, number, number]>([0, 0, 0]);
  const [tmpLine, setTmpLine] = useState('');
  const [npcPictures, setNpcPictures] = useState<string[]>([]);

  /** 데이터 로딩 */
  useEffect(() => {
    fetch('/api/villages').then(r => r.json()).then(rows => setVillages(Array.isArray(rows) ? rows : []));
  }, []);

  useEffect(() => {
    if (!selectedVillage) {
      setNpcList([]); setSelectedNpc(null);
      return;
    }
    fetch(`/api/npcs?village_id=${selectedVillage.id}&npc_type=normal`)
      .then(r => r.json())
      .then(rows => setNpcList(Array.isArray(rows) ? rows : []));
    setSelectedNpc(null);
  }, [selectedVillage]);

  useEffect(() => {
    if (!selectedNpc) return;
    setTmpName(selectedNpc.name);
    setTmpLoc([selectedNpc.location_x, selectedNpc.location_y, selectedNpc.location_z]);
    setTmpLine(selectedNpc.line || '');
    setNpcPictures(Array.isArray(selectedNpc.pictures) ? selectedNpc.pictures : []);
  }, [selectedNpc]);

  /** 액션 */
  const handleAddVillage = useCallback(async () => {
    const maxOrder = villages.length ? Math.max(...villages.map(v => v.order)) : 0;
    await fetch('/api/villages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: villageName, icon: villageIcon, order: maxOrder + 1 }),
    });
    const rows = await fetch('/api/villages').then(r => r.json());
    setVillages(Array.isArray(rows) ? rows : []);
    setVillageModalOpen(false);
    setVillageName(''); setVillageIcon('');
  }, [villageIcon, villageName, villages]);

  const handleAddNpc = useCallback(async () => {
    if (!selectedVillage) return;
    const maxOrder = npcList.length ? Math.max(...npcList.map(n => n.order)) : 0;
    await fetch('/api/npcs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: npcName, village_id: selectedVillage.id, icon: '😀',
        order: maxOrder + 1, reward: null, reward_icon: null,
        requirement: null, line: null,
        location_x: 0, location_y: 0, location_z: 0,
        quest: '', npc_type: 'normal',
      }),
    });
    const rows = await fetch(`/api/npcs?village_id=${selectedVillage.id}&npc_type=normal`).then(r => r.json());
    setNpcList(Array.isArray(rows) ? rows : []);
    setNpcModalOpen(false); setNpcName('');
  }, [npcList, npcName, selectedVillage]);

  const patchNpc = useCallback(async (fields: Partial<Npc>) => {
    if (!selectedNpc) return;
    await fetch(`/api/npcs/${selectedNpc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selectedNpc, ...fields, npc_type: 'normal' }),
    });
    if (!selectedVillage) return;
    const rows = await fetch(`/api/npcs?village_id=${selectedVillage.id}&npc_type=normal`).then(r => r.json());
    setNpcList(Array.isArray(rows) ? rows : []);
    setSelectedNpc((Array.isArray(rows) ? rows : []).find((n: Npc) => n.id === selectedNpc.id) ?? null);
  }, [selectedNpc, selectedVillage]);

  /** 정렬 메모 */
  const sortedVillages = useMemo(() => [...villages].sort((a, b) => a.order - b.order), [villages]);
  const sortedNpcList = useMemo(() => [...npcList].sort((a, b) => a.order - b.order), [npcList]);

  /** DnD 저장 */
  const handleReorder = useCallback(async (reordered: Npc[]) => {
    setNpcList(reordered);
    const prev = new Map(npcList.map(n => [n.id, n.order]));
    const changed = reordered.filter(n => prev.get(n.id) !== n.order).map(n => ({ id: n.id, order: n.order }));
    if (!selectedVillage || changed.length === 0) return;

    try {
      const res = await fetch('/api/npcs/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ village_id: selectedVillage.id, npc_type: 'normal', orders: changed }),
      });
      if (!res.ok) throw new Error('bulk-order-failed');
    } catch {
      const rows = await fetch(`/api/npcs?village_id=${selectedVillage.id}&npc_type=normal`).then(r => r.json());
      setNpcList(Array.isArray(rows) ? rows : []);
    }
  }, [npcList, selectedVillage]);

  const onKeyActivate =
    (fn: () => void) =>
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };

  /** 렌더 */
  return (
    <>
      <WikiHeader user={user} />

      {/* ───────── 마을 추가 ───────── */}
      <ModalCard
        open={villageModalOpen}
        onClose={() => setVillageModalOpen(false)}
        title="마을 추가"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setVillageModalOpen(false)}>취소</button>
            <button className="rd-btn primary" disabled={!villageName.trim() || !villageIcon.trim()} onClick={handleAddVillage}>추가</button>
          </>
        }
      >
        <div className="rd-field">
          <label className="rd-label">마을 이름</label>
          <input className="rd-input" placeholder="마을 이름" maxLength={40}
                 value={villageName} onChange={(e) => setVillageName(e.target.value)} />
        </div>
        <div className="rd-field">
          <label className="rd-label">마을 아이콘</label>
          <div className="rd-icon-row">
            <input className="rd-input rd-emoji-input" maxLength={2}
                   value={villageIcon && !villageIcon.startsWith('http') ? villageIcon : ''}
                   onChange={(e) => setVillageIcon(e.target.value)} />
            <button type="button" className="rd-btn secondary" onClick={() => setImageModalOpen(true)}>이미지 선택</button>
            {villageIcon && villageIcon.startsWith('http') && <img src={villageIcon} className="rd-preview" alt="icon" />}
          </div>
        </div>

        <ImageSelectModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          onSelectImage={(url) => { setVillageIcon(url); setImageModalOpen(false); }}
        />
      </ModalCard>

      {/* ───────── NPC 추가 ───────── */}
      <ModalCard
        open={npcModalOpen}
        onClose={() => setNpcModalOpen(false)}
        title="NPC 추가"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setNpcModalOpen(false)}>취소</button>
            <button className="rd-btn primary" disabled={!npcName.trim()} onClick={handleAddNpc}>추가</button>
          </>
        }
      >
        <div className="rd-field">
          <label className="rd-label">NPC 이름</label>
          <input className="rd-input" placeholder="NPC 이름" maxLength={40}
                 value={npcName} onChange={(e) => setNpcName(e.target.value)} />
        </div>
      </ModalCard>

      {/* ===== 수동 3단 레이아웃 ===== */}
      <div className="mgr-container">
        {/* 사이드바: 마을 */}
        <div className="mgr-sidebar">
          <SectionHeader
            title="마을 목록"
            right={<button className="mgr-add-btn" onClick={() => setVillageModalOpen(true)}>+ 마을 추가</button>}
          />
          <ul className="npc-village-list">
            {sortedVillages.map(v => (
              <li key={v.id}
                  className={`npc-village-item${selectedVillage?.id === v.id ? ' selected' : ''}`}
                  onClick={() => setSelectedVillage(v)}>
                <span className="npc-village-icon"><IconCell icon={v.icon} /></span>
                {v.name}
              </li>
            ))}
          </ul>
        </div>

        {/* 리스트: NPC */}
        <div className="mgr-list-area">
          <SectionHeader
            title={selectedVillage ? `${selectedVillage.name} NPC` : 'NPC 목록'}
            right={
              <button className="mgr-add-btn"
                      disabled={!selectedVillage}
                      onClick={() => setNpcModalOpen(true)}
                      title={selectedVillage ? '' : '마을을 먼저 선택하세요'}>
                + NPC 추가
              </button>
            }
          />

          {!selectedVillage ? (
            <EmptyState>마을을 먼저 선택하세요.</EmptyState>
          ) : sortedNpcList.length === 0 ? (
            <EmptyState>등록된 NPC가 없습니다.</EmptyState>
          ) : (
            <SortableList<Npc>
              className="mgr-list"
              itemClassName="mgr-list-item"
              items={sortedNpcList}
              selectedId={selectedNpc?.id}
              onSelect={it => setSelectedNpc(it)}
              onReorder={handleReorder}
              useOverlay={false}
              renderItem={n => (
                <>
                  <span className="mgr-order">{n.order}.</span>
                  <IconCell icon={n.icon} className="mgr-icon-img" size={22} rounded={5} />
                  <span className="mgr-name">{n.name}</span>
                </>
              )}
            />
          )}
        </div>

        {/* 상세 */}
        <div className="mgr-detail-area">
          {selectedNpc ? (
            <div>
              <DetailTitle
                icon={<IconCell icon={selectedNpc.icon} className="npc-detail-img" size={44} rounded={8} />}
                title={<span className="npc-detail-name">{selectedNpc.name}</span>}
                showEditButtons={false}
                onTitleClick={() => setEditNameOpen(true)}
                onIconClick={() => setEditIconOpen(true)}
              />

              {/* 위치 */}
              <div className="mgr-pill-row"
                   role="button" tabIndex={0}
                   onClick={() => setEditLocOpen(true)}
                   onKeyDown={onKeyActivate(() => setEditLocOpen(true))}>
                <span className="mgr-pill-label">위치</span>
                <span className="mgr-pill-value">
                  <span className="npc-detail-loc">
                    ( {selectedNpc.location_x}, {selectedNpc.location_y}, {selectedNpc.location_z} )
                  </span>
                </span>
              </div>

              {/* 대사 */}
              <div className="mgr-pill-row mgr-pill-row--multi"
                   role="button" tabIndex={0}
                   onClick={() => setEditLineOpen(true)}
                   onKeyDown={onKeyActivate(() => setEditLineOpen(true))}>
                <span className="mgr-pill-label">대사</span>
                <span className="mgr-pill-value">
                  {selectedNpc.line?.trim() ? selectedNpc.line : <span className="mgr-placeholder">- 대사 없음 -</span>}
                </span>
              </div>

              {/* 사진 */}
              <div className="mgr-pill-row"
                   role="button" tabIndex={0}
                   onClick={() => setPicturesModalOpen(true)}
                   onKeyDown={onKeyActivate(() => setPicturesModalOpen(true))}>
                <span className="mgr-pill-label">사진</span>
                <span className="mgr-pill-value">
                  {npcPictures.length ? (
                    npcPictures.slice(0, 6).map((url, i) => <img key={url + i} src={url} alt="" className="mgr-pill-pic" />)
                  ) : (
                    <span className="mgr-placeholder">사진 없음</span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState>NPC를 선택하세요.</EmptyState>
          )}
        </div>
      </div>

      {/* ───────── 이름 수정 ───────── */}
      <ModalCard
        open={editNameOpen}
        onClose={() => setEditNameOpen(false)}
        title="이름 수정"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditNameOpen(false)}>취소</button>
            <button className="rd-btn primary" disabled={!tmpName.trim()}
                    onClick={async () => { await patchNpc({ name: tmpName }); setEditNameOpen(false); }}>
              수정
            </button>
          </>
        }
      >
        <input className="rd-input" maxLength={40} value={tmpName} onChange={(e) => setTmpName(e.target.value)} />
      </ModalCard>

      {/* 아이콘 선택 */}
      <ImageSelectModal
        open={editIconOpen}
        onClose={() => setEditIconOpen(false)}
        onSelectImage={async (url) => { await patchNpc({ icon: url }); setEditIconOpen(false); }}
      />

      {/* ───────── 위치 수정 ───────── */}
      <ModalCard
        open={editLocOpen}
        onClose={() => setEditLocOpen(false)}
        title="위치 수정"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditLocOpen(false)}>취소</button>
            <button className="rd-btn primary"
                    disabled={tmpLoc.some(v => Number.isNaN(v))}
                    onClick={async () => {
                      await patchNpc({ location_x: tmpLoc[0], location_y: tmpLoc[1], location_z: tmpLoc[2] });
                      setEditLocOpen(false);
                    }}>
              수정
            </button>
          </>
        }
      >
        <div className="rd-field">
          <div className="rd-coord-row" role="group" aria-label="좌표 입력">
            {(['X','Y','Z'] as const).map((label, i) => (
              <div key={label} className="rd-coord-item">
                <span className="rd-chip-label">{label}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  className="rd-input rd-num"
                  value={Number.isNaN(tmpLoc[i]) ? '' : tmpLoc[i]}
                  onChange={(e) => {
                    const n = e.currentTarget.value === '' ? Number.NaN : e.currentTarget.valueAsNumber;
                    setTmpLoc(v => {
                      const a = [...v] as [number, number, number];
                      a[i] = n; return a;
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </ModalCard>

      {/* ───────── 대사 수정 ───────── */}
      <ModalCard
        open={editLineOpen}
        onClose={() => setEditLineOpen(false)}
        title="대사 수정"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditLineOpen(false)}>취소</button>
            <button className="rd-btn primary" onClick={async () => { await patchNpc({ line: tmpLine }); setEditLineOpen(false); }}>
              수정
            </button>
          </>
        }
      >
        <textarea className="rd-textarea" value={tmpLine} onChange={(e) => setTmpLine(e.target.value)} maxLength={600} />
      </ModalCard>

      {/* ───────── 사진 관리 ───────── */}
      <ModalCard
        open={picturesModalOpen}
        onClose={() => setPicturesModalOpen(false)}
        title="NPC 사진 관리"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setPicturesModalOpen(false)}>닫기</button>
            <button className="rd-btn primary" disabled={!selectedNpc}
                    onClick={async () => { await patchNpc({ pictures: npcPictures }); setPicturesModalOpen(false); }}>
              저장
            </button>
          </>
        }
      >
        <div className="rd-thumb-grid">
          {npcPictures.length === 0 && <span className="rd-muted">등록된 사진이 없습니다.</span>}
          {npcPictures.map((url, idx) => (
            <div key={url + idx} className="rd-thumb">
              <img src={url} alt={`npc-pic-${idx}`} />
              <button className="rd-thumb-x" onClick={() => setNpcPictures(npcPictures.filter((_, i) => i !== idx))} title="삭제">✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="rd-btn secondary" onClick={() => setAddPictureModalOpen(true)}>+ 사진 추가</button>
        </div>

        <ImageSelectModal
          open={addPictureModalOpen}
          onClose={() => setAddPictureModalOpen(false)}
          onSelectImage={(url) => {
            if (!npcPictures.includes(url)) setNpcPictures([...npcPictures, url]);
            setAddPictureModalOpen(false);
          }}
        />
      </ModalCard>
    </>
  );
}
