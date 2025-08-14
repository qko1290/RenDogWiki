// File: app/manage/quest/page.tsx
/**
 * 퀘스트 NPC 관리 페이지
 * - 마을별 퀘스트 타입 NPC 목록 조회/정렬/추가/수정/삭제
 * - 퀘스트 내용, 보상, 선행퀘스트, 위치, 대사, 사진, 아이콘 편집
 * - 데이터 계약(라우트/스키마) 보존. 읽기 시 pictures/rewards 안전 파싱만 추가.
 */

'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
import '@/wiki/css/npc-manager.css';    // 마을 리스트 아이템
import '@/wiki/css/quest-manager.css';  // 퀘스트 전용

type Village = { id: number; name: string; icon: string; order: number; head_icon?: string | null };
type QuestReward = { icon: string; text: string };
type Npc = {
  id: number;
  name: string;
  village_id: number;
  icon: string;
  order: number;
  rewards?: QuestReward[];  // 서버가 문자열(JSON)로 줄 수도 있어 읽기 시 정규화
  requirement: string | null;
  line: string | null;
  location_x: number;
  location_y: number;
  location_z: number;
  quest: string;
  npc_type: string; // "quest"
  pictures?: string[];       // 서버가 문자열(JSON)로 줄 수도 있어 읽기 시 정규화
};

