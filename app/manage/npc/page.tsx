'use client';

import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";
import WikiHeader from "@/components/common/Header";
import ImageSelectModal from "@/components/image/ImageSelectModal";
import '@/wiki/css/npc-manager.css';

type Village = {
  name: string;
  icon: string;
  order: number;
};
type Npc = {
  name: string;
  village_name: string;
  icon: string;
  order: number;
  reward: string | null;
  reward_icon: string | null;
  requirement: string | null;
  line: string | null;
  location_x: number;
  location_y: number;
  location_z: number;
  quest: string;
  npc_type: string;
};

export default function NpcManager() {
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
  const [npcList, setNpcList] = useState<Npc[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);

  // 마을 관련 상태
  const [villageModalOpen, setVillageModalOpen] = useState(false);
  const [villageName, setVillageName] = useState('');
  const [villageIcon, setVillageIcon] = useState<string>('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // NPC 추가
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [npcName, setNpcName] = useState('');

  // NPC 개별 정보 수정 모달
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editIconOpen, setEditIconOpen] = useState(false);
  const [editLocOpen, setEditLocOpen] = useState(false);
  const [editLineOpen, setEditLineOpen] = useState(false);

  // NPC 정보 임시 입력값(편집용)
  const [tmpName, setTmpName] = useState('');
  const [tmpLoc, setTmpLoc] = useState<[number, number, number]>([0, 0, 0]);
  const [tmpLine, setTmpLine] = useState('');

  // village 목록 가져오기
  useEffect(() => {
    fetch("/api/villages")
      .then(res => res.json())
      .then(data => setVillages(data));
  }, []);

  // village 선택시 해당 npc 목록 가져오기
  useEffect(() => {
    if (selectedVillage) {
      fetch(`/api/npcs?village_name=${encodeURIComponent(selectedVillage.name)}`)
        .then(res => res.json())
        .then(data => setNpcList(data));
      setSelectedNpc(null);
    } else {
      setNpcList([]);
      setSelectedNpc(null);
    }
  }, [selectedVillage]);

  // NPC 선택
  const handleNpcClick = (npc: Npc) => setSelectedNpc(npc);

  // NPC 추가 함수
  const handleAddNpc = async () => {
    if (!selectedVillage) return;
    const maxOrder = npcList.length ? Math.max(...npcList.map(n => n.order)) : 0;
    await fetch("/api/npcs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: npcName,
        village_name: selectedVillage.name,
        icon: "😀", // 기본 아이콘
        order: maxOrder + 1,
        reward: null,
        reward_icon: null,
        requirement: null,
        line: null,
        location_x: 0,
        location_y: 0,
        location_z: 0,
        quest: "",
        npc_type: "normal",
      }),
    });
    fetch(`/api/npcs?village_name=${encodeURIComponent(selectedVillage.name)}`)
      .then(res => res.json())
      .then(data => setNpcList(data));
    setNpcModalOpen(false);
    setNpcName('');
  };

  // NPC 정보 PATCH(부분수정)
  const patchNpc = async (fields: Partial<Npc>) => {
    if (!selectedNpc) return;
    const res = await fetch(`/api/npcs/${encodeURIComponent(selectedNpc.name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (res.ok && selectedVillage) {
      fetch(`/api/npcs?village_name=${encodeURIComponent(selectedVillage.name)}`)
        .then(res => res.json())
        .then(data => {
          setNpcList(data);
          // 새로고침 후 방금 수정한 npc 다시 선택
          setSelectedNpc(data.find((n: Npc) => n.name === (fields.name || selectedNpc.name)));
        });
    }
  };

  // NPC 선택시 임시입력값 초기화
  useEffect(() => {
    if (selectedNpc) {
      setTmpName(selectedNpc.name);
      setTmpLoc([selectedNpc.location_x, selectedNpc.location_y, selectedNpc.location_z]);
      setTmpLine(selectedNpc.line || "");
    }
  }, [selectedNpc]);

  return (
    <>
      <WikiHeader user={null} />

      {/* 마을 추가 모달 */}
      <Modal
        open={villageModalOpen}
        onClose={() => {
          setVillageModalOpen(false);
          setVillageName('');
          setVillageIcon('');
        }}
        title="마을 추가"
        width="370px"
      >
        <div className="npc-modal-body">
          <div>
            <label className="npc-modal-label">마을 이름</label>
            <input
              className="npc-modal-input"
              placeholder="마을 이름"
              maxLength={40}
              value={villageName}
              onChange={e => setVillageName(e.target.value)}
            />
          </div>
          <div>
            <label className="npc-modal-label">마을 아이콘</label>
            <div className="npc-modal-icon-input-row">
              <input
                className="npc-modal-emoji-input"
                placeholder="🏘️"
                maxLength={2}
                value={villageIcon && !villageIcon.startsWith('http') ? villageIcon : ''}
                onChange={e => setVillageIcon(e.target.value)}
              />
              <span className="npc-modal-icon-sep">또는</span>
              <button
                className="npc-modal-image-btn"
                onClick={() => setImageModalOpen(true)}
              >이미지 선택</button>
              {villageIcon && villageIcon.startsWith('http') && (
                <img src={villageIcon} className="npc-modal-preview-icon" alt="icon" />
              )}
            </div>
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setVillageModalOpen(false)}>취소</button>
            <button
              className="npc-modal-submit-btn"
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
                setVillageModalOpen(false);
                setVillageName('');
                setVillageIcon('');
              }}
            >추가</button>
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
      </Modal>

      {/* NPC 추가 모달 */}
      <Modal
        open={npcModalOpen}
        onClose={() => {
          setNpcModalOpen(false);
          setNpcName('');
        }}
        title="NPC 추가"
        width="370px"
      >
        <div className="npc-modal-body">
          <div>
            <label className="npc-modal-label">NPC 이름</label>
            <input
              className="npc-modal-input"
              placeholder="NPC 이름"
              maxLength={40}
              value={npcName}
              onChange={e => setNpcName(e.target.value)}
            />
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setNpcModalOpen(false)}>취소</button>
            <button
              className="npc-modal-submit-btn"
              disabled={!npcName.trim()}
              onClick={handleAddNpc}
            >추가</button>
          </div>
        </div>
      </Modal>

      {/* --- 이름 수정 모달 --- */}
      <Modal
        open={editNameOpen}
        onClose={() => setEditNameOpen(false)}
        title="이름 수정"
        width="350px"
      >
        <div className="npc-modal-body">
          <input
            className="npc-modal-input"
            maxLength={40}
            value={tmpName}
            onChange={e => setTmpName(e.target.value)}
          />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditNameOpen(false)}>취소</button>
            <button
              className="npc-modal-submit-btn"
              disabled={!tmpName.trim()}
              onClick={async () => {
                await patchNpc({ name: tmpName });
                setEditNameOpen(false);
              }}
            >수정</button>
          </div>
        </div>
      </Modal>

      {/* --- 아이콘(이미지/이모지) 수정 모달 --- */}
      <ImageSelectModal
        open={editIconOpen}
        onClose={() => setEditIconOpen(false)}
        onSelectImage={async (url) => {
          await patchNpc({ icon: url });
          setEditIconOpen(false);
        }}
      />

      {/* --- 위치(x,y,z) 수정 모달 --- */}
      <Modal
        open={editLocOpen}
        onClose={() => setEditLocOpen(false)}
        title="위치 수정"
        width="350px"
      >
        <div className="npc-modal-body">
          <div style={{ display: "flex", gap: 8 }}>
            {["X", "Y", "Z"].map((label, idx) => (
              <div key={label} style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{label}</div>
                <input
                  type="number"
                  className="npc-modal-input"
                  style={{ width: "100%" }}
                  value={tmpLoc[idx]}
                  onChange={e => {
                    const copy = [...tmpLoc] as [number, number, number];
                    copy[idx] = Number(e.target.value);
                    setTmpLoc(copy);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditLocOpen(false)}>취소</button>
            <button
              className="npc-modal-submit-btn"
              onClick={async () => {
                await patchNpc({ location_x: tmpLoc[0], location_y: tmpLoc[1], location_z: tmpLoc[2] });
                setEditLocOpen(false);
              }}
            >수정</button>
          </div>
        </div>
      </Modal>

      {/* --- 대사(line) 수정 모달 --- */}
      <Modal
        open={editLineOpen}
        onClose={() => setEditLineOpen(false)}
        title="대사 수정"
        width="420px"
      >
        <div className="npc-modal-body">
          <textarea
            className="npc-modal-input"
            style={{ minHeight: 100, resize: "vertical" }}
            value={tmpLine}
            onChange={e => setTmpLine(e.target.value)}
            maxLength={600}
          />
          <div className="npc-modal-btn-row">
            <button className="npc-modal-cancel-btn" onClick={() => setEditLineOpen(false)}>취소</button>
            <button
              className="npc-modal-submit-btn"
              onClick={async () => {
                await patchNpc({ line: tmpLine });
                setEditLineOpen(false);
              }}
            >수정</button>
          </div>
        </div>
      </Modal>

      <div className="npc-manager-container">
        {/* 왼쪽: 마을 목록 */}
        <div className="npc-sidebar">
          <div className="npc-sidebar-header">
            <h3>마을 목록</h3>
            <button className="npc-sidebar-add-btn" onClick={() => setVillageModalOpen(true)}>
              + 마을 추가
            </button>
          </div>
          <ul className="npc-village-list">
            {villages.sort((a, b) => a.order - b.order).map(v =>
              <li
                key={v.name}
                className={`npc-village-item${selectedVillage?.name === v.name ? " selected" : ""}`}
                onClick={() => setSelectedVillage(v)}
              >
                <span className="npc-village-icon">
                  {v.icon.startsWith('http') ? (
                    <img src={v.icon} alt="icon" />
                  ) : (
                    <span style={{ fontSize: 20 }}>{v.icon}</span>
                  )}
                </span>
                {v.name}
              </li>
            )}
          </ul>
        </div>

        {/* 가운데: npc 리스트 */}
        <div className="npc-list-area">
          <div className="npc-list-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 className="npc-list-header" style={{ margin: 0, fontWeight: 700 }}>
              {selectedVillage ? `${selectedVillage.name} NPC` : "NPC 목록"}
            </h3>
            <button
              className="npc-sidebar-add-btn"
              style={{ fontWeight: 500, padding: "5px 12px" }}
              disabled={!selectedVillage}
              onClick={() => setNpcModalOpen(true)}
              title={selectedVillage ? "" : "마을을 먼저 선택하세요"}
            >
              + NPC 추가
            </button>
          </div>
          {npcList.length === 0 ? (
            <div className="npc-detail-empty">해당 마을에 등록된 NPC가 없습니다.</div>
          ) : (
            <ul className="npc-list">
              {npcList.sort((a, b) => a.order - b.order).map(n =>
                <li
                  key={n.name}
                  className={`npc-list-item${selectedNpc?.name === n.name ? " selected" : ""}`}
                  onClick={() => handleNpcClick(n)}
                >
                  <span style={{ fontSize: 20, marginRight: 8, cursor: "pointer" }}
                    onClick={e => {
                      e.stopPropagation();
                      setEditIconOpen(true);
                    }}
                    title="아이콘(이미지/이모지) 변경"
                  >
                    {n.icon.startsWith('http') ? (
                        <img
                            src={n.icon}
                            alt="icon"
                            style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            objectFit: "cover",
                            marginRight: 8,
                            background: "#fafafa",
                            border: "1px solid #e3e3e3",
                            verticalAlign: "middle"
                            }}
                        />
                        ) : (
                        <span
                            style={{
                            fontSize: 22,
                            marginRight: 8,
                            verticalAlign: "middle"
                            }}
                        >
                            {n.icon}
                        </span>
                        )}
                  </span>
                  {n.name}
                </li>
              )}
            </ul>
          )}
        </div>

        {/* 오른쪽: npc 상세 */}
        <div className="npc-detail-area">
          {selectedNpc ? (
            <div>
              <div className="npc-detail-title">
                {/* 아이콘: 이미지면 이미지로, 아니면 이모지로 */}
                {selectedNpc.icon.startsWith("http") ? (
                    <img
                    src={selectedNpc.icon}
                    alt="아이콘"
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        objectFit: "cover",
                        marginRight: 12,
                        background: "#fafafa",
                        border: "1px solid #e3e3e3",
                        verticalAlign: "middle"
                    }}
                    />
                ) : (
                    <span
                    className="npc-detail-icon"
                    style={{
                        fontSize: 40,
                        marginRight: 12,
                        verticalAlign: "middle"
                    }}
                    >
                    {selectedNpc.icon}
                    </span>
                )}
                {/* 이름 */}
                <span style={{
                    fontSize: 22,
                    fontWeight: 700,
                    verticalAlign: "middle"
                }}>
                    {selectedNpc.name}
                </span>
                {/* 이름 편집 버튼 */}
                <button
                  style={{
                    background: "none", border: "none", marginLeft: 6, cursor: "pointer",
                    color: "#888", fontSize: 18, verticalAlign: "middle"
                  }}
                  onClick={() => setEditNameOpen(true)}
                  title="이름 수정"
                >
                  ✏️
                </button>
              </div>
              <div className="npc-detail-block" style={{ marginTop: 10 }}>
                <span style={{ fontWeight: 600 }}>
                  <button
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#1ec171", marginRight: 6, fontSize: 18, verticalAlign: "middle"
                    }}
                    onClick={() => setEditLocOpen(true)}
                    title="위치 수정"
                  >✏️</button>
                  위치:
                </span>
                &nbsp; ( {selectedNpc.location_x}, {selectedNpc.location_y}, {selectedNpc.location_z} )
                <br />
                <span style={{ fontWeight: 600 }}>
                  <button
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#1ec171", marginRight: 6, fontSize: 18, verticalAlign: "middle"
                    }}
                    onClick={() => setEditLineOpen(true)}
                    title="대사 수정"
                  >✏️</button>
                  대사:
                </span>
                <div className="npc-detail-line" style={{ marginTop: 3, marginLeft: 0 }}>{selectedNpc.line || "-"}</div>
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
