import React from 'react';

type CategoryNode = {
  id: number;
  name: string;
  children?: CategoryNode[];
};
type Props = {
  selectedDocPath: number[] | null;
  categories: CategoryNode[];
  setSelectedDocPath: (path: number[] | null) => void;
  setSelectedDocTitle: (title: string | null) => void;
  setDocContent: (content: any) => void;
};

function getCategoryNamesFromPath(tree: CategoryNode[], path: number[]): string[] {
  const names: string[] = [];
  let currentTree = tree;
  for (const id of path) {
    const match = currentTree.find(node => node.id === id);
    if (!match) break;
    names.push(match.name);
    currentTree = match.children || [];
  }
  return names;
}

const Breadcrumb: React.FC<Props> = ({
  selectedDocPath, categories, setSelectedDocPath, setSelectedDocTitle, setDocContent
}) => (
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
);

export default Breadcrumb;
