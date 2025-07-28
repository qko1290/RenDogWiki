import React from "react";
import NpcPictureSlider from "./NpcPictureSlider";

type Npc = {
  id: number;
  name: string;
  icon: string;
  pictures?: string[];
  location_x: number;
  location_y: number;
  location_z: number;
  line?: string;
  quest?: string;
  rewards?: { icon?: string; text: string }[];
  requirement?: string;
};

type Props = {
  npc: Npc;
  onClose: () => void;
};

export default function NpcDetailModal({ npc, onClose }: Props) {
  // rootCatName 분기에 따라 퀘스트/일반 NPC 상세 구분 가능(부모에서)
  return (
    <div
      style={{
        position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh",
        background: "rgba(0,0,0,0.28)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          minWidth: 1200, maxWidth: 1040, minHeight: 560,
          borderRadius: 24, position: "relative",
          boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
          padding: 0, display: "flex", flexDirection: "row", overflow: "hidden",
          alignItems: "flex-start"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 좌측: 사진 */}
        <div style={{
          width: 600, minHeight: 440, background: "#fafbfc",
          padding: 20, display: "flex", flexDirection: "column", alignItems: "center", borderRight: "1.5px solid #eee", justifyContent: "center"
        }}>
          <div style={{
            display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center",
            marginBottom: 18, gap: 18
          }}>
            <img src={npc.icon} alt="icon"
              style={{
                width: 65, height: 65, borderRadius: 12,
                objectFit: "cover", border: "2px solid #e0e0e0", boxShadow: "0 1.5px 10px #e4e5e8"
              }} />
            <div style={{ fontSize: 35, fontWeight: 700 }}>{npc.name}</div>
          </div>
          <NpcPictureSlider pictures={npc.pictures || []} />
        </div>
        {/* 우측: 정보 */}
        <div style={{ flex: 1, padding: "54px 44px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 350, marginTop: 40 }}>
          <table style={{ width: "100%", fontSize: 19, lineHeight: 2.1, borderSpacing: 0 }}>
            <tbody>
              <tr>
                <td style={{ color: "#666", width: 120, fontWeight: 600 }}>위치</td>
                <td><b>{[npc.location_x, npc.location_y, npc.location_z].join(', ')}</b></td>
              </tr>
              {npc.quest && (
                <tr>
                  <td style={{ color: "#666", fontWeight: 600 }}>퀘스트</td>
                  <td>{npc.quest}</td>
                </tr>
              )}
              {npc.rewards && (
                <tr>
                  <td style={{ color: "#666", fontWeight: 600 }}>보상</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {npc.rewards.map((rw, i) => (
                        <span key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {rw.icon && (
                            rw.icon.startsWith('http')
                              ? <img src={rw.icon} alt="보상" style={{ width: 26, height: 26, verticalAlign: "middle", marginRight: 3 }} />
                              : <span style={{ fontSize: 22, marginRight: 3 }}>{rw.icon}</span>
                          )}
                          <span>{rw.text}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {npc.requirement && (
                <tr>
                  <td style={{ color: "#666", fontWeight: 600 }}>선행퀘스트</td>
                  <td>{npc.requirement}</td>
                </tr>
              )}
              <tr>
                <td style={{ color: "#666", fontWeight: 600, verticalAlign: "top" }}>대사</td>
                <td>
                  <div style={{
                    background: "#f6f8fa", padding: "15px 16px", borderRadius: 8, minHeight: 80, whiteSpace: "pre-line", fontSize: 17
                  }}>
                    {npc.line || <span style={{ color: "#bbb" }}>- 대사 없음 -</span>}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          style={{
            position: "absolute", right: 18, top: 18, fontSize: 30,
            background: "none", border: "none", cursor: "pointer", color: "#777"
          }}
          onClick={onClose}
        >×</button>
      </div>
    </div>
  );
}
