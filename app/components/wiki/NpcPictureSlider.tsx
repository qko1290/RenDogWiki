import React, { useState } from 'react';

const NpcPictureSlider = ({ pictures = [] }: { pictures: string[] }) => {
  const [idx, setIdx] = useState(0);
  if (!pictures.length) return (
    <div className="npc-picture-slider-empty">사진 없음</div>
  );
  return (
    <div className="npc-picture-slider">
      <img src={pictures[idx]} alt="npc" className="npc-picture-img" />
      {pictures.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + pictures.length) % pictures.length)}
            className="npc-picture-slider-btn npc-picture-slider-btn-left"
            aria-label="이전"
          >
            <svg width="38" height="38" viewBox="0 0 38 38">
              <polyline points="22,12 16,19 22,26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % pictures.length)}
            className="npc-picture-slider-btn npc-picture-slider-btn-right"
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
