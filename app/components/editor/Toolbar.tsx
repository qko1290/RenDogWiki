// =============================================
// File: app/components/editor/Toolbar.tsx
// =============================================
/**
 * 에디터의 툴바(마크, 색상, 정렬, heading, info-box) 컴포넌트
 * - Bold/Italic/Underline 등 텍스트 마크 토글
 * - 색상/폰트/배경 드롭다운, 링크/구분선/heading/정렬/InfoBox 삽입
 * - 드롭다운 열림 상태/클릭 외부 감지
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSlate } from 'slate-react';
import { Editor, Range, Transforms, Element as SlateElement } from 'slate';

import MarkButton from './MarkButton';
import DropdownButton from './DropdownButton';
import InfoBoxDropdown from './InfoBoxDropdown';

import { insertLink, insertLinkBlock, unwrapLink, isLinkActive } from './helpers/insertLink';
import { insertHeading } from './helpers/insertHeading';
import { insertDivider } from './helpers/insertDivider';
import { toggleMark } from './helpers/toggleMark';
import '@/wiki/css/editor-toolbar.css';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import { insertImage } from './helpers/insertImage';
import { setImageAlignment } from './helpers/setImageAlignment';
import LinkInputModal from './LinkInputModal';
import WikiLinkModal from './WikiLinkModal';
import CustomColorDropdown from "./CustomColorDropdown";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeading, faFillDrip, faPalette, faTextHeight, faLink } from '@fortawesome/free-solid-svg-icons';
import HeadingIconSelectModal from './HeadingIconSelectModal';


// Props 타입
type ToolbarProps = {
  selectionRef: React.RefObject<Range | null>; // 드롭다운/마크 적용용 selection ref
};

// 툴바 상수 정의 (색상/폰트/배경/헤딩/정렬 등)
const FONT_SIZES = ['11px', '13px', '15px', '16px', '19px', '24px', '28px', '30px', '34px', '38px'];
const HEADINGS = [
  { label: '제목 1 추가', value: 'heading-one' },
  { label: '제목 2 추가', value: 'heading-two' },
  { label: '제목 3 추가', value: 'heading-three' },
];
const ALIGNMENTS = [
  { label: '왼쪽 정렬', value: 'left' },
  { label: '가운데 정렬', value: 'center' },
  { label: '오른쪽 정렬', value: 'right' },
  { label: '양쪽 정렬', value: 'justify' },
];

const IMAGE_ALIGNMENTS = [
  { label: '왼쪽', value: 'left' },
  { label: '가운데', value: 'center' },
  { label: '오른쪽', value: 'right' },
];

const DIVIDER_STYLES = [
  { label: "기본", value: "default" },
  { label: "굵은선", value: "bold" },
  { label: "짧은굵은선", value: "shortbold" },
  { label: "점선", value: "dotted" },
  { label: "다이아", value: "diamond" },
  { label: "다이아 점선", value: "diamonddot" },
  { label: "점 7개", value: "dotdot" },
  { label: "슬래시", value: "slash" },
  { label: "바", value: "bar" },
];

// 툴바 메인 컴포넌트
export const Toolbar: React.FC<ToolbarProps> = ({ selectionRef }) => {
  const editor = useSlate();
  // 열려있는 드롭다운 id(state) - 한 번에 하나만 열림
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [imgModalOpen, setImgModalOpen] = useState(false);

  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [colorValue, setColorValue] = useState("#000000");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const colorBtnRef = useRef<HTMLDivElement>(null);

  const [showBgColorDropdown, setShowBgColorDropdown] = useState(false);
  const [bgColorValue, setBgColorValue] = useState("#FFFF00");
  const [recentBgColors, setRecentBgColors] = useState<string[]>([]);
  const bgColorBtnRef = useRef<HTMLDivElement>(null);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [wikiLinkOpen, setWikiLinkOpen] = useState(false);

  const [headingModalOpen, setHeadingModalOpen] = useState<false | 'heading-one' | 'heading-two' | 'heading-three'>(false);

  const wikiLinkBtnRef = useRef<HTMLButtonElement>(null);

  // 링크 삽입
  const handleInsertLink = () => {
    setLinkModalOpen(true);
  };
  const handleLinkSubmit = (url: string) => {
    setLinkModalOpen(false);
    if (!url) return;
    if (isLinkActive(editor)) unwrapLink(editor);
    const isCollapsed = Range.isCollapsed(editor.selection!);
    if (isCollapsed) insertLinkBlock(editor, url);
    else insertLink(editor, url);
  };

  // 블록 정렬(왼/가/오/양쪽)
  const setAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    const { selection } = editor;
    if (!selection) {
      console.warn('정렬 실패: 선택된 영역 없음');
      return;
    }
    // 선택 범위 내 지원 블록만 정렬 적용
    const blocks = Editor.nodes(editor, {
      at: selection,
      match: n =>
        SlateElement.isElement(n) &&
        Editor.isBlock(editor, n) &&
        ['paragraph', 'heading-one', 'heading-two', 'heading-three'].includes(n.type),
    });

    let hasMatched = false;
    for (const [node, path] of blocks) {
      hasMatched = true;
      Transforms.setNodes(
        editor,
        { textAlign: alignment },
        { at: path }
      );
    }
    if (!hasMatched) {
      console.warn('정렬할 블록을 찾을 수 없음');
    }
  };

  const handleInsertImage = () => {
    alert('이미지 삽입 준비 중!');
    // TODO: 실제로는 모달/선택기 열기 & Slate에 이미지 노드 삽입으로 확장
  };

  // 이미지 정렬 적용 함수
  const setImageAlignment = (editor: Editor, alignment: 'left' | 'center' | 'right') => {
    const { selection } = editor;
    if (!selection) return;
    for (const [node, path] of Editor.nodes(editor, {
      at: selection,
      match: n => SlateElement.isElement(n) && n.type === 'image',
    })) {
      Transforms.setNodes(editor, { textAlign: alignment } as any, { at: path });
    }
  };

  const isImageSelected = () => {
    const { selection } = editor;
    if (!selection) return false;
    const [match] = Editor.nodes(editor, {
      at: selection,
      match: n => SlateElement.isElement(n) && n.type === 'image',
    });
    return !!match;
  };

  const handleWikiLinkInsert = (doc: any) => {
    setWikiLinkOpen(false);
    // 이미 링크 내부면 unwrap
    if (isLinkActive(editor)) unwrapLink(editor);

    // ① 인라인/블록 분기: Range.isCollapsed(editor.selection)
    const url = `/wiki?path=${encodeURIComponent(doc.path)}&title=${encodeURIComponent(doc.title)}`;
    const text = doc.title;

    if (editor.selection && Range.isCollapsed(editor.selection)) {
      // 블록(카드) 형태로 삽입 (link-block)
      insertLinkBlock(editor, url, {
        sitename: text,
        favicon: undefined, // 내부문서면 파비콘 생략
        isWiki: true,
        wikiTitle: text,
        wikiPath: doc.path,
      });
    } else {
      // 인라인 하이퍼링크
      console.log('insertLink 호출됨');
      insertLink(editor, url, text);
    }
  };

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const toolbar = document.getElementById('editor-toolbar');
      if (toolbar && !toolbar.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!showColorDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)) {
        setShowColorDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showColorDropdown]);

  useEffect(() => {
    if (!showBgColorDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (bgColorBtnRef.current && !bgColorBtnRef.current.contains(e.target as Node)) {
        setShowBgColorDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showBgColorDropdown]);

  // 렌더링 -> 툴바 버튼/드롭다운/삽입/정렬
  return (
    <div id="editor-toolbar" className="editor-toolbar">
      {/* 텍스트 마크(볼드/이탤릭/언더라인/취소선) */}
      <MarkButton format="bold" icon="𝐁" selectionRef={selectionRef} />
      <MarkButton format="italic" icon="𝘐" selectionRef={selectionRef} />
      <MarkButton format="underline" icon="U̲" selectionRef={selectionRef} />
      <MarkButton format="strikethrough" icon="S"selectionRef={selectionRef} />

      {/* 색상/폰트/배경 드롭다운 (이모지와 짧은 텍스트) */}
      <div ref={colorBtnRef} style={{ position: "relative", display: "inline-block" }}>
        <button
          className="editor-toolbar-btn"
          onClick={e => {
            e.preventDefault();
            setShowColorDropdown(v => !v);
          }}
          title="글자색"
        ><FontAwesomeIcon icon={faPalette} /></button>
        {showColorDropdown && (
          <CustomColorDropdown
            value={colorValue}
            onChange={color => {
              setColorValue(color);
              toggleMark(editor, "color", color);
            }}
            onClose={() => setShowColorDropdown(false)}
            recentColors={recentColors}
            setRecentColors={setRecentColors}
          />
        )}
      </div>
      <DropdownButton
        label={<FontAwesomeIcon icon={faTextHeight} />}
        items={FONT_SIZES}
        selectionRef={selectionRef}
        dropdownId="font"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={value => toggleMark(editor, 'fontSize', value)}
      />

      <div ref={bgColorBtnRef} style={{ position: "relative", display: "inline-block" }}>
        <button
          className="editor-toolbar-btn"
          onClick={e => {
            e.preventDefault();
            setShowBgColorDropdown(v => !v);
          }}
          title="글자 배경색"
        ><FontAwesomeIcon icon={faFillDrip} /></button>
        {showBgColorDropdown && (
          <CustomColorDropdown
            value={bgColorValue}
            onChange={color => {
              setBgColorValue(color);
              toggleMark(editor, "backgroundColor", color);
            }}
            onClose={() => setShowBgColorDropdown(false)}
            recentColors={recentBgColors}
            setRecentColors={setRecentBgColors}
          />
        )}
      </div>
      
      <button
        className="editor-toolbar-btn"
        ref={wikiLinkBtnRef}
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          console.log("문서 링크 모달 열기! (setWikiLinkOpen(true))");
          setWikiLinkOpen(true);
        }}
        title="내부 문서 링크"
      >
        🗂️
      </button>

      {/* 하이퍼링크/링크블럭 삽입 */}
      <button className="editor-toolbar-btn" onMouseDown={e => { e.preventDefault(); handleInsertLink(); }}>
        <FontAwesomeIcon icon={faLink} />
      </button>
      <LinkInputModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSubmit={handleLinkSubmit}
      />

      {/* 제목(heading) 드롭다운 */}
      <DropdownButton
        label={<FontAwesomeIcon icon={faHeading} />}
        items={HEADINGS.map(h => h.label)}
        selectionRef={selectionRef}
        dropdownId="heading"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={label => {
          const match = HEADINGS.find(h => h.label === label);
          if (match) setHeadingModalOpen(match.value as any); // 모달 open
        }}
      />

      {/* 정렬 드롭다운 (문단/제목 등) */}
      <DropdownButton
        label="☰"
        items={ALIGNMENTS.map(a => a.label)}
        selectionRef={selectionRef}
        dropdownId="align"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={label => {
          const match = ALIGNMENTS.find(a => a.label === label);
          if (match) setAlignment(match.value as any);
        }}
      />

      {/* ---- 이미지 정렬 드롭다운 (이미지 선택시만) ---- */}
      {isImageSelected() && (
        <DropdownButton
          label="🖼️정렬"
          items={IMAGE_ALIGNMENTS.map(a => a.label)}
          selectionRef={selectionRef}
          dropdownId="image-align"
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onSelect={(label: string) => {
            const match = IMAGE_ALIGNMENTS.find(a => a.label === label);
            if (match) setImageAlignment(editor, match.value as any); // helpers의 함수
          }}
        />
      )}

      {/* 구분선 삽입 */}
      <DropdownButton
        label="━"
        items={DIVIDER_STYLES.map(s => s.label)}
        selectionRef={selectionRef}
        dropdownId="divider"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={label => {
          const found = DIVIDER_STYLES.find(s => s.label === label);
          if (found) insertDivider(editor, found.value as any);
        }}
      />

      {/* InfoBox(정보/주의/경고) 삽입 드롭다운 */}
      <InfoBoxDropdown
        selectionRef={selectionRef}
        dropdownId="info"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />

      {/* 이미지 삽입 버튼 추가 */}
      <button
        className="editor-toolbar-btn"
        onMouseDown={e => { e.preventDefault(); setImgModalOpen(true); }}
        title="이미지 삽입"
      >
        🖼️
      </button>

      <ImageSelectModal
        open={imgModalOpen}
        onClose={() => setImgModalOpen(false)}
        onSelectImage={(url) => {
          insertImage(editor, url);
          setImgModalOpen(false);
        }}
      />

      <WikiLinkModal
        key={wikiLinkOpen ? "open" : "closed"}
        open={wikiLinkOpen}
        onClose={() => {
          console.log("모달 닫힘! (setWikiLinkOpen(false))");
          setWikiLinkOpen(false);
        }}
        onSelect={handleWikiLinkInsert}
      />

      <HeadingIconSelectModal
        open={!!headingModalOpen}
        onClose={() => setHeadingModalOpen(false)}
        onSubmit={icon => {
          if (headingModalOpen) {
            insertHeading(editor, headingModalOpen, icon);
            setHeadingModalOpen(false);
          }
        }}
      />
    </div>
  );
};
