// File: app/components/editor/Element.tsx

/**
 * 에디터에서 커스텀 블록 렌더링링
 * - heading, 링크, info-box, divider 등 다양한 블록 타입별 렌더링 담당
 * - heading: 아이콘 클릭 핸들러, id 생성, 정렬 지원
 * - link, link-block: 하이퍼링크, 블록 스타일
 * - info-box: 타입별 색상/이모지, paragraph/divider 등 기본 지원
 */

'use client';

import React from 'react';
import { RenderElementProps, ReactEditor } from 'slate-react';
import { Node, Transforms } from 'slate';
import { getHeadingId } from './helpers/getHeadingId';
import type {
  CustomElement,
  LinkElement,
  LinkBlockElement,
  InfoBoxElement,
  HeadingOneElement,
  HeadingTwoElement,
  HeadingThreeElement,
  ParagraphElement
} from '@/types/slate';

// props 타입
type ElementProps = RenderElementProps & {
  editor: any;
  onIconClick: (element: CustomElement) => void;
};

// 메인 렌더러러
const Element = ({ attributes, children, element, editor, onIconClick }: ElementProps) => {
  switch (element.type) {
    // 인라인 하이퍼링크
    case 'link': {
      const el = element as LinkElement;
      return (
        <a {...attributes} href={el.url} style={{ color: 'blue', textDecoration: 'none' }}>
          {children}
        </a>
      );
    }

    // 링크 블록
    case 'link-block': {
      const el = element as LinkBlockElement;
      const isReadOnly = ReactEditor.isReadOnly(editor);

      return (
        <div
          {...attributes}
          contentEditable={false}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            marginBottom: '8px',
          }}
        >
          {/* 카드 삭제 버튼(읽기전용 모드에서는 숨김) */}
          {!isReadOnly && (
            <button
              contentEditable={false}
              onClick={() => {
                const path = ReactEditor.findPath(editor, element);
                Transforms.removeNodes(editor, { at: path });
              }}
              style={{
                position: 'absolute',
                top: '4px',
                right: '6px',
                border: '1px solid #ccc',
                background: '#f8f8f8',
                color: '#555',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '13px',
                fontWeight: 'bold',
                lineHeight: '20px',
                textAlign: 'center',
                padding: 0,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e0e0e0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f8f8f8')}
            >
              ×
            </button>
          )}

          {/* 파비콘 */}
          {el.favicon && (
            <img
              src={el.favicon}
              alt="favicon"
              style={{ width: 24, height: 24, marginRight: 8 }}
            />
          )}
          {/* URL */}
          <a
            href={el.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0070f3',
              textDecoration: 'none',
              flexGrow: 1,
            }}
          >
            {el.sitename || el.url}
          </a>
        </div>
      );
    }

    // Heading
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = element as HeadingOneElement | HeadingTwoElement | HeadingThreeElement;
      const level = el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;
      const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px';
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');

      return (
        <Tag {...attributes} id={getHeadingId(el)} style={{ fontSize, textAlign: el.textAlign || 'left' }}>
          {/* 아이콘 클릭: 커스텀 or 기본값, 이미지/이모지 지원 */}
          <span
            onClick={() => onIconClick(el)}
            contentEditable={false}
            style={{ cursor: 'pointer', marginRight: '0.3em' }}
          >
            {el.icon?.startsWith('http') ? (
              <img src={el.icon} alt="icon" style={{ width: '1em', verticalAlign: 'middle' }} />
            ) : (
              el.icon || (level === 1 ? '📌' : level === 2 ? '🔖' : '📝')
            )}
          </span>
          {children}
        </Tag>
      );
    }

    // Divider(구분선)
    case 'divider':
      return <hr {...attributes} />;

    // 기본 단락(문단)
    case 'paragraph': {
      const el = element as ParagraphElement;
      return (
        <p {...attributes} style={{ textAlign: el.textAlign || 'left' }}>
          {children}
        </p>
      );
    }

    // 정보 박스(info/warning/danger)
    case 'info-box': {
      const el = element as InfoBoxElement;
      const colors = {
        info: '#e8f4fd',
        warning: '#fff9e6',
        danger: '#fdecea',
      };
      const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        danger: '🚫',
      };

      return (
        <div
          {...attributes}
          style={{
            background: colors[el.boxType],
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span contentEditable={false}>{icons[el.boxType]}</span>
          <div style={{ flex: 1 }}>{children}</div>
        </div>
      );
    }

    // 그 외
    default: {
      const el = element as any;
      const textAlign = 'textAlign' in el ? el.textAlign : 'left';
      return <p {...attributes} style={{ textAlign }}>{children}</p>;
    }
  }
};

export default Element;
