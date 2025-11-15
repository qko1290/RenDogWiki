// components/editor/render/WeaponModals.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import type {
  WeaponType,
  WeaponStatConfig,
  WeaponStatKey,
} from '@/types/slate';
import {
  WEAPON_TYPES_META,
  WEAPON_STAT_PRESET,
  ensureWeaponStats,
  createEmptyWeaponStat,
  normalizeStatLevels,
  getWeaponLevelLabels,
} from './weaponStatUtils';

// -------------------- 공통 Portal 래퍼 --------------------

const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // SSR 환경에서는 document 가 없으니 방어
  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(children, document.body);
};

// -------------------- Weapon Type Select Modal --------------------

export type WeaponTypeSelectModalProps = {
  open: boolean;
  currentType: WeaponType;
  onClose: () => void;
  onSelect: (t: WeaponType) => void;
};

export const WeaponTypeSelectModal: React.FC<WeaponTypeSelectModalProps> = ({
  open,
  currentType,
  onClose,
  onSelect,
}) => {
  if (!open) return null;

  const types: WeaponType[] = [
    'block',
    'epic',
    'unique',
    'legendary',
    'divine',
    'superior',
    'class',
    'hidden',
    'limited',
    'ancient',
  ];

  return (
    <ModalPortal>
      <div
        contentEditable={false}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}
        onMouseDown={onClose}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 360,
            maxWidth: '90%',
            borderRadius: 14,
            background: '#020617',
            padding: '16px 18px 14px',
            boxShadow: '0 18px 40px rgba(0,0,0,.55)',
            color: '#e5e7eb',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            무기 유형 선택
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
              marginBottom: 14,
            }}
          >
            {types.map((t) => {
              const meta = WEAPON_TYPES_META[t];
              const active = t === currentType;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSelect(t)}
                  style={{
                    borderRadius: 999,
                    border: active ? 'none' : '1px solid #1f2937',
                    padding: '6px 0',
                    background: active
                      ? meta.headerBg
                      : 'linear-gradient(90deg,#020617,#020617)',
                    color: active ? '#f9fafb' : '#9ca3af',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 1,
                    cursor: 'pointer',
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: 'right' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: '1px solid #4b5563',
                padding: '5px 14px',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// -------------------- Weapon Name Edit Modal --------------------

export type WeaponNameEditModalProps = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
};

export const WeaponNameEditModal: React.FC<WeaponNameEditModalProps> = ({
  open,
  initialName,
  onClose,
  onSave,
}) => {
  const [name, setName] = React.useState(initialName || '');

  React.useEffect(() => {
    if (open) setName(initialName || '');
  }, [open, initialName]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        contentEditable={false}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}
        onMouseDown={onClose}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 420,
            maxWidth: '90%',
            borderRadius: 14,
            background: '#020617',
            padding: '18px 20px 16px',
            boxShadow: '0 18px 40px rgba(0,0,0,.55)',
            color: '#e5e7eb',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            무기 이름 수정
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="무기 이름"
            autoFocus
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid #4b5563',
              background: '#020617',
              padding: '8px 10px',
              color: '#e5e7eb',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: '1px solid #4b5563',
                padding: '6px 14px',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => onSave(name.trim() || '새 무기 이름')}
              style={{
                borderRadius: 999,
                border: 'none',
                padding: '6px 16px',
                background: '#2563eb',
                color: '#f9fafb',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// -------------------- Weapon Stat Edit Modal --------------------

export type WeaponStatEditModalProps = {
  open: boolean;
  weaponType: WeaponType;
  stats: WeaponStatConfig[];
  statKey: WeaponStatKey | null;
  readOnly: boolean;
  onClose: () => void;
  onSave: (nextStat: WeaponStatConfig) => void;
};

export const WeaponStatEditModal: React.FC<WeaponStatEditModalProps> = ({
  open,
  weaponType,
  stats,
  statKey,
  readOnly,
  onClose,
  onSave,
}) => {
  if (!open || !statKey) return null;

  const original =
    stats.find((s) => s.key === statKey) ||
    createEmptyWeaponStat(statKey, weaponType, true);

  const [local, setLocal] = React.useState<WeaponStatConfig>({
    ...original,
    levels: normalizeStatLevels(original.levels, weaponType),
  });

  React.useEffect(() => {
    if (!open || !statKey) return;
    const base =
      stats.find((s) => s.key === statKey) ||
      createEmptyWeaponStat(statKey, weaponType, true);
    setLocal({
      ...base,
      levels: normalizeStatLevels(base.levels, weaponType),
    });
  }, [open, statKey, stats, weaponType]);

  const levels = getWeaponLevelLabels(weaponType);

  const handleLevelChange = (idx: number, value: string) => {
    setLocal((prev) => ({
      ...prev,
      levels: prev.levels.map((lv, i) =>
        i === idx ? { ...lv, value } : lv,
      ),
    }));
  };

  const handleSave = () => {
    onSave({
      ...local,
      levels: normalizeStatLevels(local.levels, weaponType),
    });
  };

  return (
    <ModalPortal>
      <div
        contentEditable={false}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}
        onMouseDown={onClose}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 420,
            maxWidth: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            borderRadius: 14,
            background: '#020617',
            padding: '18px 20px 16px',
            boxShadow: '0 18px 40px rgba(0,0,0,.55)',
            color: '#e5e7eb',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            무기 정보 편집
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 2fr 1fr',
              gap: 8,
              marginBottom: 10,
              fontSize: 12,
              color: '#9ca3af',
            }}
          >
            <span>표시 이름</span>
            <span>요약 값</span>
            <span>단위</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 2fr 1fr',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <input
              value={local.label}
              readOnly={readOnly}
              onChange={(e) =>
                setLocal((p) => ({ ...p, label: e.target.value }))
              }
              style={{
                borderRadius: 8,
                border: '1px solid #4b5563',
                background: '#020617',
                padding: '7px 8px',
                color: '#e5e7eb',
                fontSize: 14,
                width: 100,
                outline: 'none',
              }}
            />
            <input
              value={local.summary}
              readOnly={readOnly}
              onChange={(e) =>
                setLocal((p) => ({ ...p, summary: e.target.value }))
              }
              style={{
                borderRadius: 8,
                border: '1px solid #4b5563',
                background: '#020617',
                padding: '7px 8px',
                color: '#e5e7eb',
                fontSize: 14,
                width: 100,
                outline: 'none',
              }}
            />
            <input
              value={local.unit ?? ''}
              readOnly={readOnly}
              onChange={(e) =>
                setLocal((p) => ({ ...p, unit: e.target.value }))
              }
              style={{
                borderRadius: 8,
                border: '1px solid #4b5563',
                background: '#020617',
                padding: '7px 8px',
                color: '#e5e7eb',
                fontSize: 14,
                width: 100,
                outline: 'none',
              }}
            />
          </div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            강화별 상세 값
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 3fr',
              gap: 6,
            }}
          >
            {levels.map((label, idx) => (
              <React.Fragment key={label}>
                <div
                  style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    paddingTop: 4,
                  }}
                >
                  {label}
                </div>
                <input
                  value={local.levels[idx]?.value ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => handleLevelChange(idx, e.target.value)}
                  style={{
                    borderRadius: 8,
                    border: '1px solid #4b5563',
                    background: '#020617',
                    padding: '6px 8px',
                    color: '#e5e7eb',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </React.Fragment>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: '1px solid #4b5563',
                padding: '6px 14px',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSave}
                style={{
                  borderRadius: 999,
                  border: 'none',
                  padding: '6px 16px',
                  background: '#2563eb',
                  color: '#f9fafb',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// -------------------- Weapon Stat Select Modal --------------------

export type WeaponStatSelectModalProps = {
  open: boolean;
  weaponType: WeaponType;
  stats: WeaponStatConfig[];
  onClose: () => void;
  onSave: (nextStats: WeaponStatConfig[]) => void;
};

export const WeaponStatSelectModal: React.FC<WeaponStatSelectModalProps> = ({
  open,
  weaponType,
  stats,
  onClose,
  onSave,
}) => {
  if (!open) return null;

  const base = ensureWeaponStats(stats, weaponType);
  const [local, setLocal] = React.useState<WeaponStatConfig[]>(base);

  React.useEffect(() => {
    if (open) setLocal(ensureWeaponStats(stats, weaponType));
  }, [open, stats, weaponType]);

  const toggle = (key: WeaponStatKey) => {
    setLocal((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, enabled: !s.enabled } : s,
      ),
    );
  };

  const handleSave = () => {
    onSave(local);
  };

  return (
    <ModalPortal>
      <div
        contentEditable={false}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}
        onMouseDown={onClose}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 380,
            maxWidth: '90%',
            borderRadius: 14,
            background: '#020617',
            padding: '16px 18px 14px',
            boxShadow: '0 18px 40px rgba(0,0,0,.55)',
            color: '#e5e7eb',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            표시할 정보 선택
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 10,
            }}
          >
            데미지 / 쿨타임 / 타수 / 범위 / 지속시간 / 회복량 중에서 카드에
            표시할 항목을 선택합니다.
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: 12,
            }}
          >
            {local.map((s) => (
              <label
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 2px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => toggle(s.key)}
                />
                <span>{WEAPON_STAT_PRESET[s.key].label}</span>
              </label>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: '1px solid #4b5563',
                padding: '5px 14px',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                borderRadius: 999,
                border: 'none',
                padding: '5px 16px',
                background: '#2563eb',
                color: '#f9fafb',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// -------------------- Weapon Video Modal --------------------

export type WeaponVideoModalProps = {
  open: boolean;
  url: string;
  onClose: () => void;
};

export const WeaponVideoModal: React.FC<WeaponVideoModalProps> = ({
  open,
  url,
  onClose,
}) => {
  if (!open) return null;

  return (
    <ModalPortal>
      <div
        contentEditable={false}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2100,
        }}
        onMouseDown={onClose}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 'min(960px, 90vw)',
            maxHeight: '80vh',
            background: '#020617',
            borderRadius: 14,
            boxShadow: '0 20px 50px rgba(0,0,0,.75)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #111827',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#e5e7eb',
              fontSize: 14,
            }}
          >
            <span>공격 영상</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: '1px solid #4b5563',
                padding: '3px 10px',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
            }}
          >
            <video
              src={url}
              controls
              controlsList="nodownload"
              playsInline
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                background: '#000',
              }}
            />
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
