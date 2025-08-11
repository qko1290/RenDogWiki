// app/components/manager/SortableList.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  Active,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
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
  useOverlay = false, // << 기본: 오버레이 끔
}: SortableListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = useMemo(() => items.map(i => String(i.id)), [items]);

  const [active, setActive] = useState<Active | null>(null);
  const activeItem = useMemo(
    () => items.find(i => String(i.id) === String(active?.id)),
    [active, items]
  );

  function SortableRow({ item }: { item: T }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: String(item.id),
    });

    // 오버레이를 쓰지 않을 때: 원소 자체가 transform으로 움직임
    // 오버레이를 쓸 때: 원소를 잠깐 숨겨(투명도 0) 복제본이 떠다니게
    const style: React.CSSProperties = useOverlay
      ? { opacity: isDragging ? 0 : 1 } // overlay 모드에서는 원본 숨김
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
          selectedId === item.id ? 'selected' : '',
        ].join(' ')}
        style={style}
        {...attributes}
        onClick={() => onSelect?.(item)}
      >
        <span className="drag-handle" {...listeners} onClick={e => e.stopPropagation()}>
          ⠿
        </span>
        {renderItem(item)}
      </li>
    );
  }

  const handleDragStart = (evt: DragStartEvent) => setActive(evt.active);
  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    setActive(null);
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

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
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map(it => (
            <SortableRow key={String(it.id)} item={it} />
          ))}
        </ul>
      </SortableContext>

      {useOverlay && activeItem && (
        <DragOverlay>
          <li className={[itemClassName ?? '', 'dragging', 'overlay'].join(' ')}>
            {/* 핸들은 복제하지 않아도 됨 */}
            {renderItem(activeItem)}
          </li>
        </DragOverlay>
      )}
    </DndContext>
  );
}
