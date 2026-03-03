// =============================================
// File: app/wiki/layout.tsx
// (wiki route 전용 전역 CSS 로드 위치 고정)
// =============================================
import './css/wiki.css';

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return children;
}