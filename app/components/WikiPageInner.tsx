// =============================================
// File: app/components/WikiPageInner.tsx
// =============================================
/**
 * 위키 페이지 메인 영역 (본문/카테고리/목차/헤더 등)
 * - 카테고리 트리, 문서 트리, 대표문서 클릭, 문서 내용 로딩
 * - 목차 추출/브레드크럼/사이드바/수정 버튼
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import WikiReadRenderer from '@/wiki/lib/WikiReadRenderer';
import { extractHeadings } from '@/wiki/lib/extractHeadings';
import { QuestNpcList } from '@/wiki/lib/QuestNpcList';
import WikiHeader from "@/components/common/Header";
import '@wiki/css/wiki.css';
import HamburgerMenu from '@/components/common/HamburgerMenu';
import { Descendant } from 'slate';
import { useRouter, useSearchParams } from 'next/navigation';

// 카테고리 타입 정의
type CategoryNode = {
  id: number;
  name: string;
  icon?: string;
  order?: number;
  document_id?: number;         // 대표 문서 ID
  children?: CategoryNode[];
};

// 문서 타입 정의
type Document = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  fullPath?: number[];
  is_featured?: boolean;
};

// Props: 로그인 유저 정보
type Props = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
};

// 메인 컴포넌트
export default function WikiPageInner({ user }: Props) {
  // 상태 선언
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedDocPath, setSelectedDocPath] = useState<number[] | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<Descendant[] | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [tableOfContents, setTableOfContents] = useState<any[]>([]);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});
  const [categoryIdMap, setCategoryIdMap] = useState<Record<number, CategoryNode>>({});
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[] | null>(null);

  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [closingPaths, setClosingPaths] = useState<number[][]>([]);
  
  const [npcList, setNpcList] = useState<any[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<any | null>(null);
  const [npcPage, setNpcPage] = useState(0);

  // 머리찾기 관련 상태 추가
  const [headList, setHeadList] = useState<any[]>([]);
  const [headLoading, setHeadLoading] = useState(false);
  const [selectedHead, setSelectedHead] = useState<any | null>(null);
  const [headPage, setHeadPage] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedDoc = allDocuments.find(doc => doc.id === selectedDocId);

  // 전체 문서 불러오기
  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => {
        // 반드시 배열로 변환
        const docs = Array.isArray(data)
          ? data
          : Array.isArray(data.documents)
            ? data.documents
            : [];
        if (Object.keys(categoryIdToPathMap).length === 0) {
          setAllDocuments(docs);
          return;
        }
        // fullPath 붙여서 저장
        const mapped = docs.map((doc: Document & { path: number }) => ({
          ...doc,
          fullPath: categoryIdToPathMap[doc.path] || [doc.path],
        }));
        setAllDocuments(mapped);
      });
  }, [categoryIdToPathMap]);

  // 카테고리 -> path별 문서 리스트 필터
  const getDocumentsForCategory = (pathArr: number[]) => {
    return allDocuments.filter(
      (doc) => JSON.stringify(doc.fullPath) === JSON.stringify(pathArr) && !doc.is_featured
    );
  };

  // 카테고리 트리/ID -> 경로 맵/ID -> 노드맵 빌드
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        import('@wiki/lib/buildCategoryTree').then(mod => {
          const tree = mod.buildCategoryTree(data) as CategoryNode[];
          setCategories(tree);

          const idToPathMap: Record<number, number[]> = {};
          const categoryMap: Record<number, CategoryNode> = {};
          const buildMap = (nodes: CategoryNode[], path: number[] = []) => {
            for (const node of nodes) {
              const currentPath = [...path, node.id];
              idToPathMap[node.id] = currentPath;
              categoryMap[node.id] = node;
              if (node.children) buildMap(node.children, currentPath);
            }
          };

          buildMap(tree);
          setCategoryIdToPathMap(idToPathMap);
          setCategoryIdMap(categoryMap);
        });
      })
      .catch((err) => console.error('카테고리 로딩 실패:', err));
  }, []);

  useEffect(() => {
    const pathParam = searchParams.get('path');
    const titleParam = searchParams.get('title');
    if (pathParam && titleParam) {
      const pathId = Number(pathParam);
      const fullPath = categoryIdToPathMap[pathId];
      if (fullPath) {
        fetchDoc(fullPath, titleParam, undefined, { clearCategoryPath: true });
      }
    }
  }, [searchParams, categoryIdToPathMap]);

  // 카테고리 클릭(대표문서 있으면 본문 , 없으면 펼침/접힘만)
  const togglePath = async (path: number[]) => {
    const catId = path.at(-1)!;
    const category = categoryIdMap[catId];
    const isSamePath = selectedDocPath && JSON.stringify(selectedDocPath) === JSON.stringify(path);
    const isSameDoc = selectedDocId === category?.document_id;

    // 여기서 document_id가 정상적인 number(정수)인지 검사
    const docId = Number(category?.document_id);

    if (
      category?.document_id &&
      Number.isInteger(docId) &&
      (!isSamePath || !isSameDoc)
    ) {
      try {
        const res = await fetch(`/api/documents?id=${docId}`);
        if (!res.ok) throw new Error('대표 문서를 찾을 수 없습니다');
        const doc = await res.json();

        // 문서가 없는 경우(예: 삭제됨/DB 미동기 반영 등) → doc 또는 doc.title 체크
        if (!doc || !doc.title) {
          setSelectedDocId(null);
          setSelectedDocPath(null);
          setSelectedDocTitle(null);
          setDocContent([]);
          setSelectedCategoryPath(path); // 혹은 null
          // 필요시 카테고리만 열리게...
          return;
        }

        setSelectedDocId(doc.id);
        setSelectedDocPath([...path]);
        setSelectedDocTitle(doc.title);
        setSelectedCategoryPath(path);

        // **doc.title을 명확하게 넘김**
        fetchDoc(path, doc.title, doc.id);

        setOpenPaths((prev) => {
          const alreadyOpen = prev.some((p) => JSON.stringify(p) === JSON.stringify(path));
          return alreadyOpen ? prev : [...prev, path];
        });
      } catch (err) {
        // catch에서는 무조건 '문서를 찾을 수 없습니다' 세팅
        setSelectedDocId(null);
        setSelectedDocPath(null);
        setSelectedDocTitle(null);
        setDocContent([]);
        setSelectedCategoryPath(path); // 혹은 null
        console.error('대표 문서 fetch 실패:', err);
      }
    } else if (!category?.document_id || !Number.isInteger(docId)) {
      alert('대표 문서 ID가 잘못되어 열 수 없습니다: ' + String(category?.document_id));
    }
  };

  // 화살표 클릭: 펼침/접힘만 (대표문서 열지 않음)
  const toggleArrowOnly = (path: number[]) => {
    const pathStr = JSON.stringify(path);
    const isOpen = openPaths.some((p) => JSON.stringify(p) === pathStr);
    const isClosing = closingPaths.some((p) => JSON.stringify(p) === pathStr);

    if (isOpen) {
      // 이미 닫힘 중이면 아무것도 하지 않음(중복 방지)
      if (isClosing) return;
      // 닫힘 시작
      setClosingPaths((prev) => [...prev, path]);
      setTimeout(() => {
        setOpenPaths((prev) => prev.filter((p) => JSON.stringify(p) !== pathStr));
        setClosingPaths((prev) => prev.filter((p) => JSON.stringify(p) !== pathStr));
      }, 240); // CSS와 맞춰
    } else {
      // 열 때, 혹시 닫힘 트랜지션 중이면 강제 open
      setOpenPaths((prev) => {
        const exists = prev.some((p) => JSON.stringify(p) === pathStr);
        return exists ? prev : [...prev, path];
      });
      setClosingPaths((prev) => prev.filter((p) => JSON.stringify(p) !== pathStr));
    }
  };

  // 현재 경로가 열려있는지 여부
  const isPathOpen = (path: number[]) =>
    openPaths.some(p => JSON.stringify(p) === JSON.stringify(path));

  // 문서 불러오기 (카테고리/제목/ID)
  const fetchDoc = (
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean }
  ) => {
    if (options?.clearCategoryPath) {
      setSelectedCategoryPath(null); // 일반 문서 클릭 시 카테고리 active 해제
    }
    setSelectedDocTitle(docTitle);

    if (docId) {
      setSelectedDocId(docId);
      setSelectedDocPath([...categoryPath]);
    } else {
      const doc = allDocuments.find(
        (d) => d.title === docTitle && JSON.stringify(d.fullPath) === JSON.stringify(categoryPath)
      );
      if (doc) {
        setSelectedDocId(doc.id);
        setSelectedDocPath([...categoryPath]);
      }
    }

    fetch(`/api/documents?path=${String(categoryPath.at(-1))}&title=${encodeURIComponent(docTitle)}`)
      .then((res) => {
        if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
        return res.json();
      })
      .then((data) => {
        // 항상 Slate 배열만 저장!
        const content: Descendant[] =
          typeof data.content === 'string'
            ? JSON.parse(data.content)
            : data.content;
        setDocContent(content as any); // content를 Slate JSON 배열로 저장

        setTableOfContents(extractHeadings(content));
        if (data.fullPath && Array.isArray(data.fullPath)) {
          setSelectedDocPath([...data.fullPath]);
        }
      })
      .catch(() => setDocContent(null));
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const aTag = (e.target as HTMLElement).closest('a');
      if (!aTag) return;
      const href = aTag.getAttribute('href');
      if (href && href.startsWith('/wiki?')) {
        e.preventDefault();
        const url = new URL(href, window.location.origin);
        const path = url.searchParams.get('path');
        const title = url.searchParams.get('title');
        if (path && title) {
          router.push(`/wiki?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}&_t=${Date.now()}`);
        }
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [docContent, router]);

  // 카테고리/문서 트리 재귀 렌더링
  const renderTree = (nodes: CategoryNode[], parentPath: number[] = []) => {
    const result: JSX.Element[] = [];

    for (const node of nodes) {
      const currentPath = [...parentPath, node.id];
      const isOpen = isPathOpen(currentPath);
      const docs = getDocumentsForCategory(currentPath);
      const isCategoryActive =
        node.document_id != null &&
        selectedCategoryPath &&
        JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

      result.push(
        <li key={`cat-${node.id}`}>
          <button
            className={`wiki-nav-item ${isCategoryActive ? 'active' : ''}`}
            onClick={async () => {
              if (node.document_id != null) {
                const isActive =
                  selectedCategoryPath &&
                  JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

                if (!isActive) {
                  await togglePath(currentPath); // 대표문서 열기
                } else {
                  toggleArrowOnly(currentPath); // 이미 열려 있으면 펼침/접힘만
                }
              } else {
                // 대표 문서 없으면 펼침/접힘만
                toggleArrowOnly(currentPath);
              }
            }}
          >
            {node.icon && (
              <span className="wiki-category-icon" style={{ marginRight: '0.3em' }}>
                {node.icon.startsWith('http') ? (
                  <img src={node.icon} alt="icon" style={{ width: '1em', verticalAlign: 'middle' }} />
                ) : (
                  node.icon
                )}
              </span>
            )}
            <span className="wiki-category-label">{node.name}</span>
            {(node.children?.length || docs.length) > 0 && (
              <span
                className="wiki-category-arrow"
                style={{
                  cursor: 'pointer',
                  opacity: node.document_id != null ? 1 : 0.5,
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  // 대표 문서가 있으면 먼저 대표 문서 열림 -> 펼침/접힘
                  if (node.document_id != null) {
                    const isActive =
                      selectedCategoryPath &&
                      JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

                    if (!isActive) {
                      await togglePath(currentPath);
                    } else {
                      toggleArrowOnly(currentPath);
                    }
                  }
                }}
              >
                {isOpen ? '▼' : '▶'}
              </span>
            )}
          </button>
          <ul
            className={
              openPaths.some((p) => JSON.stringify(p) === JSON.stringify(currentPath))
                ? "wiki-doc-list open"
                : closingPaths.some((p) => JSON.stringify(p) === JSON.stringify(currentPath))
                ? "wiki-doc-list closing"
                : "wiki-doc-list"
            }
          >
            {(isOpen || closingPaths.some((p) => JSON.stringify(p) === JSON.stringify(currentPath))) && (
              <>
                {docs.map(doc => (
                  <li
                    key={`doc-${doc.title}`}
                    className={`wiki-doc-item ${selectedDocId === doc.id ? 'active' : ''}`}
                    onClick={() => fetchDoc(currentPath, doc.title, doc.id, { clearCategoryPath: true })}
                  >
                    <span style={{ marginRight: '0.3em' }}>
                      {doc.icon?.startsWith('http') ? (
                        <img src={doc.icon} alt="icon" style={{ width: '1em', verticalAlign: 'middle' }} />
                      ) : (
                        doc.icon || '📄'
                      )}
                    </span>
                    {doc.title}
                  </li>
                ))}
                {node.children && renderTree(node.children, currentPath)}
              </>
            )}
          </ul>
        </li>
      );
    }
    return result;
  };

  function NpcPictureSlider({ pictures = [] }: { pictures: string[] }) {
    const [idx, setIdx] = useState(0);
    if (!pictures.length) return (
      <div style={{
        width: 500, height: 400, background: '#e0e0e0',
        borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 20
      }}>사진 없음</div>
    );

    return (
      <div style={{
        position: "relative",
        width: 500, height: 400,
        borderRadius: 22,
        overflow: "hidden",
        background: "#00c463",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        {/* 사진 */}
        <img
          src={pictures[idx]}
          alt="npc"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        {/* 왼쪽 화살표 */}
        {pictures.length > 1 &&
          <button
            onClick={() => setIdx(i => (i - 1 + pictures.length) % pictures.length)}
            style={{
              position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              outline: "none",
              cursor: "pointer",
              opacity: 0.32,
              zIndex: 10,
            }}
            aria-label="이전"
          >
            <svg width="38" height="38" viewBox="0 0 38 38">
              <polyline points="22,12 16,19 22,26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
        {/* 오른쪽 화살표 */}
        {pictures.length > 1 &&
          <button
            onClick={() => setIdx(i => (i + 1) % pictures.length)}
            style={{
              position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              outline: "none",
              cursor: "pointer",
              opacity: 0.32,
              zIndex: 10,
            }}
            aria-label="다음"
          >
            <svg width="38" height="38" viewBox="0 0 38 38">
              <polyline points="16,12 22,19 16,26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
      </div>
    );
  }

  // 현재 경로로 브레드크럼(카테고리 이름) 추출
  const getCategoryNamesFromPath = (tree: CategoryNode[], path: number[]): string[] => {
    const names: string[] = [];
    let currentTree = tree;
    for (const id of path) {
      const match = currentTree.find(node => node.id === id);
      if (!match) break;
      names.push(match.name);
      currentTree = match.children || [];
    }
    return names;
  };

  useEffect(() => {
    // 문서 또는 카테고리 맵 준비 안됨 → 중단
    if (
      !selectedDoc ||
      !selectedDocTitle ||
      !categoryIdMap ||
      !selectedDoc.path ||
      !categoryIdMap[selectedDoc.path as number]
    ) {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }

    // 카테고리명 판별
    const currentCategory = categoryIdMap[selectedDoc.path as number];
    const catName = currentCategory?.name;

    // 머리찾기 분기 추가! (여기서만 다룸)
    if (catName === "머리찾기") {
      setHeadLoading(true); setHeadList([]); setHeadPage(0);
      // 마을 이름 → village id 조회
      fetch(`/api/villages?name=${encodeURIComponent(selectedDocTitle)}`)
        .then(res => res.json())
        .then(village => {
          if (!village || !village.id) {
            setHeadList([]); setHeadLoading(false); return;
          }
          return fetch(`/api/head?village_id=${village.id}`);
        })
        .then(res => (res && res.json ? res.json() : []))
        .then(heads => {
          setHeadList(Array.isArray(heads) ? heads : []);
          setHeadLoading(false);
        })
        .catch(() => {
          setHeadList([]); setHeadLoading(false);
        });
      // 나머지는 실행하지 않고 return
      return;
    }

    // 반드시 "퀘스트" 또는 "NPC"만
    if (catName !== "퀘스트" && catName !== "NPC") {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }

    setNpcLoading(true); setNpcList([]); setNpcPage(0);

    // 마을 이름 -> village id 조회 (NPC/퀘스트)
    fetch(`/api/villages?name=${encodeURIComponent(selectedDocTitle)}`)
      .then(res => res.json())
      .then(village => {
        if (!village || !village.id) {
          setNpcList([]); setNpcLoading(false); return;
        }
        const npcType = catName === "퀘스트" ? "quest" : "normal";
        return fetch(`/api/npcs?village_id=${village.id}&npc_type=${npcType}`);
      })
      .then(res => (res && res.json ? res.json() : []))
      .then(npcs => {
        setNpcList(Array.isArray(npcs) ? npcs : []);
        setNpcLoading(false);
      })
      .catch(() => {
        setNpcList([]); setNpcLoading(false);
      });

  }, [selectedDoc, selectedDocTitle, selectedDocId, categoryIdMap]);

  function getRootCategoryName(): string | undefined {
    if (!selectedDocPath || selectedDocPath.length < 1) return undefined;
    const rootCatId = selectedDocPath[0];
    return categoryIdMap[rootCatId]?.name;
  }

  function renderNpcGrid() {
    // 페이지 당 21개
    const pageSize = 21;
    const pageCount = Math.ceil(npcList.length / pageSize);
    const npcsOnPage = npcList.slice(npcPage * pageSize, (npcPage + 1) * pageSize);
    const rootCatName = getRootCategoryName();
    console.log('[모달/분기] rootCatName:', rootCatName, 'selectedDocPath:', selectedDocPath);

    return (
      <div>
        {/* NPC 아이콘 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: 20,
          margin: '20px 0'
        }}>
          {npcsOnPage.map((npc, i) => (
            <div
              key={npc.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #ddd',
                borderRadius: 10,
                height: 110,
                cursor: 'pointer',
                background: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                position: 'relative',
              }}
              onClick={() => setSelectedNpc(npc)}
            >
              <img
                src={npc.icon || '/npc-placeholder.png'}
                alt={npc.name}
                style={{
                  width: 65,
                  height: 65,
                  borderRadius: 10, // 네모!
                  objectFit: 'cover',
                  background: '#fff',
                }}
              />
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 900,
                  textAlign: 'center',
                  wordBreak: 'keep-all',
                  color: '#111',
                  letterSpacing: 0.5,
                  textShadow: `
                    0 1.5px 0 #fff, 
                    1.5px 0 0 #fff, 
                    0 -1.5px 0 #fff, 
                    -1.5px 0 0 #fff
                  `,
                  fontFamily: 'Pretendard, Malgun Gothic, sans-serif'
                }}
              >
                {npc.name}
              </div>

            </div>
          ))}
          {/* 남는 칸 비워주기 */}
          {[...Array(pageSize - npcsOnPage.length)].map((_, i) =>
            <div key={'empty-' + i}></div>
          )}
        </div>
        {/* 페이징 */}
        {pageCount > 1 &&
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '10px 0' }}>
            <button
              onClick={() => setNpcPage(p => Math.max(0, p - 1))}
              disabled={npcPage === 0}
              style={{ fontSize: 20, opacity: npcPage === 0 ? 0.5 : 1 }}
            >◀</button>
            <span style={{ fontSize: 16 }}>{npcPage + 1} / {pageCount}</span>
            <button
              onClick={() => setNpcPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={npcPage === pageCount - 1}
              style={{ fontSize: 20, opacity: npcPage === pageCount - 1 ? 0.5 : 1 }}
            >▶</button>
          </div>
        }

        {/* NPC 상세 모달 */}
        {selectedNpc && (
          rootCatName === "NPC"
            ? (
              // NPC 카테고리 전용 - 간단 정보만!
              <div
                style={{
                  position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
                  background: 'rgba(0,0,0,0.28)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onClick={() => setSelectedNpc(null)}
              >
                <div
                  style={{
                    background: '#fff',
                    minWidth: 1200, maxWidth: 1040, minHeight: 560,
                    borderRadius: 24, position: 'relative',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
                    padding: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden',
                    alignItems: 'flex-start'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* 좌측: 사진 */}
                  <div style={{
                    width: 600, minHeight: 440, background: '#fafbfc',
                    padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1.5px solid #eee', justifyContent: 'center'
                  }}>
                    {/* 아이콘 + 이름(가로 한줄) */}
                    <div style={{
                      display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 18, gap: 18
                    }}>
                      <img src={selectedNpc.icon} alt="icon"
                        style={{
                          width: 65, height: 65, borderRadius: 12,
                          objectFit: 'cover', border: '2px solid #e0e0e0', boxShadow: '0 1.5px 10px #e4e5e8'
                        }} />
                      <div style={{ fontSize: 35, fontWeight: 700 }}>{selectedNpc.name}</div>
                    </div>
                    {/* 사진 슬라이더(페이지 수 X, 더 크게!) */}
                    <NpcPictureSlider pictures={selectedNpc.pictures} />
                  </div>
                  {/* 우측: 정보 테이블 (퀘스트/보상/선행퀘스트 대신 위치/대사만) */}
                  <div style={{ flex: 1, padding: '54px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 350, marginTop: 40 }}>
                    <table style={{ width: '100%', fontSize: 19, lineHeight: 2.1, borderSpacing: 0 }}>
                      <tbody>
                        <tr>
                          <td style={{ color: '#666', width: 120, fontWeight: 600 }}>위치</td>
                          <td><b>{[selectedNpc.location_x, selectedNpc.location_y, selectedNpc.location_z].join(', ')}</b></td>
                        </tr>
                        <tr>
                          <td style={{ color: '#666', fontWeight: 600, verticalAlign: 'top' }}>대사</td>
                          <td>
                            <div style={{
                              background: '#f6f8fa', padding: '15px 16px', borderRadius: 8, minHeight: 80, whiteSpace: 'pre-line', fontSize: 17
                            }}>
                              {selectedNpc.line || <span style={{ color: '#bbb' }}>- 대사 없음 -</span>}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button
                    style={{
                      position: 'absolute', right: 18, top: 18, fontSize: 30,
                      background: 'none', border: 'none', cursor: 'pointer', color: '#777'
                    }}
                    onClick={() => setSelectedNpc(null)}
                  >×</button>
                </div>
              </div>  
            )
            : (
              // 퀘스트(또는 다른 타입) 상세 모달: 기존 코드 복사 붙여넣기
              <div
                style={{
                  position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
                  background: 'rgba(0,0,0,0.28)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onClick={() => setSelectedNpc(null)}
              >
                <div
                  style={{
                    background: '#fff',
                    minWidth: 1200, maxWidth: 1040, minHeight: 560,
                    borderRadius: 24, position: 'relative',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
                    padding: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden',
                    alignItems: 'flex-start'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* 좌측: 사진 */}
                  <div style={{
                    width: 600, minHeight: 440, background: '#fafbfc',
                    padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1.5px solid #eee', justifyContent: 'center'
                  }}>
                    {/* 아이콘 + 이름(가로 한줄) */}
                    <div style={{
                      display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 18, gap: 18
                    }}>
                      <img src={selectedNpc.icon} alt="icon"
                        style={{
                          width: 65, height: 65, borderRadius: 12,
                          objectFit: 'cover', border: '2px solid #e0e0e0', boxShadow: '0 1.5px 10px #e4e5e8'
                        }} />
                      <div style={{ fontSize: 35, fontWeight: 700 }}>{selectedNpc.name}</div>
                    </div>
                    {/* 사진 슬라이더(페이지 수 X, 더 크게!) */}
                    <NpcPictureSlider pictures={selectedNpc.pictures} />
                  </div>
                  {/* 우측: 정보 테이블 */}
                  <div style={{ flex: 1, padding: '54px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 350, marginTop: 40 }}>
                    <table style={{ width: '100%', fontSize: 19, lineHeight: 2.1, borderSpacing: 0 }}>
                      <tbody>
                        <tr>
                          <td style={{ color: '#666', width: 120, fontWeight: 600 }}>위치</td>
                          <td><b>{[selectedNpc.location_x, selectedNpc.location_y, selectedNpc.location_z].join(', ')}</b></td>
                        </tr>
                        <tr>
                          <td style={{ color: '#666', fontWeight: 600 }}>퀘스트</td>
                          <td>{selectedNpc.quest || '-'}</td>
                        </tr>
                        <tr>
                          <td style={{ color: '#666', fontWeight: 600 }}>보상</td>
                          <td>
                            {Array.isArray(selectedNpc.rewards) && selectedNpc.rewards.length > 0 ? (
                              <div style={{
                                display: 'flex', flexDirection: 'column', gap: 5
                              }}>
                                {selectedNpc.rewards.map((rw: any, i: number) => (
                                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    {rw.icon && (
                                      rw.icon.startsWith('http')
                                        ? <img src={rw.icon} alt="보상" style={{ width: 26, height: 26, verticalAlign: 'middle', marginRight: 3 }} />
                                        : <span style={{ fontSize: 22, marginRight: 3 }}>{rw.icon}</span>
                                    )}
                                    <span>{rw.text}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#bbb' }}>-</span>
                            )}
                          </td>
                        </tr>
                        {selectedNpc.requirement && (
                          <tr>
                            <td style={{ color: '#666', fontWeight: 600 }}>선행퀘스트</td>
                            <td>{selectedNpc.requirement}</td>
                          </tr>
                        )}
                        <tr>
                          <td style={{ color: '#666', fontWeight: 600, verticalAlign: 'top' }}>대사</td>
                          <td>
                            <div style={{
                              background: '#f6f8fa', padding: '15px 16px', borderRadius: 8, minHeight: 80, whiteSpace: 'pre-line', fontSize: 17
                            }}>
                              {selectedNpc.line || <span style={{ color: '#bbb' }}>- 대사 없음 -</span>}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button
                    style={{
                      position: 'absolute', right: 18, top: 18, fontSize: 30,
                      background: 'none', border: 'none', cursor: 'pointer', color: '#777'
                    }}
                    onClick={() => setSelectedNpc(null)}
                  >×</button>
                </div>
              </div>
            )
        )}
      </div>
    );
  }

  function renderHeadGrid() {
    // 페이지 당 21개
    const pageSize = 21;
    const pageCount = Math.ceil(headList.length / pageSize);
    const headsOnPage = headList.slice(headPage * pageSize, (headPage + 1) * pageSize);

    return (
      <div>
        {/* 머리찾기 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 20,
          margin: '20px 0'
        }}>
          {headsOnPage.map((head, i) => (
            <div
              key={head.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #ddd',
                borderRadius: 10,
                height: 110,
                cursor: 'pointer',
                background: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                position: 'relative',
              }}
              onClick={() => setSelectedHead(head)}
            >
              {/* 아이콘 (마을 머리 아이콘 사용) */}
              {selectedDoc?.icon && (
                selectedDoc.icon.startsWith('http')
                  ? <img src={selectedDoc.icon} alt="icon" style={{ width: 45, height: 45, borderRadius: 10, objectFit: 'cover', background: '#fff' }} />
                  : <span style={{ fontSize: 55 }}>{selectedDoc.icon}</span>
              )}
              <div style={{
                fontSize: 18,
                fontWeight: 900,
                textAlign: 'center',
                color: '#111',
                letterSpacing: 0.5,
                textShadow: `
                  0 1.5px 0 #fff, 
                  1.5px 0 0 #fff, 
                  0 -1.5px 0 #fff, 
                  -1.5px 0 0 #fff
                `,
                fontFamily: 'Pretendard, Malgun Gothic, sans-serif'
              }}>
                {head.order}번
              </div>
              <div style={{ fontSize: 14, color: '#555' }}>
                ({head.location_x}, {head.location_y}, {head.location_z})
              </div>
            </div>
          ))}
          {[...Array(pageSize - headsOnPage.length)].map((_, i) =>
            <div key={'empty-' + i}></div>
          )}
        </div>
        {/* 페이징 */}
        {pageCount > 1 &&
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '10px 0' }}>
            <button
              onClick={() => setHeadPage(p => Math.max(0, p - 1))}
              disabled={headPage === 0}
              style={{ fontSize: 20, opacity: headPage === 0 ? 0.5 : 1 }}
            >◀</button>
            <span style={{ fontSize: 16 }}>{headPage + 1} / {pageCount}</span>
            <button
              onClick={() => setHeadPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={headPage === pageCount - 1}
              style={{ fontSize: 20, opacity: headPage === pageCount - 1 ? 0.5 : 1 }}
            >▶</button>
          </div>
        }
        {/* 머리찾기 상세 모달 */}
        {selectedHead && (
          <div
            style={{
              position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
              background: 'rgba(0,0,0,0.28)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onClick={() => setSelectedHead(null)}
          >
            <div
              style={{
                background: '#fff',
                minWidth: 1200, maxWidth: 1040, minHeight: 560,
                borderRadius: 24, position: 'relative',
                boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
                padding: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden',
                alignItems: 'flex-start'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* 좌측: 사진 */}
              <div style={{
                width: 600, minHeight: 400, background: '#fafbfc',
                padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1.5px solid #eee', justifyContent: 'center'
              }}>
                <div style={{
                  display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18, gap: 18
                }}>
                  {selectedDoc?.icon && (
                    selectedDoc.icon.startsWith('http')
                      ? <img src={selectedDoc.icon} alt="icon"
                        style={{ width: 65, height: 65, borderRadius: 12, objectFit: 'cover', border: '2px solid #e0e0e0', boxShadow: '0 1.5px 10px #e4e5e8' }}
                      />
                      : <span style={{ fontSize: 55 }}>{selectedDoc.icon}</span>
                  )}
                  <div style={{ fontSize: 30, fontWeight: 700 }}>{selectedHead.order}번 머리</div>
                </div>
                <NpcPictureSlider pictures={selectedHead.pictures || []} />
              </div>
              {/* 우측: 위치 정보 */}
              <div style={{ flex: 1, padding: '54px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 250, marginTop: 40 }}>
                <table style={{ width: '100%', fontSize: 19, lineHeight: 2.1, borderSpacing: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ color: '#666', width: 90, fontWeight: 600 }}>위치</td>
                      <td><b>{[selectedHead.location_x, selectedHead.location_y, selectedHead.location_z].join(', ')}</b></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                style={{
                  position: 'absolute', right: 18, top: 18, fontSize: 30,
                  background: 'none', border: 'none', cursor: 'pointer', color: '#777'
                }}
                onClick={() => setSelectedHead(null)}
              >×</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 렌더: 헤더/사이드바/목차/본문/수정/햄버거
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div className="wiki-layout">
        <div className="wiki-main-scrollable">
          {/* 사이드바(카테고리) */}
          <aside className="wiki-sidebar">
            <h2 className="wiki-sidebar-title">카테고리</h2>
            <ul className="wiki-nav-list">{renderTree(categories)}</ul>
          </aside>

          {/* 본문 영역 */}
          <main className="wiki-content">
            {/* 브레드크럼 */}
            <div className="wiki-breadcrumb">
              {selectedDocPath ? (
                <div className="wiki-breadcrumb-flex">
                  <button
                    className="wiki-back-button"
                    onClick={() => {
                      setSelectedDocPath(null);
                      setSelectedDocTitle(null);
                      setDocContent([]);
                    }}
                  >
                    ←
                  </button>
                  <span>{getCategoryNamesFromPath(categories, selectedDocPath).join(' > ')}</span>
                </div>
              ) : (
                <span>렌독 위키 - 문서 목록</span>
              )}
            </div>
            <h2 className="wiki-content-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* 문서 아이콘 (있으면) */}
              {selectedDoc?.icon && (
                selectedDoc.icon.startsWith('http') ? (
                  <img
                    src={selectedDoc.icon}
                    alt="icon"
                    style={{
                      width: 32, height: 32, verticalAlign: 'middle',
                      marginRight: 8, objectFit: 'contain', display: 'inline-block'
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 28, marginRight: 8 }}>{selectedDoc.icon}</span>
                )
              )}
              {selectedDocTitle || '렌독 위키'}
            </h2>
            {/* 본문 */}
            <div className="wiki-content-body" ref={contentRef}>
              {/* 머리찾기 */}
              {categoryIdMap[selectedDoc?.path as number]?.name === "머리찾기" ? (
                headLoading
                  ? <div>머리찾기 목록 로딩 중...</div>
                  : headList.length > 0
                    ? renderHeadGrid()
                    : <div>등록된 머리찾기가 없습니다.</div>
              )
                // NPC/퀘스트 기존
                : npcLoading
                  ? <div>NPC 목록 로딩 중...</div>
                  : npcList.length > 0
                    ? renderNpcGrid()
                    : (Array.isArray(docContent) && docContent.length > 0
                        ? <WikiReadRenderer content={docContent} />
                        : <div>문서를 찾을 수 없습니다.</div>
                      )
              }
            </div>
          </main>
        </div>

        {/* 목차(heading) */}
        {/* 목차(heading) - 항상 고정 렌더링 */}
        <aside className="wiki-toc-sidebar">
          {tableOfContents.length > 0 ? (
            <ul>
              {tableOfContents.map((heading, idx) => (
                <li
                  key={idx}
                  style={{ marginLeft: `${(heading.level - 1) * 16}px`, lineHeight: 1.8 }}
                >
                  <a
                    href={`#${heading.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textDecoration: 'none',
                      color: 'inherit',
                      minHeight: 24,
                      marginBottom: 6
                    }}
                  >
                    {heading.icon?.startsWith('http') ? (
                      <img
                        src={heading.icon}
                        alt="icon"
                        style={{
                          width: 26,         // 13 * 2 = 26px
                          height: 26,
                          verticalAlign: 'middle',
                          marginRight: 3,
                          objectFit: 'contain',
                          display: 'inline-block'
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 20, marginRight: 3 }}>{heading.icon}</span>
                    )}
                    <span style={{ fontSize: 20, fontWeight: 'bold' }}>{heading.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#bbb', padding: '1rem', fontSize: '0.96em', textAlign: 'center' }}>
              목차 없음
            </div>
          )}
        </aside>

      </div>

      {/* 우측 햄버거 메뉴 */}
      {isMenuOpen && (
        <HamburgerMenu
          onClose={() => setIsMenuOpen(false)}
          isLoggedIn={!!user}
          username={user?.minecraft_name || ''}
          uuid={''}
        />
      )}
    </div>
  );
}
