import React, { useState } from 'react';

const NpcPictureSlider = ({ pictures = [] }: { pictures: string[] }) => {
  const [idx, setIdx] = useState(0);
  if (!pictures.length) return (
    <div style={{
      width: 500, height: 400, background: '#e0e0e0', borderRadius: 22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#aaa', fontSize: 20
    }}>사진 없음</div>
  );
  return (
    <div style={{
      position: "relative", width: 500, height: 400, borderRadius: 22, overflow: "hidden",
      background: "#00c463", display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <img src={pictures[idx]} alt="npc" style={{
        width: "100%", height: "100%", objectFit: "cover", display: "block",
      }} />
      {pictures.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + pictures.length) % pictures.length)}
            style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", outline: "none", cursor: "pointer", opacity: 0.32, zIndex: 10,
            }}
            aria-label="이전"
          >
            <svg width="38" height="38" viewBox="0 0 38 38">
              <polyline points="22,12 16,19 22,26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % pictures.length)}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", outline: "none", cursor: "pointer", opacity: 0.32, zIndex: 10,
            }}
            aria-label="다음"
          >
            <svg width="38" height="38" viewBox="0 0 38 38">
              <polyline points="16,12 22,19 16,26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
};

export default NpcPictureSlider;
