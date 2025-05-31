// File: app/components/editor/Toolbar.tsx

/**
 * Slate 에디터의 툴바(마크, 색상, 정렬, heading, info-box) 컴포넌트
 * - Bold/Italic/Underline 등 마크 토글 버튼
 * - 색상/폰트/배경 드롭다운, 링크/구분선/heading/정렬/InfoBox 삽입
 * - 드롭다운 열림 상태 관리 및 클릭 외부 감지
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSlate } from 'slate-react';
import { Editor, Range, Transforms, Element as SlateElement } from 'slate';

import MarkButton from './MarkButton';
import DropdownButton from './DropdownButton';
import InfoBoxDropdown from './InfoBoxDropdown';

import { insertLink, insertLinkBlock, unwrapLink, isLinkActive } from './helpers/insertLink';
import { insertHeading } from './helpers/insertHeading';
import { insertDivider } from './helpers/insertDivider';
import { toggleMark } from './helpers/toggleMark';

// Props 타입
type ToolbarProps = {
  selectionRef: React.RefObject<Range | null>;
};

// 상수 선언 (색상, 폰트, heading 등)
const COLORS = ['black', 'red', 'blue', 'green', 'orange'];
const FONT_SIZES = ['11px', '15px', '19px', '24px', '30px'];
const BACKGROUND_COLORS = ['yellow', 'lightgreen', 'lightblue', 'lightpink', 'lightgray'];
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

// 툴바 컴포넌트
export const Toolbar: React.FC<ToolbarProps> = ({ selectionRef }) => {
  const editor = useSlate();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // 링크 삽입 핸들러
  const handleInsertLink = () => {
    const url = prompt('링크할 URL을 입력하세요');
    if (!url) return;

    if (isLinkActive(editor)) unwrapLink(editor);

    const isCollapsed = Range.isCollapsed(editor.selection!);
    if (isCollapsed) insertLinkBlock(editor, url);
    else insertLink(editor, url);
  };

  // 정렬 핸들러
  const setAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    const { selection } = editor;

    if (!selection) {
      console.warn('정렬 실패: 선택된 영역 없음');
      return;
    }

    // 선택 범위 내 블록에 정렬 적용
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
      console.log(`정렬 적용됨: ${alignment}`, node);
    }

    if (!hasMatched) {
      console.warn('정렬할 블록을 찾을 수 없음');
    }
  };

  // 드롭다운 외부 클릭 시 닫기
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

  // 렌더 (툴바 버튼/드롭다운/핸들러)
  return (
    <div id="editor-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
      {/* 마크(볼드/이탤릭 등) */}
      <MarkButton format="bold" icon="B" selectionRef={selectionRef} />
      <MarkButton format="italic" icon="I" selectionRef={selectionRef} />
      <MarkButton format="underline" icon="U" selectionRef={selectionRef} />
      <MarkButton format="strikethrough" icon="S" selectionRef={selectionRef} />

      {/* 색상/폰트/배경 드롭다운 */}
      <DropdownButton
        label="색상"
        items={COLORS}
        selectionRef={selectionRef}
        dropdownId="color"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={value => toggleMark(editor, 'color', value)}
      />
      <DropdownButton
        label="폰트"
        items={FONT_SIZES}
        selectionRef={selectionRef}
        dropdownId="font"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={value => toggleMark(editor, 'fontSize', value)}
      />
      <DropdownButton
        label="배경색"
        items={BACKGROUND_COLORS}
        selectionRef={selectionRef}
        dropdownId="bg"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={value => toggleMark(editor, 'backgroundColor', value)}
      />

      {/* 링크 삽입 */}
      <button onMouseDown={e => { e.preventDefault(); handleInsertLink(); }}>🔗 링크 삽입</button>

      {/* 제목(heading) 드롭다운 */}
      <DropdownButton
        label="제목 추가"
        items={HEADINGS.map(h => h.label)}
        selectionRef={selectionRef}
        dropdownId="heading"
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onSelect={label => {
          const match = HEADINGS.find(h => h.label === label);
          if (match) insertHeading(editor, match.value as any);
        }}
      />

      {/* 정렬 드롭다운 */}
      <DropdownButton
        label="정렬"
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

      {/* 구분선/InfoBox 삽입 */}
      <button onMouseDown={e => { e.preventDefault(); insertDivider(editor); }}>─ 구분선 삽입</button>
      <InfoBoxDropdown selectionRef={selectionRef} dropdownId="info" openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
    </div>
  );
};
