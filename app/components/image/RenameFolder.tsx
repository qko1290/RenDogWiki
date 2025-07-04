export default function RenameFolder({ onStart, disabled, className }: { onStart: () => void; disabled?: boolean; className?: string; }) {
  return (
    <button
      type="button"
      className={className}
      onClick={onStart}
      disabled={disabled}
      title="이름 변경"
    >
      ✏️ 이름변경
    </button>
  );
}