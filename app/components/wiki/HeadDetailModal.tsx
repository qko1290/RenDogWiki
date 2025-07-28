import React from "react";
import NpcPictureSlider from "./NpcPictureSlider";

type Head = {
  id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};

type Props = {
  head: Head;
  docIcon?: string;
  onClose: () => void;
};

export default function HeadDetailModal({ head, docIcon, onClose }: Props) {
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
          width: 600, minHeight: 400, background: "#fafbfc",
          padding: 20, display: "flex", flexDirection: "column", alignItems: "center", borderRight: "1.5px solid #eee", justifyContent: "center"
        }}>
          <div style={{
            display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center",
            marginBottom: 18, gap: 18
          }}>
            {docIcon && (
              docIcon.startsWith('http')
                ? <img src={docIcon} alt="icon"
                  style={{ width: 65, height: 65, borderRadius: 12, objectFit: "cover", border: "2px solid #e0e0e0", boxShadow: "0 1.5px 10px #e4e5e8" }}
                />
                : <span style={{ fontSize: 55 }}>{docIcon}</span>
            )}
            <div style={{ fontSize: 30, fontWeight: 700 }}>{head.order}번 머리</div>
          </div>
          <NpcPictureSlider pictures={head.pictures || []} />
        </div>
        {/* 우측: 위치 정보 */}
        <div style={{ flex: 1, padding: "54px 44px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 250, marginTop: 40 }}>
          <table style={{ width: "100%", fontSize: 19, lineHeight: 2.1, borderSpacing: 0 }}>
            <tbody>
              <tr>
                <td style={{ color: "#666", width: 90, fontWeight: 600 }}>위치</td>
                <td><b>{[head.location_x, head.location_y, head.location_z].join(', ')}</b></td>
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
