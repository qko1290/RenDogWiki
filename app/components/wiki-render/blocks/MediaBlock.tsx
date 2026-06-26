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

function justifyFromAlign(textAlign?: string | null): 'flex-start' | 'center' | 'flex-end' {
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
  const justifyContent = justifyFromAlign(textAlign);
  const controls = mode === 'edit' ? editControls : readControls;

  /**
   * 원본 Element.tsx 기준:
   * <div {...attributes} style={{ margin: '16px 0' }}>
   */
  const outerStyle: React.CSSProperties = {
    margin: mode === 'edit' ? '16px 0' : '16px 0',
    ...(attributes?.style || {}),
  };

  /**
   * 원본 Element.tsx 기준:
   * display:flex / justifyContent / alignItems:flex-start / minHeight:40
   */
  const alignWrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent,
    alignItems: 'flex-start',
    minHeight: 40,
  };

  const shellStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  };

  /**
   * 원본 이미지/영상 공통 크기 처리:
   * maxWidth: width ? width + 'px' : '90%'
   * height: height ? height + 'px' : 'auto'
   *
   * 여기서 width를 직접 넣으면 원본보다 커지거나 정렬이 틀어진다.
   * 원본처럼 maxWidth만 제한해야 함.
   */
  const baseMediaStyle: React.CSSProperties = {
    maxWidth: resolvedWidth ? `${resolvedWidth}px` : '90%',
    height: resolvedHeight ? `${resolvedHeight}px` : 'auto',
    borderRadius: 10,
    boxShadow: '0 2px 12px 0 #0001',
    display: 'block',
  };

  const imageStyle: React.CSSProperties = {
    ...baseMediaStyle,
    background: '#fff',
    border: mode === 'edit' && selected && focused ? '2px solid #2a90ff' : 'none',
    transition: 'border 0.1s',
  };

  const videoStyle: React.CSSProperties = {
    ...baseMediaStyle,
    background: '#000',
    outline: mode === 'edit' && selected && focused ? '2px solid #2a90ff' : 'none',
    transition: 'outline 0.1s',
  };

  const mediaNode =
    kind === 'image' ? (
      renderImage ? (
        renderImage({
          src: safeSrc,
          alt: alt || '',
          width: resolvedWidth,
          height: resolvedHeight,
          style: imageStyle,
          className: 'wiki-media-image',
        })
      ) : (
        <img
          ref={imageRef}
          src={safeSrc}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          className="wiki-media-image"
          style={imageStyle}
          contentEditable={false}
        />
      )
    ) : (
      <video
        src={safeSrc}
        controls
        playsInline
        preload="metadata"
        className="wiki-media-video"
        style={videoStyle}
        contentEditable={false}
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
      style={outerStyle}
    >
      <div
        key={textAlign || 'center'}
        contentEditable={false}
        suppressContentEditableWarning
        style={alignWrapperStyle}
      >
        <div style={shellStyle}>
          {safeSrc ? mediaNode : null}
          {controls}
        </div>
      </div>

      {mode === 'edit' ? children : null}
    </div>
  );
}