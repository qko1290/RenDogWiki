// =============================================
// File: C:\next\rdwiki\app\components\manager\DetailTitle.tsx
// =============================================
/**
 * 상세 화면 상단 타이틀 영역(아이콘 + 제목)
 * - 아이콘/제목은 클릭 가능하도록 버튼으로 전환(핸들러 있을 때만)
 * - 레거시(onEditTitle/onEditIcon)와 현행(onTitleClick/onIconClick) 핸들러 모두 지원
 * - 외부 스타일 클래스(mgr-title, mgr-title-icon-btn, mgr-title-text 등) 의존 구조 유지
 */

import React from 'react';

type DetailTitleProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** 현행 핸들러 */
  onTitleClick?: () => void;
  onIconClick?: () => void;
  /** 레거시 호환 핸들러 */
  onEditTitle?: () => void;
  onEditIcon?: () => void;
  /** 현재 디자인에선 사용하지 않지만, 외부 호환상 유지 */
  showEditButtons?: boolean;
  className?: string;
};

const DetailTitle = React.memo(function DetailTitle({
  icon,
  title,
  onTitleClick,
  onIconClick,
  onEditTitle,
  onEditIcon,
  showEditButtons = false, // 디자인상 미사용 (호환 유지용)
  className = '',
}: DetailTitleProps) {
  // 레거시/신규 핸들러 매핑(신규 > 레거시 우선)
  const handleIcon = onIconClick ?? onEditIcon;
  const handleTitle = onTitleClick ?? onEditTitle;

  // 핸들러 유무에 따라 button/div 선택
  const IconWrap: any = handleIcon ? 'button' : 'div';
  const TitleWrap: any = handleTitle ? 'button' : 'div';

  return (
    <div className={['mgr-title', className].filter(Boolean).join(' ')}>
      <IconWrap
        className="mgr-title-icon-btn"
        onClick={handleIcon}
        aria-label={handleIcon ? '아이콘 변경' : undefined}
        type={handleIcon ? 'button' : undefined}
      >
        {icon}
      </IconWrap>

      <TitleWrap
        className={`mgr-title-text${handleTitle ? ' mgr-title-clickable' : ''}`}
        onClick={handleTitle}
        type={handleTitle ? 'button' : undefined}
        title={handleTitle ? '이름 수정' : undefined}
      >
        {title}
      </TitleWrap>

      {/* showEditButtons: 현 디자인에선 시각적 편집 버튼을 노출하지 않음(호환 필드 유지) */}
    </div>
  );
});

export default DetailTitle;
export type { DetailTitleProps };
