import React from 'react';
import SmartImage from '@/components/common/SmartImage';
import { cdn, withVersion } from '@lib/cdn';
import type {
  PriceTableImageRenderArgs,
  PriceTablePreparedItem,
  PriceTableRendererProps,
} from './types';
import {
  getPriceBadgeColor,
  isProbablyCompressedPrice,
  preparePriceTableItems,
  priceTableNameFontSize,
  priceTablePriceFontSize,
  smartNameBreakInfo,
  tokenizeCompressedForColor,
} from './priceTableViewModel';

function stop(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function defaultResolveImageSrc(src: string) {
  const raw = String(src ?? '').trim();
  return raw ? withVersion(cdn(raw)) : '';
}

function PriceName({ name }: { name: string }) {
  const info = smartNameBreakInfo(name);

  if (!info.broke) return <>{name}</>;

  return (
    <span>
      {info.parts[0]}
      <br />
      {info.parts[1]}
    </span>
  );
}

export function ColoredCompressedText({
  value,
}: {
  value: string | number | null | undefined;
}) {
  const raw = String(value ?? '');
  const s = raw.trim();

  if (!s) return <span className="ptc-price-text" />;

  if (s.includes('~')) {
    const [left, right] = s.split('~', 2);

    const leftChunks = isProbablyCompressedPrice(left)
      ? tokenizeCompressedForColor(left)
      : [{ text: left }];

    const rightChunks = isProbablyCompressedPrice(right)
      ? tokenizeCompressedForColor(right)
      : [{ text: right }];

    return (
      <span className="ptc-price-text">
        <span style={{ whiteSpace: 'nowrap' }}>
          {leftChunks.map((chunk, i) => (
            <span
              key={`l-${i}`}
              style={chunk.color ? { color: chunk.color } : undefined}
            >
              {chunk.text}
            </span>
          ))}
          <span style={{ color: 'var(--accent, #5b80f5)' }}>~</span>
        </span>

        <wbr />

        <span style={{ whiteSpace: 'nowrap' }}>
          {rightChunks.map((chunk, i) => (
            <span
              key={`r-${i}`}
              style={chunk.color ? { color: chunk.color } : undefined}
            >
              {chunk.text}
            </span>
          ))}
        </span>
      </span>
    );
  }

  const chunks = isProbablyCompressedPrice(s)
    ? tokenizeCompressedForColor(s)
    : [{ text: s }];

  return (
    <span className="ptc-price-text">
      {chunks.map((chunk, i) => (
        <span
          key={i}
          style={chunk.color ? { color: chunk.color } : undefined}
        >
          {chunk.text}
        </span>
      ))}
    </span>
  );
}

function defaultRenderImage({
  src,
  alt,
  width,
  height,
  style,
}: PriceTableImageRenderArgs) {
  return (
    <SmartImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      style={style}
    />
  );
}

type PriceTableCardProps = {
  mode: PriceTableRendererProps['mode'];
  item: PriceTablePreparedItem;
  index: number;
  stageIndex: number;
  hovered: boolean;
  onHoverIndexChange?: PriceTableRendererProps['onHoverIndexChange'];
  onPrevStage?: PriceTableRendererProps['onPrevStage'];
  onNextStage?: PriceTableRendererProps['onNextStage'];
  onImageClick?: PriceTableRendererProps['onImageClick'];
  onNameClick?: PriceTableRendererProps['onNameClick'];
  onPriceClick?: PriceTableRendererProps['onPriceClick'];
  onCardContextMenu?: PriceTableRendererProps['onCardContextMenu'];
  resolveImageSrc: NonNullable<PriceTableRendererProps['resolveImageSrc']>;
  renderImage: NonNullable<PriceTableRendererProps['renderImage']>;
  renderItemControls?: PriceTableRendererProps['renderItemControls'];
};

function PriceTableCard({
  mode,
  item,
  index,
  stageIndex,
  hovered,
  onHoverIndexChange,
  onPrevStage,
  onNextStage,
  onImageClick,
  onNameClick,
  onPriceClick,
  onCardContextMenu,
  resolveImageSrc,
  renderImage,
  renderItemControls,
}: PriceTableCardProps) {
  const safeStageIndex = Math.min(
    Math.max(0, stageIndex || 0),
    Math.max(0, item.stages.length - 1),
  );

  const stage = item.stages[safeStageIndex] ?? '';
  const priceVal = item.prices[safeStageIndex] ?? '';
  const badgeColor = getPriceBadgeColor(stage, item.colorType);

  const name = item.displayName || '이름 없음';
  const nameBreakInfo = smartNameBreakInfo(name);
  const nameFont = priceTableNameFontSize(name, nameBreakInfo);
  const priceFont = priceTablePriceFontSize(priceVal);

  const rawImage = String(item.image ?? '').trim();
  const imgSrc = rawImage ? resolveImageSrc(rawImage, item, index) : '';

  const showArrows = hovered && item.stages.length > 1;
  const canEdit = mode === 'edit';

  return (
    <div
      data-wiki-price-table-card
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 15,
        padding: 8,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        minWidth: 140,
        maxWidth: 140,
        minHeight: 160,
        transition: 'box-shadow .15s',
        zIndex: 0,
        margin: '0 8px',
        boxSizing: 'border-box',
      }}
      onMouseEnter={() => onHoverIndexChange?.(index)}
      onMouseLeave={() => onHoverIndexChange?.(null)}
      onContextMenu={
        onCardContextMenu
          ? (e) => onCardContextMenu(item, index, e)
          : undefined
      }
    >
      {renderItemControls?.(item, index)}

      {item.stages.length > 1 ? (
        <div
          style={{
            position: 'absolute',
            top: 5,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            width: 66,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              background: badgeColor,
              color: stage === '봉인' || stage === '거불' ? '#fff' : '#111827',
              padding: '4px 0px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              width: 66,
              display: 'inline-block',
              boxShadow: '0 1px 8px #0001',
              border: '1.5px solid var(--surface-elevated)',
              textAlign: 'center',
              letterSpacing: 1,
              transition: 'background .1s',
            }}
          >
            {stage}
          </span>
        </div>
      ) : null}

      {showArrows ? (
        <>
          <button
            type="button"
            aria-label="이전 단계"
            style={{
              position: 'absolute',
              left: -12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--surface-elevated)',
              border: '1.2px solid var(--border)',
              color: 'var(--foreground)',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 16,
              boxShadow: 'var(--shadow-sm)',
              zIndex: 2,
            }}
            tabIndex={-1}
            onClick={(e) => {
              stop(e);
              onPrevStage?.(index, item.stages.length);
            }}
            title="이전"
          >
            ◀
          </button>

          <button
            type="button"
            aria-label="다음 단계"
            style={{
              position: 'absolute',
              right: -12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--surface-elevated)',
              border: '1.2px solid var(--border)',
              color: 'var(--foreground)',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 16,
              boxShadow: 'var(--shadow-sm)',
              zIndex: 2,
            }}
            tabIndex={-1}
            onClick={(e) => {
              stop(e);
              onNextStage?.(index, item.stages.length);
            }}
            title="다음"
          >
            ▶
          </button>
        </>
      ) : null}

      <div
        style={{
          marginBottom: 10,
          marginTop: 34,
          cursor: canEdit && onImageClick ? 'pointer' : 'default',
          width: 65,
          height: 65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={canEdit && onImageClick ? '이미지 변경' : undefined}
        onClick={
          onImageClick
            ? (e) => {
                e.stopPropagation();
                onImageClick(item, index, e);
              }
            : undefined
        }
      >
        {imgSrc ? (
          renderImage({
            item,
            index,
            src: imgSrc,
            alt: name,
            width: 65,
            height: 65,
            style: {
              width: 65,
              height: 65,
              objectFit: 'contain',
              borderRadius: 7,
              background: 'transparent',
              display: 'block',
            },
          })
        ) : (
          <span
            style={{
              width: 54,
              height: 54,
              background: 'var(--surface-muted, var(--border))',
              borderRadius: 7,
              display: 'inline-block',
            }}
          />
        )}
      </div>

      <div
        style={{
          fontWeight: 700,
          fontSize: nameFont,
          lineHeight: 1.12,
          marginBottom: 0,
          color: item.name ? 'var(--foreground)' : 'var(--muted)',
          textAlign: 'center',
          minHeight: 40,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: canEdit && onNameClick ? 'pointer' : 'default',
          whiteSpace: 'normal',
        }}
        title={canEdit && onNameClick ? '아이템 선택' : undefined}
        onClick={
          onNameClick
            ? (e) => {
                e.stopPropagation();
                onNameClick(item, index, e);
              }
            : undefined
        }
      >
        {item.name ? (
          <PriceName name={name} />
        ) : (
          <span style={{ color: 'var(--muted)' }}>이름 없음</span>
        )}
      </div>

      <div
        style={{
          fontWeight: 800,
          fontSize: priceFont,
          lineHeight: 1.04,
          color: 'var(--accent, #5b80f5)',
          textAlign: 'center',
          letterSpacing: 1,
          marginTop: 3,
          cursor: canEdit && onPriceClick ? 'pointer' : 'default',
          borderRadius: 8,
          padding: '2px 10px',
          minHeight: 28,
        }}
        title={canEdit && onPriceClick ? '가격 수정' : undefined}
        onClick={
          onPriceClick
            ? (e) => {
                e.stopPropagation();
                onPriceClick(item, index, e);
              }
            : undefined
        }
      >
        <ColoredCompressedText value={priceVal} />
      </div>
    </div>
  );
}