export default function QuestNpcManager() {
  /** 유저 */
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null));
  }, []);

  /** 마을/NPC 상태 */
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);

  const [npcList, setNpcList] = useState<Npc[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);

  /** 모달/임시값 */
  const [villageModalOpen, setVillageModalOpen] = useState(false);
  const [villageName, setVillageName] = useState('');
  const [villageIcon, setVillageIcon] = useState<string>('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [npcName, setNpcName] = useState('');

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editIconOpen, setEditIconOpen] = useState(false);
  const [editLocOpen, setEditLocOpen] = useState(false);
  const [editLineOpen, setEditLineOpen] = useState(false);
  const [editQuestOpen, setEditQuestOpen] = useState(false);
  const [editRewardOpen, setEditRewardOpen] = useState(false);
  const [editRequirementOpen, setEditRequirementOpen] = useState(false);

  const [tmpName, setTmpName] = useState('');
  const [tmpLoc, setTmpLoc] = useState<[number, number, number]>([0, 0, 0]);
  const [tmpLine, setTmpLine] = useState('');
  const [tmpQuest, setTmpQuest] = useState('');
  const [tmpRewards, setTmpRewards] = useState<QuestReward[]>([]);
  const [editRewardImgModalIdx, setEditRewardImgModalIdx] = useState<number | null>(null);
  const [tmpRequirement, setTmpRequirement] = useState('');

  const [npcPictures, setNpcPictures] = useState<string[]>([]);
  const [picturesModalOpen, setPicturesModalOpen] = useState(false);
  const [addPictureModalOpen, setAddPictureModalOpen] = useState(false);

  /** ── 마을 수정 모달 state ───────────────────────── */
  const [editVillageOpen, setEditVillageOpen] = useState(false);
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);
  const [editVillageName, setEditVillageName] = useState('');
  const [editVillageIcon, setEditVillageIcon] = useState('');
  const [editVillageHeadIcon, setEditVillageHeadIcon] = useState<string>('');
  const [editImageModalOpen, setEditImageModalOpen] = useState(false);
  const [editHeadIconModalOpen, setEditHeadIconModalOpen] = useState(false);

  /** 유틸: 배열 정규화 (읽기 전용) */
  const normalizePictures = (pics: any): string[] => {
    if (Array.isArray(pics)) return [...pics];
    if (pics == null) return [];
    if (typeof pics === 'string') {
      try {
        const v = JSON.parse(pics);
        return Array.isArray(v) ? v : [];
      } catch { return []; }
    }
    return [];
  };
  const normalizeRewards = (rw: any): QuestReward[] => {
    if (Array.isArray(rw)) return [...rw];
    if (rw == null) return [];
    if (typeof rw === 'string') {
      try {
        const v = JSON.parse(rw);
        return Array.isArray(v) ? v : [];
      } catch { return []; }
    }
    return [];
  };

  /** 데이터 로딩 */
  useEffect(() => {
    fetch('/api/villages')
      .then((r) => r.json())
      .then((rows) => setVillages(Array.isArray(rows) ? rows : []));
  }, []);

  /** 공통: 선택 마을의 퀘스트 NPC 목록 재조회 */
  const reloadQuestList = useCallback(async (villageId: number) => {
    const rows = await fetch(`/api/npcs?village_id=${villageId}&npc_type=quest`).then((r) => r.json());
    setNpcList(Array.isArray(rows) ? rows : []);
    return Array.isArray(rows) ? rows : [];
  }, []);

  useEffect(() => {
    if (!selectedVillage) {
      setNpcList([]);
      setSelectedNpc(null);
      return;
    }
    reloadQuestList(selectedVillage.id).then(() => setSelectedNpc(null));
  }, [selectedVillage, reloadQuestList]);

  useEffect(() => {
    if (!selectedNpc) return;
    setTmpName(selectedNpc.name);
    setTmpLoc([selectedNpc.location_x, selectedNpc.location_y, selectedNpc.location_z]);
    setTmpLine(selectedNpc.line || '');
    setTmpQuest(selectedNpc.quest || '');
    setTmpRewards(normalizeRewards(selectedNpc.rewards));
    setTmpRequirement(selectedNpc.requirement || '');
    setNpcPictures(normalizePictures(selectedNpc.pictures));
  }, [selectedNpc]);

  /** 액션 */
  const handleAddVillage = useCallback(async () => {
    const maxOrder = villages.length ? Math.max(...villages.map((v) => v.order)) : 0;
    await fetch('/api/villages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: villageName, icon: villageIcon, order: maxOrder + 1 }),
    });
    const rows = await fetch('/api/villages').then((r) => r.json());
    setVillages(Array.isArray(rows) ? rows : []);
    setVillageModalOpen(false);
    setVillageName('');
    setVillageIcon('');
  }, [villageIcon, villageName, villages]);

  const handleAddNpc = useCallback(async () => {
    if (!selectedVillage) return;
    const maxOrder = npcList.length ? Math.max(...npcList.map((n) => n.order)) : 0;
    await fetch('/api/npcs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: npcName,
        village_id: selectedVillage.id,
        icon: '📜',
        order: maxOrder + 1,
        reward: null,
        reward_icon: null,
        requirement: null,
        line: null,
        location_x: 0,
        location_y: 0,
        location_z: 0,
        quest: '',
        npc_type: 'quest',
      }),
    });
    await reloadQuestList(selectedVillage.id);
    setNpcModalOpen(false);
    setNpcName('');
  }, [npcList, npcName, selectedVillage, reloadQuestList]);

  const patchNpc = useCallback(
    async (fields: Partial<Npc>) => {
      if (!selectedNpc) return;
      await fetch(`/api/npcs/${selectedNpc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedNpc, ...fields, npc_type: 'quest' }),
      });
      if (!selectedVillage) return;
      const rows = await reloadQuestList(selectedVillage.id);
      setSelectedNpc(rows.find((n: Npc) => n.id === selectedNpc.id) ?? null);
    },
    [selectedNpc, selectedVillage, reloadQuestList],
  );

  /** ── 마을 수정 모달 핸들러 ───────────────────────── */
  const openEditVillage = (v: Village) => {
    setEditingVillage(v);
    setEditVillageName(v.name);
    setEditVillageIcon(v.icon);
    setEditVillageHeadIcon(v.head_icon || '');
    setEditVillageOpen(true);
  };

  const handleEditVillage = useCallback(async () => {
    if (!editingVillage) return;
    await fetch(`/api/villages/${editingVillage.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editVillageName,
        icon: editVillageIcon,
        head_icon: editVillageHeadIcon || null,
      }),
    });
    const rows = await fetch('/api/villages').then(r => r.json());
    setVillages(Array.isArray(rows) ? rows : []);
    if (selectedVillage && selectedVillage.id === editingVillage.id) {
      setSelectedVillage({
        ...selectedVillage,
        name: editVillageName,
        icon: editVillageIcon,
        head_icon: editVillageHeadIcon || null,
      });
    }
    setEditVillageOpen(false);
    setEditingVillage(null);
    setEditVillageName('');
    setEditVillageIcon('');
    setEditVillageHeadIcon('');
  }, [editingVillage, editVillageIcon, editVillageName, editVillageHeadIcon, selectedVillage]);

  const handleDeleteVillage = useCallback(async () => {
    if (!editingVillage) return;
    if (!window.confirm('정말 이 마을을 삭제하시겠습니까?')) return;
    await fetch(`/api/villages/${editingVillage.id}`, { method: 'DELETE' });
    const rows = await fetch('/api/villages').then(r => r.json());
    setVillages(Array.isArray(rows) ? rows : []);
    if (selectedVillage && selectedVillage.id === editingVillage.id) setSelectedVillage(null);
    setEditVillageOpen(false);
    setEditingVillage(null);
    setEditVillageName('');
    setEditVillageIcon('');
    setEditVillageHeadIcon('');
  }, [editingVillage, selectedVillage]);

  /** 퀘스트(NPC) 삭제 */
  const handleDeleteNpc = useCallback(async () => {
    if (!selectedNpc) return;
    if (!window.confirm(`'${selectedNpc.name}' 퀘스트를 삭제할까요?`)) return;

    const res = await fetch(`/api/npcs/${selectedNpc.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error || '삭제 실패');
      return;
    }

    if (selectedVillage) {
      await reloadQuestList(selectedVillage.id);
    }
    setSelectedNpc(null);
  }, [selectedNpc, selectedVillage, reloadQuestList]);

  /** 정렬 메모 */
  const sortedVillages = useMemo(
    () => [...villages].sort((a, b) => a.order - b.order),
    [villages],
  );
  const sortedNpcList = useMemo(() => [...npcList].sort((a, b) => a.order - b.order), [npcList]);

  /** DnD 저장 */
  const handleReorder = useCallback(
    async (reordered: Npc[]) => {
      setNpcList(reordered);
      const prev = new Map(npcList.map((n) => [n.id, n.order]));
      const changed = reordered
        .filter((n) => prev.get(n.id) !== n.order)
        .map((n) => ({ id: n.id, order: n.order }));
      if (!selectedVillage || changed.length === 0) return;

      try {
        const res = await fetch('/api/npcs/order', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            village_id: selectedVillage.id,
            npc_type: 'quest',
            orders: changed,
          }),
        });
        if (!res.ok) throw new Error('bulk-order-failed');
      } catch {
        await reloadQuestList(selectedVillage.id);
      }
    },
    [npcList, selectedVillage, reloadQuestList],
  );

  const onKeyActivate =
    (fn: () => void) =>
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
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
            <button className="rd-btn secondary" onClick={() => setVillageModalOpen(false)}>
              취소
            </button>
            <button
              className="rd-btn primary"
              disabled={!villageName.trim() || !villageIcon.trim()}
              onClick={handleAddVillage}
              aria-label="마을 추가"
              title="마을 추가"
            >
              추가
            </button>
          </>
        }
      >
        <div className="rd-field">
          <label className="rd-label">마을 이름</label>
          <input
            className="rd-input"
            placeholder="마을 이름"
            maxLength={40}
            value={villageName}
            onChange={(e) => setVillageName(e.target.value)}
            aria-label="마을 이름 입력"
          />
        </div>

        <div className="rd-field">
          <label className="rd-label">마을 아이콘</label>
          <div className="mgr-icon-field">
            <div className="mgr-icon-inputs">
              <input
                className="rd-input rd-emoji-input"
                placeholder=""
                maxLength={2}
                value={villageIcon && !villageIcon.startsWith('http') ? villageIcon : ''}
                onChange={(e) => setVillageIcon(e.target.value)}
                aria-label="마을 아이콘 입력(이모지)"
              />
              <button
                type="button"
                className="rd-btn secondary"
                onClick={() => setImageModalOpen(true)}
                aria-label="이미지 선택"
                title="이미지 선택"
              >
                이미지 선택
              </button>
            </div>
            <div className="mgr-icon-preview">
              {villageIcon?.startsWith('http') ? (
                <img src={villageIcon} className="rd-preview" alt="icon" />
              ) : (
                <span className="mgr-icon-placeholder">미리보기</span>
              )}
            </div>
          </div>
        </div>

        <ImageSelectModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          onSelectImage={(url) => {
            setVillageIcon(url);
            setImageModalOpen(false);
          }}
        />
      </ModalCard>

      {/* ───────── 퀘스트 추가 ───────── */}
      <ModalCard
        open={npcModalOpen}
        onClose={() => setNpcModalOpen(false)}
        title="퀘스트 NPC 추가"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setNpcModalOpen(false)}>
              취소
            </button>
            <button className="rd-btn primary" disabled={!npcName.trim()} onClick={handleAddNpc} aria-label="퀘스트 추가">
              추가
            </button>
          </>
        }
      >
        <div className="rd-field">
          <label className="rd-label">NPC 이름</label>
          <input
            className="rd-input"
            placeholder="NPC 이름"
            maxLength={40}
            value={npcName}
            onChange={(e) => setNpcName(e.target.value)}
            aria-label="NPC 이름 입력"
          />
        </div>
      </ModalCard>

      {/* ===== 수동 3단 레이아웃 ===== */}
      <div className="mgr-container">
        {/* 사이드바: 마을 */}
        <div className="mgr-sidebar">
          <SectionHeader
            title="마을 목록"
            right={
              <button className="mgr-add-btn" onClick={() => setVillageModalOpen(true)} aria-label="마을 추가" title="마을 추가">
                + 마을 추가
              </button>
            }
          />
          <ul className="npc-village-list">
            {sortedVillages.map((v) => (
              <li
                key={v.id}
                className={`npc-village-item${selectedVillage?.id === v.id ? ' selected' : ''}`}
                onClick={() => setSelectedVillage(v)}
              >
                <span className="npc-village-icon">
                  <IconCell icon={v.icon} />
                </span>
                {v.name}
                <button
                  className="mgr-village-menu-btn"
                  onClick={(e) => { e.stopPropagation(); openEditVillage(v); }}
                  aria-label="마을 편집"
                  title="마을 정보 수정/삭제"
                >
                  ⋮
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 리스트: 퀘스트 */}
        <div className="mgr-list-area">
          <SectionHeader
            title={
              selectedVillage ? (
                <span className="mgr-title-inline">
                  <IconCell icon={selectedVillage.icon} size={18} rounded={4} />
                  <span>{selectedVillage.name}</span>
                </span>
              ) : (
                '퀘스트 목록'
              )
            }
            right={
              <button
                className="mgr-add-btn"
                disabled={!selectedVillage}
                onClick={() => setNpcModalOpen(true)}
                title={selectedVillage ? '' : '마을을 먼저 선택하세요'}
                aria-label="퀘스트 추가"
              >
                + 퀘스트 추가
              </button>
            }
          />

          {!selectedVillage ? (
            <EmptyState>마을을 먼저 선택하세요.</EmptyState>
          ) : sortedNpcList.length === 0 ? (
            <EmptyState>해당 마을에 등록된 퀘스트가 없습니다.</EmptyState>
          ) : (
            <SortableList<Npc>
              className="mgr-list"
              itemClassName="mgr-list-item"
              items={sortedNpcList}
              selectedId={selectedNpc?.id}
              onSelect={(it) => setSelectedNpc(it)}
              onReorder={handleReorder}
              useOverlay={false}
              renderItem={(n) => (
                <>
                  <span className="mgr-order">{n.order}.</span>
                  <IconCell icon={n.icon} className="mgr-icon-img" size={22} rounded={5} />
                  <span className="mgr-name">{n.name}</span>
                </>
              )}
            />
          )}
        </div>

        {/* 상세: 우측 */}
        <div className="mgr-detail-area">
          {selectedNpc ? (
            <div>
              {/* 우상단 툴바(이미지 페이지와 동일한 세그먼트 버튼 스타일) */}
              <div className="toolbar-seg mgr-detail-actions">
                <button
                  type="button"
                  className="seg-btn danger"
                  onClick={handleDeleteNpc}
                  title="삭제"
                  aria-label="퀘스트 삭제"
                >
                  <svg
                    className="ico"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M9.75 9.75v6.75M14.25 9.75v6.75M4.5 7.5h15M9 4.5h6m-8.25 3L7.5 19.5a2.25 2.25 0 002.25 2.25h4.5A2.25 2.25 0 0016.5 19.5L18.75 7.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="seg-label">삭제</span>
                </button>
              </div>

              <DetailTitle
                icon={
                  selectedNpc.icon?.startsWith('http') ? (
                    <IconCell
                      icon={selectedNpc.icon}
                      className="quest-detail-img"
                      size={48}
                      rounded={10}
                    />
                  ) : (
                    <span className="quest-detail-icon">{selectedNpc.icon || '📜'}</span>
                  )
                }
                title={<span className="quest-detail-title">{selectedNpc.name}</span>}
                showEditButtons={false}
                onTitleClick={() => setEditNameOpen(true)}
                onIconClick={() => setEditIconOpen(true)}
              />

              {/* 위치 */}
              <div
                className="mgr-pill-row"
                role="button"
                tabIndex={0}
                onClick={() => setEditLocOpen(true)}
                onKeyDown={onKeyActivate(() => setEditLocOpen(true))}
                title="위치 수정"
                aria-label="위치 수정"
              >
                <span className="mgr-pill-label">위치</span>
                <span className="mgr-pill-value">
                  <span className="quest-detail-loc">
                    ( {selectedNpc.location_x}, {selectedNpc.location_y}, {selectedNpc.location_z} )
                  </span>
                </span>
              </div>

              {/* 퀘스트 */}
              <div
                className="mgr-pill-row"
                role="button"
                tabIndex={0}
                onClick={() => setEditQuestOpen(true)}
                onKeyDown={onKeyActivate(() => setEditQuestOpen(true))}
                title="퀘스트 내용 수정"
                aria-label="퀘스트 내용 수정"
              >
                <span className="mgr-pill-label">퀘스트</span>
                <span className="mgr-pill-value">
                  {selectedNpc.quest?.trim() ? (
                    selectedNpc.quest
                  ) : (
                    <span className="mgr-placeholder">-</span>
                  )}
                </span>
              </div>

              {/* 보상 */}
              <div
                className="mgr-pill-row"
                role="button"
                tabIndex={0}
                onClick={() => setEditRewardOpen(true)}
                onKeyDown={onKeyActivate(() => setEditRewardOpen(true))}
                title="보상 수정"
                aria-label="보상 수정"
              >
                <span className="mgr-pill-label">보상</span>
                <span className="mgr-pill-value">
                  {Array.isArray(selectedNpc.rewards) && selectedNpc.rewards.length > 0 ? (
                    selectedNpc.rewards.map((rw, i) => (
                      <span key={i} className="mgr-chip">
                        {rw.icon ? (
                          rw.icon.startsWith('http') ? (
                            <img src={rw.icon} alt="" />
                          ) : (
                            <span className="mgr-chip-emoji">{rw.icon}</span>
                          )
                        ) : null}
                        <span>{rw.text}</span>
                      </span>
                    ))
                  ) : (
                    <span className="mgr-placeholder">-</span>
                  )}
                </span>
              </div>

              {/* 선행퀘스트 */}
              <div
                className="mgr-pill-row"
                role="button"
                tabIndex={0}
                onClick={() => setEditRequirementOpen(true)}
                onKeyDown={onKeyActivate(() => setEditRequirementOpen(true))}
                title="선행퀘스트 수정"
                aria-label="선행퀘스트 수정"
              >
                <span className="mgr-pill-label">선행퀘스트</span>
                <span className="mgr-pill-value">
                  {selectedNpc.requirement?.trim() ? (
                    selectedNpc.requirement
                  ) : (
                    <span className="mgr-placeholder">-</span>
                  )}
                </span>
              </div>

              {/* 사진 */}
              <div
                className="mgr-pill-row"
                role="button"
                tabIndex={0}
                onClick={() => setPicturesModalOpen(true)}
                onKeyDown={onKeyActivate(() => setPicturesModalOpen(true))}
                title="사진 관리"
                aria-label="사진 관리"
              >
                <span className="mgr-pill-label">사진</span>
                <span className="mgr-pill-value">
                  {npcPictures && npcPictures.length > 0 ? (
                    npcPictures.slice(0, 6).map((url, idx) => (
                      <img key={url + idx} src={url} alt="" className="mgr-pill-pic" />
                    ))
                  ) : (
                    <span className="mgr-placeholder">사진 없음</span>
                  )}
                </span>
              </div>

              {/* 대사 */}
              <div
                className="mgr-pill-row mgr-pill-row--multi"
                role="button"
                tabIndex={0}
                onClick={() => setEditLineOpen(true)}
                onKeyDown={onKeyActivate(() => setEditLineOpen(true))}
                title="대사 수정"
                aria-label="대사 수정"
              >
                <span className="mgr-pill-label">대사</span>
                <span className="mgr-pill-value">
                  {selectedNpc.line?.trim() ? (
                    selectedNpc.line
                  ) : (
                    <span className="mgr-placeholder">- 대사 없음 -</span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState>퀘스트를 선택하세요.</EmptyState>
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
            <button className="rd-btn secondary" onClick={() => setEditNameOpen(false)}>
              취소
            </button>
            <button
              className="rd-btn primary"
              disabled={!tmpName.trim()}
              onClick={async () => {
                await patchNpc({ name: tmpName });
                setEditNameOpen(false);
              }}
              aria-label="이름 수정 저장"
            >
              수정
            </button>
          </>
        }
      >
        <input
          className="rd-input"
          maxLength={40}
          value={tmpName}
          onChange={(e) => setTmpName(e.target.value)}
          aria-label="NPC 이름 입력"
        />
      </ModalCard>

      {/* 아이콘 선택 */}
      <ImageSelectModal
        open={editIconOpen}
        onClose={() => setEditIconOpen(false)}
        onSelectImage={async (url) => {
          await patchNpc({ icon: url });
          setEditIconOpen(false);
        }}
      />

      {/* ───────── 위치 수정 ───────── */}
      <ModalCard
        open={editLocOpen}
        onClose={() => setEditLocOpen(false)}
        title="위치 수정"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditLocOpen(false)}>
              취소
            </button>
            <button
              className="rd-btn primary"
              disabled={tmpLoc.some((v) => Number.isNaN(v))}
              onClick={async () => {
                await patchNpc({
                  location_x: tmpLoc[0],
                  location_y: tmpLoc[1],
                  location_z: tmpLoc[2],
                });
                setEditLocOpen(false);
              }}
              aria-label="위치 수정 저장"
            >
              수정
            </button>
          </>
        }
      >
        <div className="rd-field">
          <div className="rd-coord-row" role="group" aria-label="좌표 입력">
            <div className="rd-coord-item">
              <span className="rd-chip-label">X</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                className="rd-input rd-num"
                value={Number.isNaN(tmpLoc[0]) ? '' : tmpLoc[0]}
                onChange={(e) => {
                  const n =
                    e.currentTarget.value === '' ? Number.NaN : e.currentTarget.valueAsNumber;
                  setTmpLoc(([_, y, z]) => [n, y, z]);
                }}
              />
            </div>

            <div className="rd-coord-item">
              <span className="rd-chip-label">Y</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                className="rd-input rd-num"
                value={Number.isNaN(tmpLoc[1]) ? '' : tmpLoc[1]}
                onChange={(e) => {
                  const n =
                    e.currentTarget.value === '' ? Number.NaN : e.currentTarget.valueAsNumber;
                  setTmpLoc(([x, _, z]) => [x, n, z]);
                }}
              />
            </div>

            <div className="rd-coord-item">
              <span className="rd-chip-label">Z</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                className="rd-input rd-num"
                value={Number.isNaN(tmpLoc[2]) ? '' : tmpLoc[2]}
                onChange={(e) => {
                  const n =
                    e.currentTarget.value === '' ? Number.NaN : e.currentTarget.valueAsNumber;
                  setTmpLoc(([x, y, _]) => [x, y, n]);
                }}
              />
            </div>
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
            <button className="rd-btn secondary" onClick={() => setEditLineOpen(false)}>
              취소
            </button>
            <button
              className="rd-btn primary"
              onClick={async () => {
                await patchNpc({ line: tmpLine });
                setEditLineOpen(false);
              }}
              aria-label="대사 수정 저장"
            >
              수정
            </button>
          </>
        }
      >
        <textarea
          className="rd-textarea"
          value={tmpLine}
          onChange={(e) => setTmpLine(e.target.value)}
          maxLength={600}
          aria-label="대사 입력"
        />
      </ModalCard>

      {/* ───────── 퀘스트 내용 수정 ───────── */}
      <ModalCard
        open={editQuestOpen}
        onClose={() => setEditQuestOpen(false)}
        title="퀘스트 내용 수정"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditQuestOpen(false)}>
              취소
            </button>
            <button
              className="rd-btn primary"
              onClick={async () => {
                await patchNpc({ quest: tmpQuest });
                setEditQuestOpen(false);
              }}
              aria-label="퀘스트 저장"
            >
              저장
            </button>
          </>
        }
      >
        <div className="rd-field">
          <label className="rd-label">퀘스트 내용</label>

          <div className="rd-textarea-wrap">
            <textarea
              className="rd-textarea"
              value={tmpQuest}
              onChange={(e) => setTmpQuest(e.target.value)}
              maxLength={400}
              rows={6}
              placeholder="예) 라임에게서 받은 편지를 퀘스트 마스터에게 전달하세요."
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  (async () => {
                    await patchNpc({ quest: tmpQuest });
                    setEditQuestOpen(false);
                  })();
                }
              }}
              aria-label="퀘스트 내용 입력"
            />
          </div>
        </div>
      </ModalCard>

      {/* ───────── 보상 수정 ───────── */}
      <ModalCard open={editRewardOpen} onClose={() => setEditRewardOpen(false)} title="보상 수정">
        <div className="mgr-modal-body">
          <label className="mgr-modal-label">보상 목록</label>

          <div className="rw-list">
            {tmpRewards.map((reward, idx) => (
              <div key={idx} className="rw-row">
                {/* 아이콘 선택 */}
                <button
                  type="button"
                  className="rw-icon-btn"
                  onClick={() => setEditRewardImgModalIdx(idx)}
                  title="아이콘 선택"
                  aria-label={`보상 ${idx + 1} 아이콘 선택`}
                >
                  {reward.icon ? (
                    reward.icon.startsWith('http') ? (
                      <img src={reward.icon} alt="" className="rw-icon-img" />
                    ) : (
                      <span className="rw-icon-emoji">{reward.icon}</span>
                    )
                  ) : (
                    <svg
                      className="rw-icon-placeholder"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 15l4-4 3 3 5-5 6 6" />
                      <path d="M12 8v4M10 10h4" />
                    </svg>
                  )}
                </button>

                {/* 내용 입력 */}
                <input
                  className="mgr-input rw-input"
                  placeholder="보상 내용"
                  maxLength={60}
                  value={reward.text}
                  onChange={(e) => {
                    const copy = tmpRewards.slice();
                    copy[idx].text = e.target.value;
                    setTmpRewards(copy);
                  }}
                />

                {/* 삭제 */}
                <button
                  type="button"
                  className="rw-del-btn"
                  onClick={() => setTmpRewards(tmpRewards.filter((_, i) => i !== idx))}
                  aria-label="보상 삭제"
                  title="삭제"
                >
                  <svg className="ico-trash" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* 추가 버튼 */}
          <button
            type="button"
            className="rw-add-btn"
            onClick={() => setTmpRewards([...tmpRewards, { icon: '', text: '' }])}
          >
            보상 추가
            <span className="rw-add-iconwrap" aria-hidden="true">
              <svg className="rw-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </button>

          {/* 하단 액션 */}
          <div className="mgr-btn-row">
            <button className="mgr-btn mgr-btn-secondary" onClick={() => setEditRewardOpen(false)}>
              취소
            </button>
            <button
              className="mgr-btn mgr-btn-primary"
              onClick={async () => {
                await patchNpc({ rewards: tmpRewards });
                setEditRewardOpen(false);
              }}
            >
              수정
            </button>
          </div>

          {/* 아이콘 선택 모달 */}
          <ImageSelectModal
            open={editRewardImgModalIdx !== null}
            onClose={() => setEditRewardImgModalIdx(null)}
            onSelectImage={(url) => {
              if (editRewardImgModalIdx === null) return;
              const idx = editRewardImgModalIdx;
              const copy = tmpRewards.slice();
              copy[idx].icon = url;
              setTmpRewards(copy);
              setEditRewardImgModalIdx(null);
            }}
          />
        </div>
      </ModalCard>

      {/* ───────── 선행퀘스트 수정 ───────── */}
      <ModalCard
        open={editRequirementOpen}
        onClose={() => setEditRequirementOpen(false)}
        title="선행퀘스트 수정"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditRequirementOpen(false)}>
              취소
            </button>
            <button
              className="rd-btn primary"
              onClick={async () => {
                await patchNpc({ requirement: tmpRequirement });
                setEditRequirementOpen(false);
              }}
              aria-label="선행퀘스트 수정 저장"
            >
              수정
            </button>
          </>
        }
      >
        <input
          className="rd-input"
          value={tmpRequirement}
          maxLength={200}
          onChange={(e) => setTmpRequirement(e.target.value)}
          aria-label="선행퀘스트 입력"
        />
      </ModalCard>

      {/* ───────── 사진 관리 ───────── */}
      <ModalCard
        open={picturesModalOpen}
        onClose={() => setPicturesModalOpen(false)}
        title="NPC 사진 관리"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setPicturesModalOpen(false)}>
              닫기
            </button>
            <button
              className="rd-btn primary"
              disabled={!selectedNpc}
              onClick={async () => {
                await patchNpc({ pictures: npcPictures });
                setPicturesModalOpen(false);
              }}
              aria-label="사진 저장"
            >
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
              <button
                className="rd-thumb-x"
                onClick={() => setNpcPictures(npcPictures.filter((_, i) => i !== idx))}
                title="삭제"
                aria-label={`사진 ${idx + 1} 삭제`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            className="rd-btn secondary"
            onClick={() => setAddPictureModalOpen(true)}
            aria-label="사진 추가"
            title="사진 추가"
          >
            + 사진 추가
          </button>
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

      {/* ───────── 마을 정보 수정 (공통 레이아웃) ───────── */}
      <ModalCard
        open={editVillageOpen}
        onClose={() => {
          setEditVillageOpen(false);
          setEditingVillage(null);
          setEditVillageName(''); setEditVillageIcon(''); setEditVillageHeadIcon('');
        }}
        title="마을 정보 수정"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditVillageOpen(false)}>취소</button>
            <button className="rd-btn primary" disabled={!editVillageName.trim() || !editVillageIcon.trim()} onClick={handleEditVillage} aria-label="마을 정보 저장">저장</button>
            <button className="rd-btn danger" onClick={handleDeleteVillage} aria-label="마을 삭제" title="마을 삭제">삭제</button>
          </>
        }
      >
        <div className="rd-field">
          <label className="rd-label">마을 이름</label>
          <input className="rd-input" maxLength={40}
                 value={editVillageName} onChange={(e) => setEditVillageName(e.target.value)} aria-label="마을 이름 입력" />
        </div>
        <div className="rd-field">
          <label className="rd-label">마을 아이콘</label>
          <div className="mgr-icon-field">
            <div className="mgr-icon-inputs">
              <input
                className="rd-input rd-emoji-input" maxLength={2}
                value={editVillageIcon && !editVillageIcon.startsWith('http') ? editVillageIcon : ''}
                onChange={(e) => setEditVillageIcon(e.target.value)}
                aria-label="마을 아이콘 입력(이모지)"
              />
              <button type="button" className="rd-btn secondary" onClick={() => setEditImageModalOpen(true)} aria-label="아이콘 이미지 선택" title="아이콘 이미지 선택">이미지 선택</button>
            </div>
            <div className="mgr-icon-preview">
              {editVillageIcon?.startsWith('http')
                ? <img src={editVillageIcon} alt="icon" />
                : <span className="mgr-icon-placeholder">미리보기</span>}
            </div>
          </div>
        </div>
        <div className="rd-field">
          <label className="rd-label">머리 아이콘</label>
          <div className="mgr-icon-field">
            <div className="mgr-icon-inputs">
              <button type="button" className="rd-btn secondary" onClick={() => setEditHeadIconModalOpen(true)} aria-label="머리 아이콘 이미지 선택" title="머리 아이콘 이미지 선택">이미지 선택</button>
            </div>
            <div className="mgr-icon-preview">
              {editVillageHeadIcon?.startsWith('http')
                ? <img src={editVillageHeadIcon} alt="head_icon" />
                : <span className="mgr-icon-placeholder">미리보기</span>}
            </div>
          </div>
        </div>

        <ImageSelectModal
          open={editImageModalOpen}
          onClose={() => setEditImageModalOpen(false)}
          onSelectImage={(url) => { setEditVillageIcon(url); setEditImageModalOpen(false); }}
        />
        <ImageSelectModal
          open={editHeadIconModalOpen}
          onClose={() => setEditHeadIconModalOpen(false)}
          onSelectImage={(url) => { setEditVillageHeadIcon(url); setEditHeadIconModalOpen(false); }}
        />
      </ModalCard>
    </>
  );
}
