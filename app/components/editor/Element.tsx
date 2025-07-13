// =============================================
// File: app/components/editor/Element.tsx
// =============================================
/**
 * 에디터에서 커스텀 블록(요소) 렌더링 담당 컴포넌트
 * - heading, 링크, info-box, divider, paragraph 등 다양한 블록 타입별 렌더링
 * - heading: 아이콘 클릭, id 생성, 정렬 스타일 지원
 * - link/link-block: 인라인/카드형 하이퍼링크
 * - info-box: 타입별 배경색/이모지, 안내/경고/주의 등 스타일링
 * - divider: <hr> 구분선
 * - paragraph: 기본 단락
 */

'use client';

import React, { useState } from 'react';
import { RenderElementProps, ReactEditor, useSelected, useFocused } from 'slate-react';
import { Node, Transforms } from 'slate';
import { getHeadingId } from './helpers/getHeadingId';
import ImageSizeModal from './ImageSizeModal';
import type {
  CustomElement,
  LinkElement,
  LinkBlockElement,
  InfoBoxElement,
  HeadingOneElement,
  HeadingTwoElement,
  HeadingThreeElement,
  ImageElement,
  ParagraphElement
} from '@/types/slate';

// props 타입 선언
type ElementProps = RenderElementProps & {
  editor: any; // 에디터 인스턴스
  onIconClick: (element: CustomElement) => void; // heading 아이콘 클릭 핸들러
};

