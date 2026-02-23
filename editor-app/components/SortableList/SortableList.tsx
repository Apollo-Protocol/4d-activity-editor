import React, { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Active, Over, UniqueIdentifier } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { SortableOverlay } from "./SortableOverlay";
import { DragHandle, SortableItem } from "./SortableItem";

interface BaseItem {
  id: UniqueIdentifier;
}

interface Props<T extends BaseItem> {
  items: T[];
  onChange(items: T[]): void;
  renderItem(item: T): ReactNode;
  canReorder?(activeItem: T, overItem: T): boolean;
}

export function SortableList<T extends BaseItem>({
  items,
  onChange,
  renderItem,
  canReorder,
}: Props<T>) {
  const [active, setActive] = useState<Active | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const activeItem = useMemo(
    () => items.find((item) => item.id === active?.id),
    [active, items]
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => {
        setActive(active);
      }}
      onDragOver={({ over }) => {
        setOverId(over?.id ?? null);
      }}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over?.id) {
          const activeIndex = items.findIndex(({ id }) => id === active.id);
          const overIndex = items.findIndex(({ id }) => id === over.id);

          if (activeIndex < 0 || overIndex < 0) {
            setActive(null);
            return;
          }

          if (canReorder && !canReorder(items[activeIndex], items[overIndex])) {
            setActive(null);
            return;
          }

          onChange(arrayMove(items, activeIndex, overIndex));
        }
        setActive(null);
        setOverId(null);
      }}
      onDragCancel={() => {
        setActive(null);
        setOverId(null);
      }}
    >
      <SortableContext items={items}>
        <ul className="SortableList" role="application">
          {items.map((item) => (
            <React.Fragment key={item.id}>
              <div className={active && overId === item.id && active.id !== item.id ? "SortableDropTarget" : ""}>
                {renderItem(item)}
              </div>
            </React.Fragment>
          ))}
        </ul>
      </SortableContext>
      <SortableOverlay>
        {activeItem ? renderItem(activeItem) : null}
      </SortableOverlay>
    </DndContext>
  );
}

SortableList.Item = SortableItem;
SortableList.DragHandle = DragHandle;
