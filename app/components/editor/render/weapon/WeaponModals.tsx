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

// -------------------- 공통: 모달 키보드 핫키 --------------------
// - Enter: 확인/저장
// - Escape: 닫기
// - Slate/에디터가 이벤트를 먹는 경우가 있어 capture=true 로 먼저 잡음
// - 한글 IME 조합 중 Enter 오작동 방지
// - textarea/contentEditable 에서는 Enter를 뺏지 않음(확장 대비)
const useModalHotkeys = (params: {
  open: boolean;
  onEnter?: () => void;
  onEscape?: () => void;
  disabled?: boolean;
}) => {
  const { open, onEnter, onEscape, disabled } = params;

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      // IME(한글 조합) 중 Enter 트리거 방지
      // 일부 환경에서는 keyCode=229로도 들어옴
      // @ts-ignore
      if ((e as any).isComposing || (e as any).keyCode === 229) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTextArea = tag === 'textarea';
      const isContentEditable = !!target && (target as any).isContentEditable;

      if (e.key === 'Escape') {
        if (!onEscape) return;
        e.preventDefault();
        e.stopPropagation();
        onEscape();
        return;
      }

      if (e.key === 'Enter') {
        if (!onEnter) return;
        if (isTextArea || isContentEditable) return;

        e.preventDefault();
        e.stopPropagation();
        onEnter();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onEnter, onEscape, disabled]);
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
    'boss',
    'mini-boss',
    'monster',
    'rune',
    'fishing-rod',
    'transcend-epic',
    'transcend-unique',
    'transcend-legend',
    'transcend-divine',
    'transcend-superior',
    'armor',
    'weapon',
    'spirit',
  ];

  // (선택 모달은 Enter로 확인이 뚜렷하지 않아서 기존 동작 유지)
  // Esc로 닫기만 자연스럽게 추가
  useModalHotkeys({
    open,
    onEscape: onClose,
  });

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

  const handleSave = React.useCallback(() => {
    onSave(name.trim() || '새 무기 이름');
  }, [name, onSave]);

  // ✅ Enter=저장, Esc=닫기
  useModalHotkeys({
    open,
    onEnter: handleSave,
    onEscape: onClose,
  });

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

  const handleSave = React.useCallback(() => {
    onSave({
      ...local,
      levels: normalizeStatLevels(local.levels, weaponType),
    });
  }, [local, onSave, weaponType]);

  // ✅ Enter=저장(읽기 전용 제외), Esc=닫기
  useModalHotkeys({
    open: open && !!statKey,
    onEnter: readOnly ? undefined : handleSave,
    onEscape: onClose,
  });

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

  const base = React.useMemo(
    () => ensureWeaponStats(stats, weaponType),
    [stats, weaponType],
  );

  const maxCount = base.length;

  // 현재 활성화(enabled=true) 된 항목 수
  const getEnabledCount = () => base.filter((s) => s.enabled).length;

  const [count, setCount] = React.useState<number>(() => getEnabledCount());

  // 모달이 다시 열릴 때마다 현재 상태를 기준으로 초기값 리셋
  React.useEffect(() => {
    if (open) {
      setCount(getEnabledCount());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stats, weaponType]);

  const clamp = React.useCallback(
    (n: number) => {
      if (Number.isNaN(n)) return 0;
      if (n < 0) return 0;
      if (n > maxCount) return maxCount;
      return n;
    },
    [maxCount],
  );

  const handleChange = (next: number) => {
    setCount(clamp(next));
  };

  const handleSave = React.useCallback(() => {
    // 기존 enabled 패턴을 기준으로 개수만 맞춰 조정
    const originalEnabledIndices: number[] = [];
    base.forEach((s, idx) => {
      if (s.enabled) originalEnabledIndices.push(idx);
    });

    const oldCount = originalEnabledIndices.length;
    const target = clamp(count);

    // 깊은 복사(불변성 유지)
    const nextStats = base.map((s) => ({ ...s }));

    if (target === oldCount) {
      // 개수 변화 없음 → 그대로 저장
      onSave(nextStats);
      return;
    }

    if (target < oldCount) {
      // 줄어드는 경우: 현재 enabled 중 "뒤에서부터" 끄기
      const toDisable = originalEnabledIndices.slice(target);
      toDisable.forEach((idx) => {
        nextStats[idx] = { ...nextStats[idx], enabled: false };
      });
    } else {
      // 늘어나는 경우: 아직 disabled 인 것들 중 "앞에서부터" 켜기
      let need = target - oldCount;
      for (let i = 0; i < nextStats.length && need > 0; i++) {
        if (!nextStats[i].enabled) {
          nextStats[i] = { ...nextStats[i], enabled: true };
          need--;
        }
      }
    }

    onSave(nextStats);
  }, [base, clamp, count, onSave]);

  // ✅ Enter=저장, Esc=닫기
  useModalHotkeys({
    open,
    onEnter: handleSave,
    onEscape: onClose,
  });

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
            정보 항목 개수 설정
          </div>

          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            무기 카드에 표시할 <b>정보 항목의 개수</b>를 설정합니다.
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              onClick={() => handleChange(count - 1)}
              style={{
                borderRadius: 999,
                border: '1px solid #4b5563',
                padding: '4px 10px',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              −
            </button>

            <input
              type="number"
              value={count}
              min={0}
              max={maxCount}
              onChange={(e) => handleChange(Number(e.target.value))}
              style={{
                width: 80,
                textAlign: 'center',
                borderRadius: 8,
                border: '1px solid #4b5563',
                background: '#020617',
                padding: '6px 8px',
                color: '#e5e7eb',
                fontSize: 14,
                outline: 'none',
              }}
            />

            <button
              type="button"
              onClick={() => handleChange(count + 1)}
              style={{
                borderRadius: 999,
                border: '1px solid #4b5563',
                padding: '4px 10px',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              +
            </button>

            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              최대 {maxCount}개
            </span>
          </div>

          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              marginBottom: 12,
            }}
          >
            현재 설정된 개수: <b>{count}개</b>
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

  // 비디오는 Enter 동작이 의미 없어서 Esc로 닫기만 추가(기존 동작 유지)
  useModalHotkeys({
    open,
    onEscape: onClose,
  });

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