export default function PriceTableRenderer({
  mode,
  items,
  attributes,
  className,
  style,
  stageIndexes,
  hoveredIndex,
  onHoverIndexChange,
  onPrevStage,
  onNextStage,
  onImageClick,
  onNameClick,
  onPriceClick,
  onCardContextMenu,
  resolveImageSrc = defaultResolveImageSrc,
  renderImage = defaultRenderImage,
  renderBlockControls,
  renderItemControls,
  children,
}: PriceTableRendererProps) {
  const preparedItems = React.useMemo(() => preparePriceTableItems(items), [items]);

  return (
    <div
      {...attributes}
      className={[className, attributes?.className].filter(Boolean).join(' ') || undefined}
      style={{
        ...(attributes?.style || {}),
        ...style,
      }}
    >
      <div
        contentEditable={false}
        suppressContentEditableWarning
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 0,
          boxSizing: 'border-box',
          padding: '10px 0',
          margin: '10px 0',
          marginLeft: 10,
          position: 'relative',
        }}
      >
        {renderBlockControls?.()}

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 25,
            flexWrap: 'nowrap',
            width: '100%',
            justifyContent: 'center',
            margin: '0 auto',
            maxWidth: 1040,
          }}
        >
          {preparedItems.map((item, index) => (
            <PriceTableCard
              key={item.viewKey}
              mode={mode}
              item={item}
              index={index}
              stageIndex={stageIndexes?.[index] ?? 0}
              hovered={hoveredIndex === index}
              onHoverIndexChange={onHoverIndexChange}
              onPrevStage={onPrevStage}
              onNextStage={onNextStage}
              onImageClick={onImageClick}
              onNameClick={onNameClick}
              onPriceClick={onPriceClick}
              onCardContextMenu={onCardContextMenu}
              resolveImageSrc={resolveImageSrc}
              renderImage={renderImage}
              renderItemControls={renderItemControls}
            />
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