// 메인 렌더러(타입별 블록 분기)
const Element = ({ attributes, children, element, editor, onIconClick }: ElementProps) => {
  switch (element.type) {
    // 인라인 하이퍼링크
    case 'link': {
      return (
        <a {...attributes} href={element.url} style={{ color: '#2676ff' }}>
          {children}
        </a>
      );
    }

    // 링크 블록(카드형)
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
          {/* 카드 삭제 버튼 */}
          {!isReadOnly && (
            <button
              contentEditable={false}
              onClick={() => {
                // 블록 전체 삭제
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

          {/* 파비콘/사이트 아이콘 */}
          {el.favicon && (
            <img
              src={el.favicon}
              alt="favicon"
              style={{ width: 24, height: 24, marginRight: 8 }}
            />
          )}
          {/* 사이트명 또는 URL */}
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

    // Heading (h1/h2/h3)
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = element as HeadingOneElement | HeadingTwoElement | HeadingThreeElement;
      const level = el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;
      const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px';
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');

      return (
        <Tag {...attributes} id={getHeadingId(el)} style={{ fontSize, textAlign: el.textAlign || 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            onClick={() => onIconClick(el)}
            contentEditable={false}
            style={{ cursor: 'pointer', marginRight: 8, display: 'inline-flex', alignItems: 'center' }}
          >
            {el.icon?.startsWith('http') ? (
              <img src={el.icon} alt="icon" style={{ width: '1.7em', height: '1.7em', verticalAlign: 'middle', marginRight: 6, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '1.5em', marginRight: 6 }}>{el.icon || (level === 1 ? '📌' : level === 2 ? '🔖' : '📝')}</span>
            )}
          </span>
          <span style={{ display: 'inline' }}>{children}</span>
        </Tag>
      );
    }

    // Divider(구분선)
    case 'divider': {
      const style = element.style || "default";
      const borderColor = "#e0e0e0"; // 옅은 회색 고정
      switch (style) {
        case "bold":
          return (
            <div {...attributes} style={{ width: '70%', margin: "32px auto", textAlign: 'center' }}>
              <hr style={{
                border: 0,
                borderTop: `4px solid ${borderColor}`,
                width: "100%",
                margin: "0 auto"
              }} />
            </div>
          );
        case "shortbold":
          return (
            <div {...attributes} style={{ width: 82, margin: "34px auto", textAlign: 'center' }}>
              <hr style={{
                border: 0,
                borderTop: `5px solid ${borderColor}`,
                width: "100%",
                margin: "0 auto"
              }} />
            </div>
          );
        case "dotted":
          return (
            <div {...attributes} style={{ width: '70%', margin: "28px auto", textAlign: 'center' }}>
              <hr style={{
                border: 0,
                borderTop: `2px dotted ${borderColor}`,
                width: "100%",
                margin: "0 auto"
              }} />
            </div>
          );
        case "diamond":
          return (
            <div {...attributes} style={{ textAlign: 'center', margin: "14px 0" }}>
              <span style={{ fontSize: 24, letterSpacing: 12, color: borderColor }}>◇───◇</span>
            </div>
          );
        case "diamonddot":
          return (
            <div {...attributes} style={{ textAlign: 'center', margin: "14px 0" }}>
              <span style={{ fontSize: 22, letterSpacing: 6, color: borderColor }}>◇ ⋅ ⋅ ⋅ ◇</span>
            </div>
          );
        case "dotdot":
          return (
            <div {...attributes} style={{ width: '100%', margin: "30px 0", textAlign: 'center' }}>
              <span style={{
                fontSize: 28,
                letterSpacing: 8,
                color: borderColor
              }}>• • • • • • •</span>
            </div>
          );
        case "slash":
          return (
            <div {...attributes} style={{ width: '100%', margin: "30px 0", textAlign: 'center' }}>
              <span style={{
                fontSize: 30,
                letterSpacing: 14,
                color: borderColor
              }}>/  /  /</span>
            </div>
          );
        case "bar":
          return (
            <div {...attributes} style={{ width: '100%', margin: "28px 0", textAlign: 'center' }}>
              <span style={{
                fontSize: 22,
                color: borderColor
              }}>|</span>
            </div>
          );
        default: // plain(기본)
          return (
            <div {...attributes} style={{ width: '70%', margin: "24px auto", textAlign: 'center' }}>
              <hr style={{
                border: 0,
                borderTop: `1.5px solid ${borderColor}`,
                width: "100%",
                margin: "0 auto"
              }} />
            </div>
          );
      }
    }

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

    case 'image': {
      const el = element as any;
      const selected = useSelected();
      const focused = useFocused();
      const [modalOpen, setModalOpen] = useState(false);

      const EditIcon = ({ size = 18, color = "#2a90ff" }) => (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <path d="M3 17h3.8a1 1 0 0 0 .7-.3l8.4-8.4a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.8 0L3.3 12.2a1 1 0 0 0-.3.7V17z" stroke={color} strokeWidth="1.7"/>
          <path d="M11.7 6.3l2.5 2.5" stroke={color} strokeWidth="1.7"/>
        </svg>
      );

      // 정렬(왼/가운데/오른쪽)
      let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'center';
      if (el.textAlign === 'left') justifyContent = 'flex-start';
      else if (el.textAlign === 'right') justifyContent = 'flex-end';

      const handleClick = (e: React.MouseEvent) => {
        if (!(selected && focused)) {
          e.preventDefault();
          const path = ReactEditor.findPath(editor, element);
          Transforms.select(editor, path);
          ReactEditor.focus(editor);
        }
      };

      const handleEditBadgeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setModalOpen(true);
      };

      const handleSaveSize = (width: number, height: number) => {
        const path = ReactEditor.findPath(editor, element);
        Transforms.setNodes(editor, { width, height }, { at: path });
        setModalOpen(false);
      };

      // === 핵심 변경: flex + 내부 relative로 버튼/이미지 위치 동기화 ===
      return (
        <div
          {...attributes}
          contentEditable={false}
          style={{
            margin: "16px 0",
            display: "flex",
            flexDirection: "row",
            justifyContent,
            alignItems: "flex-start",
            minHeight: 40,
          }}
          onClick={handleClick}
        >
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={el.url}
              alt=""
              style={{
                maxWidth: el.width ? el.width + "px" : "90%",
                height: el.height ? el.height + "px" : "auto",
                borderRadius: 10,
                boxShadow: "0 2px 12px 0 #0001",
                background: "#fff",
                display: "block",
                border: (selected && focused) ? "2px solid #2a90ff" : "none",
                transition: "border 0.1s",
              }}
            />
            {(selected && focused) && (
              <button
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "#fff",
                  border: "1.5px solid #2a90ff",
                  borderRadius: "50%",
                  boxShadow: "0 1px 5px #0001",
                  width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 1,
                  padding: 0,
                }}
                tabIndex={-1}
                onClick={handleEditBadgeClick}
                title="이미지 크기 편집"
              >
                <EditIcon size={18} color="#2a90ff" />
              </button>
            )}
          </div>
          {children}
          <ImageSizeModal
            open={modalOpen}
            width={el.width}
            height={el.height}
            onSave={handleSaveSize}
            onClose={() => setModalOpen(false)}
          />
        </div>
      );
    }

    // 그 외(확장/알수없음): 기본 문단 처리
    default: {
      const el = element as any;
      const textAlign = 'textAlign' in el ? el.textAlign : 'left';
      return <p {...attributes} style={{ textAlign }}>{children}</p>;
    }
  }
};

export default Element;
