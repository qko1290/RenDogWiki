'use client';

import React from 'react';
import {
  RenderElementProps,
  useSlate,
} from 'slate-react';

import { toProxyUrl } from '@lib/cdn';

import type {
  InlineMarkElement,
  InlineImageElement,
  FootnoteElement,
  PriceTableCardElement,
  CustomElement,
  LinkBlockElement,
  HeadingOneElement,
  HeadingTwoElement,
  HeadingThreeElement,
  ParagraphElement,
  TableElement,
  VideoElement,
  WeaponCardElement,
} from '@/types/slate';

import type { PriceTableEditState } from './render/types';
import type { ElementRenderProps, WikiRefKind } from './render/types';

import PriceTableCard from './render/PriceTableCard';
import {
  TableElementRenderer,
  TableRowRenderer,
  TableCellRenderer,
} from './render/Table';
import WeaponCard from './render/WeaponCard';

import InlineLinkRenderer from '@/components/wiki-render/link/InlineLinkRenderer';
import LinkBlockEditorAdapter from './render/link/LinkBlockEditorAdapter';
import { ImageBlock, VideoBlock } from './render/media/MediaEditorBlocks';

import ParagraphEditorAdapter from './render/blocks/ParagraphEditorAdapter';
import HeadingEditorAdapter from './render/blocks/HeadingEditorAdapter';
import LinkBlockRowEditorAdapter from './render/link/LinkBlockRowEditorAdapter';

import {
  DividerEditorAdapter,
  InfoBoxEditorAdapter,
} from './render/blocks/BasicBlockEditorAdapters';

import FootnoteEditorAdapter from './render/inline/FootnoteEditorAdapter';

import {
  InlineImageEditorAdapter,
  InlineMarkEditorAdapter,
  WikiRefEditorAdapter,
} from './render/inline/InlineEditorAdapters';

export type ElementProps = RenderElementProps & {
  editor: any;
  onIconClick: (element: CustomElement) => void;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
};

const Element: React.FC<ElementRenderProps> = ({
  attributes,
  children,
  element,
  editor,
  onIconClick,
  priceTableEdit,
  setPriceTableEdit,
  openFootnoteEditor,
  readOnly,
  onWikiRefClick,
  onOpenWikiRef,
}) => {
  const slateEditor = useSlate();

  switch (element.type) {
    case 'link': {
      return (
        <InlineLinkRenderer
          mode="edit"
          href={(element as any).url}
          attributes={attributes as React.AnchorHTMLAttributes<HTMLAnchorElement>}
        >
          {children}
        </InlineLinkRenderer>
      );
    }

    case 'link-block': {
      return (
        <LinkBlockEditorAdapter
          attributes={attributes}
          element={element as LinkBlockElement}
          editor={editor}
        >
          {children}
        </LinkBlockEditorAdapter>
      );
    }

    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      return (
        <HeadingEditorAdapter
          attributes={attributes}
          element={
            element as
              | HeadingOneElement
              | HeadingTwoElement
              | HeadingThreeElement
          }
          onIconClick={onIconClick}
        >
          {children}
        </HeadingEditorAdapter>
      );
    }

    case 'paragraph': {
      return (
        <ParagraphEditorAdapter
          attributes={attributes}
          element={element as ParagraphElement}
          editor={slateEditor}
        >
          {children}
        </ParagraphEditorAdapter>
      );
    }

    case 'divider': {
      return (
        <DividerEditorAdapter
          attributes={attributes}
          element={element}
        >
          {children}
        </DividerEditorAdapter>
      );
    }

    case 'info-box': {
      return (
        <InfoBoxEditorAdapter
          attributes={attributes}
          element={element}
        >
          {children}
        </InfoBoxEditorAdapter>
      );
    }

    case 'image': {
      return (
        <ImageBlock
          attributes={attributes}
          element={element as any}
          editor={editor}
        >
          {children}
        </ImageBlock>
      );
    }

    case 'inline-image': {
      return (
        <InlineImageEditorAdapter
          attributes={attributes}
          element={element as InlineImageElement}
        >
          {children}
        </InlineImageEditorAdapter>
      );
    }

    case 'inline-mark': {
      return (
        <InlineMarkEditorAdapter
          attributes={attributes}
          element={element as InlineMarkElement}
        >
          {children}
        </InlineMarkEditorAdapter>
      );
    }

    case 'footnote': {
      return (
        <FootnoteEditorAdapter
          attributes={attributes}
          element={element as FootnoteElement}
          editor={editor}
          openFootnoteEditor={openFootnoteEditor}
        >
          {children}
        </FootnoteEditorAdapter>
      );
    }

    case 'price-table-card': {
      return (
        <PriceTableCard
          attributes={attributes}
          element={element as PriceTableCardElement}
          editor={editor}
          priceTableEdit={priceTableEdit}
          setPriceTableEdit={setPriceTableEdit}
        >
          {children}
        </PriceTableCard>
      );
    }

    case 'link-block-row': {
      return (
        <LinkBlockRowEditorAdapter attributes={attributes}>
          {children}
        </LinkBlockRowEditorAdapter>
      );
    }

    case 'table': {
      return (
        <TableElementRenderer
          attributes={attributes}
          element={element as TableElement}
          editor={editor}
        >
          {children}
        </TableElementRenderer>
      );
    }

    case 'table-row': {
      return (
        <TableRowRenderer attributes={attributes} element={element as any}>
          {children}
        </TableRowRenderer>
      );
    }

    case 'table-cell': {
      return (
        <TableCellRenderer
          attributes={attributes}
          element={element as any}
          editor={editor}
        >
          {children}
        </TableCellRenderer>
      );
    }

    case 'video': {
      return (
        <VideoBlock
          attributes={attributes}
          element={element as VideoElement}
          editor={editor}
        >
          {children}
        </VideoBlock>
      );
    }

    case 'quest-embed':
    case 'npc-embed':
    case 'qna-embed': {
      const type = element.type;

      const id =
        type === 'quest-embed'
          ? (element as any).questId
          : type === 'npc-embed'
            ? (element as any).npcId
            : (element as any).qnaId;

      const label =
        type === 'quest-embed'
          ? '퀘스트'
          : type === 'npc-embed'
            ? 'NPC'
            : 'QNA';

      return (
        <div
          {...attributes}
          contentEditable={false}
          style={{
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 12,
            margin: '12px 0',
            background: '#f8fafc',
          }}
        >
          <strong>{label} 삽입</strong>
          <div>ID: {String(id ?? '-')}</div>
          <div>나중에 id로 데이터 로드</div>
          {children}
        </div>
      );
    }

    case 'weapon-card': {
      return (
        <WeaponCard
          attributes={attributes}
          element={element as WeaponCardElement}
          editor={editor}
        >
          {children}
        </WeaponCard>
      );
    }

    case 'wiki-ref': {
      return (
        <WikiRefEditorAdapter
          attributes={attributes}
          element={element}
          readOnly={readOnly}
          onWikiRefClick={onWikiRefClick}
          onOpenWikiRef={onOpenWikiRef}
        >
          {children}
        </WikiRefEditorAdapter>
      );
    }

    default: {
      const el = element as any;
      const textAlign = 'textAlign' in el ? el.textAlign : 'left';

      if (
        Array.isArray(children) &&
        children.length === 1 &&
        typeof children[0] === 'string'
      ) {
        return <span {...attributes}>{children}</span>;
      }

      return React.createElement(
        'p',
        {
          ...attributes,
          style: { textAlign },
        },
        children,
      );
    }
  }
};

export default Element;