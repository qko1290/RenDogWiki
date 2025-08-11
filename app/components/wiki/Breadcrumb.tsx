// components/wiki/Breadcrumb.tsx
import React from 'react';

type CategoryNode = {
  id: number;
  name: string;
  icon?: string;
  children?: CategoryNode[];
};

type Props = {
  selectedDocPath: number[] | null;
  categories: CategoryNode[];
  // 추가: 클릭으로 경로/문서 초기화 등 하고 싶을 때
  setSelectedDocPath?: (path: number[] | null) => void;
  setSelectedDocTitle?: (t: string | null) => void;
  setDocContent?: (c: any) => void;
};

function getCategoryPathWithIcon(tree: CategoryNode[], path: number[]) {
  const items: { name: string; icon?: string; id: number }[] = [];
  let currentTree = tree;
  for (const id of path) {
    const match = currentTree.find(n => n.id === id);
    if (!match) break;
    items.push({ name: match.name, icon: match.icon, id: match.id });
    currentTree = match.children || [];
  }
  return items;
}

const Breadcrumb: React.FC<Props> = ({
  selectedDocPath,
  categories,
  setSelectedDocPath,
  setSelectedDocTitle,
  setDocContent,
}) => {
  if (!selectedDocPath) return null;
  const pathItems = getCategoryPathWithIcon(categories, selectedDocPath);

  const onCrumbClick = (idx: number) => {
    if (!setSelectedDocPath) return;
    const nextPath = selectedDocPath.slice(0, idx + 1);
    setSelectedDocPath(nextPath);
    setSelectedDocTitle?.(null);
    setDocContent?.(null);
  };

  return (
    <div className="wiki-breadcrumb">
      <div className="wiki-breadcrumb-flex">
        {pathItems.map((item, i) => (
          <React.Fragment key={item.id}>
            {i > 0 && <span className="wiki-breadcrumb-sep">{'>'}</span>}
            <button
              type="button"
              className="wiki-breadcrumb-item"
              onClick={() => onCrumbClick(i)}
            >
              {item.icon &&
                (item.icon.startsWith('http') ? (
                  <img
                    src={item.icon}
                    alt=""
                    style={{ width: 20, height: 20, marginRight: 5, verticalAlign: 'middle' }}
                  />
                ) : (
                  <span style={{ marginRight: 4, fontSize: 20 }}>{item.icon}</span>
                ))}
              {item.name}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Breadcrumb;
