import React from 'react';

type Props = {
  label: React.ReactNode;
  value: React.ReactNode;
  onEdit?: () => void;
  className?: string;
};

export default function DetailRow({ label, value, onEdit, className }: Props) {
  return (
    <div className={`mgr-row ${className ?? ''}`}>
      {onEdit && (
        <button
          type="button"
          className="mgr-edit-btn"
          onClick={onEdit}
          title="수정"
          aria-label="수정"
        >
          🖉
        </button>
      )}
      <b className="mgr-label">{label}</b>
      {value}
    </div>
  );
}
