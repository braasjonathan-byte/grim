import type React from "react";
import { useMemo } from "react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

// Drag & drop för att ändra ordning på övningar i ett pass (ersätter upp/ner-pilarna).
export function ExerciseDndContext({ count, onReorder, children }: { count: number; onReorder: (from: number, to: number) => void; children: React.ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => String(i)), [count]);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(Number(active.id), Number(over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

export interface SortableLineRenderProps {
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  handle: React.ReactNode;
}

export function SortableLine({ id, children }: { id: string; children: (props: SortableLineRenderProps) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
  };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className="p-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-primary transition-colors"
      aria-label="Dra för att flytta"
      title="Dra för att flytta"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
  return <>{children({ setNodeRef, style, handle })}</>;
}
