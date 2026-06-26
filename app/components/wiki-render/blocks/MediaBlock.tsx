import React from 'react';
import type { WikiRenderMode } from '../types';

type MediaKind = 'image' | 'video';

type RenderImageArgs = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  style: React.CSSProperties;
  className?: string;
};

type MediaBlockProps = {
  mode: WikiRenderMode;
  kind: MediaKind;
  src?: string | null;
  alt?: string | null;
  textAlign?: string | null;
  width?: number;
  height?: number;
  selected?: boolean;
  focused?: boolean;
  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * 에디터 전용 버튼 자리.
   * 예: 크기 조절 버튼, 삭제 버튼, 선택 툴바
   */
  editControls?: React.ReactNode;

  /**
   * 문서 조회 전용 버튼 자리.
   * 예: 원본 보기, 복사, 확대 보기
   */
  readControls?: React.ReactNode;

  /**
   * 읽기 렌더러에서 SmartImage 같은 별도 이미지 컴포넌트를 쓰기 위한 슬롯.
   * 이걸로 에디터와 문서 렌더러의 이미지 로딩 방식 차이를 유지한다.
   */
  renderImage?: (args: RenderImageArgs) => React.ReactNode;

  /**
   * 에디터에서 실제 img 크기를 읽기 위한 ref.
   */
  imageRef?: React.Ref<HTMLImageElement>;
};

function justifyFromAlign(textAlign?: string | null) {
  if (textAlign === 'left') return 'flex-start';
  if (textAlign === 'right') return 'flex-end';
  return 'center';
}

function numberOrUndefined(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export default function MediaBlock({
  mode,
  kind,
  src,
  alt,
  textAlign,
  width,
  height,
  selected,
  focused,
  attributes,
  children,
  editControls,
  readControls,
  renderImage,
  imageRef,
}: MediaBlockProps) {
  const safeSrc = String(src || '');
  const resolvedWidth = numberOrUndefined(width);
  const resolvedHeight = numberOrUndefined(height);
  const controls = mode === 'edit' ? editControls : readControls;

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: justifyFromAlign(textAlign),
    margin: mode === 'read' ? '10px 0' : '8px 0',
    position: 'relative',
  };

  const mediaShellStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    maxWidth: '100%',
    outline:
      mode === 'edit' && selected && focused
        ? '2px solid #2a90ff'
        : 'none',
    borderRadius: 6,
  };

  const mediaStyle: React.CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    width: resolvedWidth ? `${resolvedWidth}px` : undefined,
    height: resolvedHeight ? `${resolvedHeight}px` : undefined,
    objectFit: resolvedWidth && resolvedHeight ? 'contain' : undefined,
    borderRadius: 6,
  };

  const mediaNode =
    kind === 'image' ? (
      renderImage ? (
        renderImage({
          src: safeSrc,
          alt: alt || '',
          width: resolvedWidth,
          height: resolvedHeight,
          style: mediaStyle,
          className: 'wiki-media-image',
        })
      ) : (
        <img
          ref={imageRef}
          src={safeSrc}
          alt={alt || ''}
          className="wiki-media-image"
          style={mediaStyle}
          contentEditable={mode === 'edit' ? false : undefined}
          draggable={mode === 'edit' ? false : undefined}
        />
      )
    ) : (
      <video
        src={safeSrc}
        controls
        preload="metadata"
        className="wiki-media-video"
        style={mediaStyle}
        contentEditable={mode === 'edit' ? false : undefined}
      />
    );

  return (
    <div
      {...attributes}
      className={[
        'wiki-media-block',
        `wiki-media-${kind}`,
        mode === 'edit' ? 'wiki-media-edit' : 'wiki-media-read',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...wrapperStyle,
        ...(attributes?.style || {}),
      }}
    >
      <span
        className="wiki-media-shell"
        style={mediaShellStyle}
        contentEditable={mode === 'edit' ? false : undefined}
        suppressContentEditableWarning
      >
        {safeSrc ? mediaNode : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 160,
              minHeight: 90,
              border: '1px dashed var(--border)',
              borderRadius: 6,
              color: 'var(--muted-foreground)',
              fontSize: 13,
            }}
          >
            {kind === 'image' ? '이미지 없음' : '영상 없음'}
          </span>
        )}

        {controls ? (
          <span
            className="wiki-media-controls"
            contentEditable={false}
            suppressContentEditableWarning
          >
            {controls}
          </span>
        ) : null}
      </span>

      {mode === 'edit' ? children : null}
    </div>
  );
}