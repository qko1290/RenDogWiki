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
  width?: number | string | null;
  height?: number | string | null;

  selected?: boolean;
  focused?: boolean;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  renderImage?: (args: RenderImageArgs) => React.ReactNode;
  imageRef?: React.Ref<HTMLImageElement>;
};

function readJustifyFromAlign(
  textAlign?: string | null
): 'flex-start' | 'center' | 'flex-end' {
  if (textAlign === 'center') return 'center';
  if (textAlign === 'right') return 'flex-end';

  // 원본 WikiReadRenderer의 flexJustifyFromAlign 기본값
  return 'flex-start';
}

function editJustifyFromAlign(
  textAlign?: string | null
): 'flex-start' | 'center' | 'flex-end' {
  if (textAlign === 'left') return 'flex-start';
  if (textAlign === 'right') return 'flex-end';

  // 원본 Element.tsx ImageBlock / VideoBlock 기본값
  return 'center';
}

function numberOrUndefined(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  return undefined;
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

  /**
   * ================================
   * READ MODE
   * ================================
   *
   * 원본 WikiReadRenderer 기준:
   * - textAlign은 flexJustifyFromAlign으로 처리
   * - 기본값은 flex-start
   * - width/height는 실제 CSS width/height로 반영
   * - 에디터용 90% maxWidth 방식 사용 금지
   */
  if (mode === 'read') {
    const justifyContent = readJustifyFromAlign(textAlign);

    const outerStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: justifyContent,
      width: '100%',
      margin: '10px 0',
      ...(attributes?.style || {}),
    };

    const readMediaStyle: React.CSSProperties = {
      display: 'block',
      maxWidth: '100%',

      /**
       * 핵심:
       * 기존 MediaBlock은 width를 maxWidth로만 줬는데,
       * 읽기 화면에서는 실제 표시 크기를 맞추려면 width 자체를 줘야 한다.
       */
      width: resolvedWidth ? `${resolvedWidth}px` : undefined,
      height: resolvedHeight ? `${resolvedHeight}px` : 'auto',
    };

    const mediaNode =
      kind === 'image' ? (
        renderImage ? (
          renderImage({
            src: safeSrc,
            alt: alt || '',
            width: resolvedWidth,
            height: resolvedHeight,
            style: readMediaStyle,
            className: 'wiki-media-image',
          })
        ) : (
          <img
            src={safeSrc}
            alt={alt || ''}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="wiki-media-image"
            style={readMediaStyle}
          />
        )
      ) : (
        <video
          src={safeSrc}
          controls
          playsInline
          preload="metadata"
          className="wiki-media-video"
          style={{
            ...readMediaStyle,
            background: '#000',
          }}
        />
      );

    return (
      <div
        {...attributes}
        className={[
          'wiki-media-block',
          `wiki-media-${kind}`,
          'wiki-media-read',
          attributes?.className || '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={outerStyle}
      >
        {safeSrc ? mediaNode : null}
        {controls}
      </div>
    );
  }

  /**
   * ================================
   * EDIT MODE
   * ================================
   *
   * 원본 Element.tsx ImageBlock / VideoBlock 기준:
   * - 기본 정렬 center
   * - 바깥 margin: 16px 0
   * - 내부 flex wrapper 사용
   * - media maxWidth: width ? width + 'px' : '90%'
   * - height: height ? height + 'px' : 'auto'
   * - 이미지 border, 영상 outline
   */
  const justifyContent = editJustifyFromAlign(textAlign);

  const outerStyle: React.CSSProperties = {
    margin: '16px 0',
    ...(attributes?.style || {}),
  };

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

  const baseEditMediaStyle: React.CSSProperties = {
    maxWidth: resolvedWidth ? `${resolvedWidth}px` : '90%',
    height: resolvedHeight ? `${resolvedHeight}px` : 'auto',
    borderRadius: 10,
    boxShadow: '0 2px 12px 0 #0001',
    display: 'block',
  };

  const imageStyle: React.CSSProperties = {
    ...baseEditMediaStyle,
    background: '#fff',
    border: selected && focused ? '2px solid #2a90ff' : 'none',
    transition: 'border 0.1s',
  };

  const videoStyle: React.CSSProperties = {
    ...baseEditMediaStyle,
    background: '#000',
    outline: selected && focused ? '2px solid #2a90ff' : 'none',
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
        'wiki-media-edit',
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

      {children}
    </div>
  );
}