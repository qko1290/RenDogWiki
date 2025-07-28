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

import { insertLink, insertLinkBlock, insertHalfLinkBlock, unwrapLink, isLinkActive } from './helpers/insertLink';
import { insertHeading } from './helpers/insertHeading';
import { insertDivider } from './helpers/insertDivider';
import { toggleMark } from './helpers/toggleMark';
import '@/wiki/css/editor-toolbar.css';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import { insertImage } from './helpers/insertImage';
import { setImageAlignment } from './helpers/setImageAlignment';
import { InlineMarkElement } from '@/types/slate';
import LinkInputModal from './LinkInputModal';
import WikiLinkModal from './WikiLinkModal';
import CustomColorDropdown from "./CustomColorDropdown";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeading, faFillDrip, faPalette, faTextHeight, faLink, faChevronDown, faImage} from '@fortawesome/free-solid-svg-icons';
import HeadingIconSelectModal from './HeadingIconSelectModal';
import { insertInlineImage } from './helpers/insertInlineImage';
import ImageUrlInputModal from './ImageUrlInputModal';
import PriceTableInsertModal from './PriceTableInsertModal';

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

const INLINE_MARKS = [
  { label: '중점', icon: '·', color: '#888' },
  { label: '대시', icon: '-', color: '#888' },
  { label: '화살표', icon: '→', color: '#888' },
  { label: '채운 삼각', icon: '▶', color: '#888' },
  { label: '주의', icon: '⚠️', color: '#e87e21' }
];

