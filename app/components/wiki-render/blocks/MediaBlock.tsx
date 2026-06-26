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

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  renderImage?: (args: RenderImageArgs) => React.ReactNode;
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
    ...(attributes?.style || {}),

    display: 'flex',
    justifyContent: justifyFromAlign(textAlign),
    width: '100%',

    /**
     * 원본 WikiReadRenderer의 이미지/영상은 본문 블록 사이에서
     * 별도 카드형 스타일을 만들지 않고, 정렬용 flex wrapper 중심으로 처리된다.
     * 따라서 여기서는 배경/테두리/그림자 같은 새 디자인을 넣지 않는다.
     */
    margin: mode === 'read' ? '10px 0' : '8px 0',
    position: 'relative',
  };

  const shellStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    maxWidth: '100%',
    lineHeight: 0,

    /**
     * 에디터 선택 표시는 원본처럼 media 자체에만 얇게 표시한다.
     * 읽기 모드에는 절대 표시하지 않는다.
     */
    boxShadow:
      mode === 'edit' && selected && focused
        ? '0 0 0 2px #2a90ff'
        : undefined,
  };

  const mediaStyle: React.CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    width: resolvedWidth ? `${resolvedWidth}px` : undefined,
    height: resolvedHeight ? `${resolvedHeight}px` : undefined,
    objectFit: resolvedWidth && resolvedHeight ? 'contain' : undefined,

    /**
     * 원본 쪽은 이미지/영상 자체를 카드처럼 새로 꾸미지 않는다.
     * borderRadius만 최소 유지한다.
     */
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
      style={wrapperStyle}
    >
      <span
        className="wiki-media-shell"
        style={shellStyle}
        contentEditable={mode === 'edit' ? false : undefined}
        suppressContentEditableWarning
      >
        {safeSrc ? mediaNode : null}

        {controls ? (
          <span
            className="wiki-media-controls"
            contentEditable={false}
            suppressContentEditableWarning
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                pointerEvents: 'auto',
              }}
            >
              {controls}
            </span>
          </span>
        ) : null}
      </span>

      {mode === 'edit' ? children : null}
    </div>
  );
}