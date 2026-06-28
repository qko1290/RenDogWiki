'use client';

import React, { useRef, useState } from 'react';
import type { RenderElementProps } from 'slate-react';
import { ReactEditor, useFocused, useSelected } from 'slate-react';
import { Transforms } from 'slate';

import ImageSizeModal from '../../ImageSizeModal';
import { toProxyUrl } from '@lib/cdn';

import MediaBlock from '@/components/wiki-render/blocks/MediaBlock';
import type { VideoElement } from '@/types/slate';

type BlockComponentProps<E = any> = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: E;
  editor: any;
};

function EditIcon({ size = 18, color = '#2a90ff' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 20h4.2L19.3 8.9a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0L4 15.8V20Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M13.8 6L18 10.2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ImageBlock({
  attributes,
  children,
  element,
  editor,
}: BlockComponentProps<any>) {
  const el: any = element;
  const selected = useSelected();
  const focused = useFocused();
  const [modalOpen, setModalOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [initSize, setInitSize] = useState<{ w?: number; h?: number }>({});

  const handleSaveSize = (width: number, height: number) => {
    const path = ReactEditor.findPath(editor, element);

    Transforms.setNodes(editor, { width, height }, { at: path });
    setModalOpen(false);
  };

  const imgSrc =
    typeof el.url === 'string' && el.url.startsWith('http')
      ? toProxyUrl(el.url)
      : el.url;

  const openSizeModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const img = imgRef.current;
    const rectW = Math.round(img?.getBoundingClientRect().width || 0);
    const rectH = Math.round(img?.getBoundingClientRect().height || 0);
    const natW = img?.naturalWidth || 0;
    const natH = img?.naturalHeight || 0;
    const w = el.width || rectW || natW || 256;
    const h = el.height || rectH || natH || 256;

    setInitSize({ w, h });
    setModalOpen(true);
  };

  return (
    <>
      <MediaBlock
        mode="edit"
        kind="image"
        src={imgSrc}
        alt={el.alt || ''}
        textAlign={el.textAlign}
        width={el.width}
        height={el.height}
        selected={selected}
        focused={focused}
        attributes={attributes}
        imageRef={imgRef}
        editControls={
          selected ? (
            <button
              type="button"
              onMouseDown={openSizeModal}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: '#fff',
                border: '1.5px solid #2a90ff',
                borderRadius: '50%',
                boxShadow: '0 1px 5px #0001',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 1,
                padding: 0,
              }}
              tabIndex={-1}
              title="이미지 크기 편집"
              contentEditable={false}
            >
              <EditIcon />
            </button>
          ) : null
        }
      >
        {children}
      </MediaBlock>

      <ImageSizeModal
        open={modalOpen}
        width={initSize.w}
        height={initSize.h}
        onSave={handleSaveSize}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

export function VideoBlock({
  attributes,
  children,
  element,
  editor,
}: BlockComponentProps<VideoElement>) {
  const el = element as VideoElement;
  const selected = useSelected();
  const focused = useFocused();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSaveSize = (width: number, height: number) => {
    const path = ReactEditor.findPath(editor, element);

    Transforms.setNodes(editor, { width, height }, { at: path });
    setModalOpen(false);
  };

  const src =
    typeof el.url === 'string' && el.url.startsWith('http')
      ? toProxyUrl(el.url)
      : el.url;

  const openSizeModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
      <MediaBlock
        mode="edit"
        kind="video"
        src={src}
        textAlign={el.textAlign}
        width={el.width}
        height={el.height}
        selected={selected}
        focused={focused}
        attributes={attributes}
        editControls={
          selected ? (
            <button
              type="button"
              onMouseDown={openSizeModal}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: '#fff',
                border: '1.5px solid #2a90ff',
                borderRadius: '50%',
                boxShadow: '0 1px 5px #0001',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 1,
                padding: 0,
              }}
              tabIndex={-1}
              title="영상 크기 편집"
              contentEditable={false}
            >
              ⚙️
            </button>
          ) : null
        }
      >
        {children}
      </MediaBlock>

      <ImageSizeModal
        open={modalOpen}
        width={el.width}
        height={el.height}
        onSave={handleSaveSize}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}