// 툴바 메인 컴포넌트
export const Toolbar: React.FC<ToolbarProps> = ({ selectionRef }) => {
  const editor = useSlate();

  // ======= 상태 관리 =======
  // 드롭다운/모달/컬러 등 UI 열림 상태
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); // 드롭다운 하나만 열림
  const [imgModalOpen, setImgModalOpen] = useState(false); // 이미지(블록) 모달
  const [blockImgModalOpen, setBlockImgModalOpen] = useState(false); // 블록 이미지 선택
  const [blockImgLinkModalOpen, setBlockImgLinkModalOpen] = useState(false); // 블록 이미지 링크
  const [inlineImgModalOpen, setInlineImgModalOpen] = useState(false); // 인라인 이미지 선택
  const [inlineImgLinkModalOpen, setInlineImgLinkModalOpen] = useState(false); // 인라인 이미지 링크
  const [showColorDropdown, setShowColorDropdown] = useState(false); // 글자색 드롭다운
  const [colorValue, setColorValue] = useState("#000000"); // 현재 글자색
  const [recentColors, setRecentColors] = useState<string[]>([]); // 최근 글자색
  const colorBtnRef = useRef<HTMLDivElement>(null);
  const [showBgColorDropdown, setShowBgColorDropdown] = useState(false); // 배경색 드롭다운
  const [bgColorValue, setBgColorValue] = useState("#FFFF00");
  const [recentBgColors, setRecentBgColors] = useState<string[]>([]);
  const bgColorBtnRef = useRef<HTMLDivElement>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false); // 외부 링크 모달
  const [wikiLinkOpen, setWikiLinkOpen] = useState(false); // 내부(위키) 링크 모달
  const [headingModalOpen, setHeadingModalOpen] = useState<false | 'heading-one' | 'heading-two' | 'heading-three'>(false);
  const [showPriceTableInsertModal, setShowPriceTableInsertModal] = useState(false); // 시세표 모달
  const wikiLinkBtnRef = useRef<HTMLButtonElement>(null);

  // 인라인/블록 이미지 모드 구분 옵션
  const INLINE_IMAGE_OPTIONS = [
    "업로드/선택",
    "링크 삽입"
  ];

  // ---- 링크(외부/내부) 삽입 처리 ----
  /**
   * 링크 삽입 모달 완료 시
   * - 1개: 한 칸 링크 블록
   * - 2개: 두 칸 link-block-row(소형) 생성
   */
  const handleLinkSubmit = (items: { url: string, size: 'large' | 'small' }[]) => {
    setLinkModalOpen(false);
    if (!items || items.length === 0) return;
    if (items.length === 1) {
      insertLinkBlock(editor, items[0].url, { size: 'large' });
    } else if (items.length === 2) {
      // 1. link-block-row 삽입 (select: false)
      Transforms.insertNodes(editor, {
        type: 'link-block-row',
        children: [
          {
            type: 'link-block',
            url: items[0].url,
            size: 'small',
            sitename: items[0].url,
            favicon: null,
            children: [{ text: '' }]
          },
          {
            type: 'link-block',
            url: items[1].url,
            size: 'small',
            sitename: items[1].url,
            favicon: null,
            children: [{ text: '' }]
          }
        ]
      } as any, { select: false });

      // 2. 항상 마지막에 빈 단락을 추가하고 커서도 이동
      // (최신 Slate는 editor.children을 항상 최신으로 반영)
      const lastPath = [editor.children.length];
      Transforms.insertNodes(
        editor,
        { type: 'paragraph', children: [{ text: '' }] },
        { at: lastPath, select: true }
      );
    }
  };

  /**
   * 블록 정렬(왼/가/오/양쪽)
   * - 현재 selection에 적용 (문단/제목만)
   */
  const setAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    const { selection } = editor;
    if (!selection) {
      console.warn('정렬 실패: 선택된 영역 없음');
      return;
    }
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

  /**
   * 이미지 블록 정렬 (왼/가/오)
   * - 이미지 블록 선택 시만 사용
   */
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

  /** 현재 selection이 이미지 블록인지 판별 */
  const isImageSelected = () => {
    const { selection } = editor;
    if (!selection) return false;
    const [match] = Editor.nodes(editor, {
      at: selection,
      match: n => SlateElement.isElement(n) && n.type === 'image',
    });
    return !!match;
  };

  /**
   * 내부 문서 링크(위키 문서) 삽입 처리
   * - 블록/인라인 자동 분기
   */
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
      insertLink(editor, url, text);
    }
  };

  // ------------------------------
  // 드롭다운/컬러 외부 클릭 시 닫기
  // ------------------------------
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

  /** 인라인 마크 요소 삽입 (·, -, →, ▶, ⚠️ 등 기호) */
  function insertInlineMark(
    editor: Editor,
    { icon, color }: { icon: string; color: string }
  ) {
    const mark: InlineMarkElement = {
      type: 'inline-mark',
      icon,
      color,
      children: [{ text: '' }]
    };
    Transforms.insertNodes(editor, mark);
  }

  /** 인라인 이미지(업로드/선택) 삽입 */
  const handleSelectInlineImage = (url: string) => {
    insertInlineImage(editor, url);
    setInlineImgModalOpen(false);
  };

  /** 인라인 이미지(링크) 삽입 */
  const handleInlineImgLinkInsert = (url: string) => {
    insertInlineImage(editor, url);
    setInlineImgLinkModalOpen(false);
  };

  // -----------------------------------
  // 렌더링: 툴바의 각 버튼/드롭다운
  // -----------------------------------
  return (
    <div id="editor-toolbar" className="editor-toolbar">
      {/* 텍스트 마크(볼드/이탤릭/언더라인/취소선) */}
      <MarkButton format="bold" icon="𝐁" selectionRef={selectionRef} />
      <MarkButton format="italic" icon="𝘐" selectionRef={selectionRef} />
      <MarkButton format="underline" icon="U̲" selectionRef={selectionRef} />
      <MarkButton format="strikethrough" icon="S" selectionRef={selectionRef} />

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
          setWikiLinkOpen(true);
        }}
        title="내부 문서 링크"
      >
        🗂️
      </button>

      {/* 하이퍼링크/링크블럭 삽입 */}
      <button className="editor-toolbar-btn" onMouseDown={e => { e.preventDefault(); setLinkModalOpen(true); }}>
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
            if (match) setImageAlignment(editor, match.value as any);
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

      {/* 이미지 삽입 버튼 추가 (블록/인라인, 업로드/링크) */}
      <DropdownButton
        label="🖼️"
        items={["업로드/선택", "링크로 삽입"]}
        selectionRef={selectionRef}
        dropdownId="block-image"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={option => {
          if (option === "업로드/선택") setBlockImgModalOpen(true);
          else if (option === "링크로 삽입") setBlockImgLinkModalOpen(true);
        }}
      />
      <ImageSelectModal
        open={blockImgModalOpen}
        onClose={() => setBlockImgModalOpen(false)}
        onSelectImage={url => {
          insertImage(editor, url);
          setBlockImgModalOpen(false);
        }}
      />
      <ImageUrlInputModal
        open={blockImgLinkModalOpen}
        onClose={() => setBlockImgLinkModalOpen(false)}
        onSubmit={url => {
          insertImage(editor, url);
          setBlockImgLinkModalOpen(false);
        }}
      />
      
      <DropdownButton
        label={<FontAwesomeIcon icon={faImage} />}
        items={INLINE_IMAGE_OPTIONS}
        selectionRef={selectionRef}
        dropdownId="insert-inline-image"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={option => {
          if (option === "업로드/선택") setInlineImgModalOpen(true);
          else if (option === "링크 삽입") setInlineImgLinkModalOpen(true);
        }}
      />

      <ImageSelectModal
        open={inlineImgModalOpen}
        onClose={() => setInlineImgModalOpen(false)}
        onSelectImage={handleSelectInlineImage}
      />
      <ImageUrlInputModal
        open={inlineImgLinkModalOpen}
        onClose={() => setInlineImgLinkModalOpen(false)}
        onSubmit={handleInlineImgLinkInsert}
      />

      {/* 라인(좌측 세로선) 토글 */}
      <button
        className="editor-toolbar-btn"
        onMouseDown={e => {
          e.preventDefault();
          const { selection } = editor;
          if (!selection) return;
          for (const [node, path] of Editor.nodes(editor, {
            at: selection,
            match: n =>
              SlateElement.isElement(n) &&
              Editor.isBlock(editor, n),
          })) {
            const prev = (node as any).indentLine;
            Transforms.setNodes(editor, { indentLine: !prev }, { at: path });
          }
        }}
        title="왼쪽 라인 들여쓰기 토글"
      >
        <span
          style={{
            display: "inline-block",
            borderLeft: "4px solid #aaa",
            height: 16,
            marginRight: 7,
            verticalAlign: "middle"
          }}
        />
        <span style={{ fontSize: 15, color: "#888" }}>라인</span>
      </button>
      
      {/* 인라인 기호 마크 삽입 */}
      <DropdownButton
        label="기호"
        items={INLINE_MARKS.map(m => m.icon)}
        selectionRef={selectionRef}
        dropdownId="inline-mark"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={icon => {
          const mark = INLINE_MARKS.find(m => m.icon === icon);
          if (mark) insertInlineMark(editor, mark);
        }}
      />

      <ImageSelectModal
        open={imgModalOpen}
        onClose={() => setImgModalOpen(false)}
        onSelectImage={(url) => {
          insertImage(editor, url);
          setImgModalOpen(false);
        }}
      />

      {/* 내부 위키 문서 링크 모달 */}
      <WikiLinkModal
        key={wikiLinkOpen ? "open" : "closed"}
        open={wikiLinkOpen}
        onClose={() => setWikiLinkOpen(false)}
        onSelect={handleWikiLinkInsert}
      />

      {/* heading 아이콘(이모지/이미지) 입력 모달 */}
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

      {/* 시세표 카드 블록 삽입 */}
      <button
        className="editor-toolbar-btn"
        title="시세표 카드 삽입"
        onMouseDown={e => {
          e.preventDefault();
          setShowPriceTableInsertModal(true);
        }}
      >💸</button>
      <PriceTableInsertModal
        open={showPriceTableInsertModal}
        onClose={() => setShowPriceTableInsertModal(false)}
        onInsert={(cardsPerRow) => {
          // 빈 카드들로 시세표 삽입
          const element = {
            type: 'price-table-card',
            items: Array(cardsPerRow).fill(null).map(() => ({
              name: "",
              image: "",
              prices: [],
              stages: [],
            })),
            cardsPerRow,
            children: [{ text: "" }]
          };
          Transforms.insertNodes(editor, element as any);
          Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] });
          setShowPriceTableInsertModal(false);
        }}
      />

    </div>
  );
};
