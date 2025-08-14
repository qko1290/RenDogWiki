// =============================================
// File: app/components/manager/SortableList.tsx
// =============================================
'use client';

/**
 * 정렬 가능한 리스트 컴포넌트
 * - dnd-kit 기반 세로 리스트 정렬(마우스/터치/키보드)
 * - 선택/재정렬 콜백, 오버레이(복제본) 사용 옵션 지원
 * - 외부에서 아이템 렌더러(renderItem) 주입
 */

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
  Active,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragOverlay } from '@dnd-kit/core';

type IdLike = string | number;
type AnyItem = { id: IdLike; order?: number };

type SortableListProps<T extends AnyItem> = {
  items: T[];
  selectedId?: IdLike;
  onSelect?: (item: T) => void;
  onReorder: (items: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  /** true면 DragOverlay 사용(카드 복제 떠다님). false면 원 카드가 이동(기본값). */
  useOverlay?: boolean;
};

export function SortableList<T extends AnyItem>({
  items,
  selectedId,
  onSelect,
  onReorder,
  renderItem,
  className,
  itemClassName,
  useOverlay = false, // 기본: 오버레이 끔
}: SortableListProps<T>) {
  // 포인터 + 키보드 센서(접근성)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 문자열 id 배열(정렬 컨텍스트용)
  const ids = useMemo(() => items.map(i => String(i.id)), [items]);

  // 드래그된 활성 아이템 상태
  const [active, setActive] = useState<Active | null>(null);
  const activeItem = useMemo(
    () => items.find(i => String(i.id) === String(active?.id)),
    [active, items]
  );

  function SortableRow({ item }: { item: T }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: String(item.id) });

    // dnd-kit attributes에는 role이 포함됨 → 중복 방지 위해 제거
    const { role: _ignoredRole, ...itemAttributes } = attributes;

    // 오버레이가 켜진 경우: 원본은 드래그 중 숨기기
    // 오버레이가 꺼진 경우: transform으로 원본을 움직임
    const style: React.CSSProperties = useOverlay
      ? { opacity: isDragging ? 0 : 1 }
      : {
          transform: CSS.Transform.toString(transform),
          transition,
          zIndex: isDragging ? 3 : undefined,
          willChange: 'transform',
        };

    return (
      <li
        ref={setNodeRef}
        className={[
          itemClassName ?? '',
          isDragging ? 'dragging' : '',
          String(selectedId) === String(item.id) ? 'selected' : '',
        ].join(' ')}
        style={style}
        role="option"
        aria-selected={String(selectedId) === String(item.id)}
        {...itemAttributes}
        onClick={() => onSelect?.(item)}
      >
        <button
          type="button"
          className="drag-handle"
          title="드래그하여 순서 변경"
          aria-label="드래그하여 순서 변경"
          {...listeners}
          onClick={e => e.stopPropagation()}
          style={{ cursor: 'grab' }}
        >
          ⠿
        </button>
        {renderItem(item)}
      </li>
    );
  }

  const handleDragStart = (evt: DragStartEvent) => setActive(evt.active);
  const handleDragCancel = (_evt: DragCancelEvent) => setActive(null);

  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    setActive(null);
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    // order 필드(1-base) 재계산하여 반환
    const reordered = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({
      ...it,
      order: idx + 1,
    })) as T[];
    onReorder(reordered);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className} role="listbox" aria-label="정렬 가능한 목록">
          {items.map(it => (
            <SortableRow key={String(it.id)} item={it} />
          ))}
        </ul>
      </SortableContext>

      {useOverlay && activeItem && (
        <DragOverlay>
          <li className={[itemClassName ?? '', 'dragging', 'overlay'].join(' ')}>
            {renderItem(activeItem)}
          </li>
        </DragOverlay>
      )}
    </DndContext>
  );
}
