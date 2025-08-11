import React from 'react';

type Props = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  onEditTitle?: () => void;
  onEditIcon?: () => void;
  className?: string;
};

export default function DetailRow({
  icon,
  title,
  onTitleClick,
  onIconClick,
  showEditButtons = false, // 기본 false로(연필 숨김)
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  onTitleClick?: () => void;
  onIconClick?: () => void;
  showEditButtons?: boolean;
}) {
  const IconWrap = onIconClick ? 'button' : 'div';
  const TitleWrap = onTitleClick ? 'button' : 'div';

  return (
    <div className="mgr-title">
      <IconWrap
        className="mgr-title-icon-btn"
        onClick={onIconClick}
        aria-label="아이콘 변경"
        type={onIconClick ? 'button' : undefined}
      >
        {icon}
      </IconWrap>

      <TitleWrap
        className={`mgr-title-text${onTitleClick ? ' mgr-title-clickable' : ''}`}
        onClick={onTitleClick}
        type={onTitleClick ? 'button' : undefined}
        title={onTitleClick ? '이름 수정' : undefined}
      >
        {title}
      </TitleWrap>

      {/* showEditButtons가 true여도 현 디자인에서는 사용하지 않음 */}
    </div>
  );
}
