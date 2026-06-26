import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Lock, Plus, Star } from "lucide-react";
import type { Category, Channel, PublicUser } from "@slashslack/shared";
import { Icon } from "./Icon";
import { api } from "../lib/api";

type Containers = Record<string, number[]>; // "cat-<id>" | "cat-null" -> channelId[]

const keyFor = (catId: number | null) => `cat-${catId ?? "null"}`;
const catFromKey = (k: string) => (k === "cat-null" ? null : Number(k.slice(4)));

function build(channels: Channel[], categories: Category[]): Containers {
  const c: Containers = {};
  for (const cat of categories) c[keyFor(cat.id)] = [];
  c[keyFor(null)] = [];
  const sorted = [...channels].sort((a, b) => a.position - b.position);
  for (const ch of sorted) {
    const k = keyFor(ch.categoryId);
    (c[k] ||= []).push(ch.id);
  }
  return c;
}

export function ChannelDnd({
  channels,
  categories,
  scope,
  collapsed,
  toggleCollapse,
  onSelect,
  onNewChannel,
}: {
  channels: Channel[];
  categories: Category[];
  scope: string | null;
  collapsed: Record<number, boolean>;
  toggleCollapse: (id: number) => void;
  onSelect: (scope: string) => void;
  onNewChannel: (categoryId: number | null) => void;
}) {
  const qc = useQueryClient();
  const [containers, setContainers] = useState<Containers>(() => build(channels, categories));
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(
    // long-press (~220ms) before a drag begins, so taps still select channels
    useSensor(PointerSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  // resync from server unless mid-drag
  useEffect(() => {
    if (activeId === null) setContainers(build(channels, categories));
  }, [channels, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const chById = new Map(channels.map((c) => [c.id, c]));
  const findContainer = (id: number) =>
    Object.keys(containers).find((k) => containers[k].includes(id));

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const activeIdN = Number(e.active.id);
    const overId = e.over?.id;
    if (overId === undefined) return;
    const from = findContainer(activeIdN);
    // over can be a channel id or a container key
    const to =
      typeof overId === "string" && overId.startsWith("cat-")
        ? overId
        : findContainer(Number(overId));
    if (!from || !to || from === to) return;
    setContainers((prev) => {
      const next = { ...prev, [from]: [...prev[from]], [to]: [...prev[to]] };
      next[from] = next[from].filter((x) => x !== activeIdN);
      const overIndex =
        typeof overId === "number" || /^\d+$/.test(String(overId))
          ? next[to].indexOf(Number(overId))
          : next[to].length;
      next[to].splice(overIndex < 0 ? next[to].length : overIndex, 0, activeIdN);
      return next;
    });
  };

  const persist = async (state: Containers) => {
    const items: { channelId: number; categoryId: number | null; position: number }[] = [];
    let pos = 0;
    for (const cat of categories) {
      for (const id of state[keyFor(cat.id)] || []) items.push({ channelId: id, categoryId: cat.id, position: pos++ });
    }
    for (const id of state[keyFor(null)] || []) items.push({ channelId: id, categoryId: null, position: pos++ });
    await api.post("/api/channels/layout", { items });
    qc.invalidateQueries({ queryKey: ["channels"] });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const activeIdN = Number(e.active.id);
    const overId = e.over?.id;
    setActiveId(null);
    if (overId === undefined) return;
    setContainers((prev) => {
      const from = findContainer(activeIdN)!;
      const to =
        typeof overId === "string" && overId.startsWith("cat-") ? overId : findContainer(Number(overId)) || from;
      const next = { ...prev, [to]: [...prev[to]] };
      if (from === to && typeof overId !== "string") {
        const oldIndex = next[to].indexOf(activeIdN);
        const newIndex = next[to].indexOf(Number(overId));
        if (oldIndex !== newIndex && newIndex >= 0) {
          next[to].splice(oldIndex, 1);
          next[to].splice(newIndex, 0, activeIdN);
        }
      }
      void persist(next);
      return next;
    });
  };

  const active = activeId ? chById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      {categories.map((cat) => (
        <CategoryGroup
          key={cat.id}
          title={cat.name}
          icon={cat.icon}
          containerKey={keyFor(cat.id)}
          ids={containers[keyFor(cat.id)] || []}
          chById={chById}
          scope={scope}
          collapsed={!!collapsed[cat.id]}
          onToggle={() => toggleCollapse(cat.id)}
          onSelect={onSelect}
          onAdd={() => onNewChannel(cat.id)}
        />
      ))}
      {(containers[keyFor(null)] || []).length > 0 && (
        <CategoryGroup
          title="Channels"
          icon={null}
          containerKey={keyFor(null)}
          ids={containers[keyFor(null)] || []}
          chById={chById}
          scope={scope}
          collapsed={false}
          onSelect={onSelect}
          onAdd={() => onNewChannel(null)}
        />
      )}
      <DragOverlay>
        {active && (
          <div className="flex items-center gap-2 px-2 py-1 rounded text-sm bg-sidebar-active text-white shadow-lg">
            {active.isPrivate ? <Lock size={15} /> : <Icon name={active.icon} size={15} />}
            <span>{active.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function CategoryGroup({
  title,
  icon,
  containerKey,
  ids,
  chById,
  scope,
  collapsed,
  onToggle,
  onSelect,
  onAdd,
}: {
  title: string;
  icon: string | null;
  containerKey: string;
  ids: number[];
  chById: Map<number, Channel>;
  scope: string | null;
  collapsed: boolean;
  onToggle?: () => void;
  onSelect: (s: string) => void;
  onAdd: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: containerKey });
  return (
    <div className="mb-5 group/cat">
      <div className="flex items-center h-7 px-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-[11px] font-semibold uppercase tracking-wider opacity-60 hover:opacity-100"
        >
          {onToggle && (collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />)}
          {icon && <Icon name={icon} size={13} />}
          <span className="truncate">{title}</span>
        </button>
        <button onClick={onAdd} title="Add channel here" className="hidden group-hover/cat:block opacity-60 hover:opacity-100">
          <Plus size={14} />
        </button>
      </div>
      <div ref={setNodeRef} className="min-h-[4px] space-y-0.5">
        {!collapsed && (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {ids.map((id) => {
              const c = chById.get(id);
              if (!c) return null;
              return <SortableChannel key={id} c={c} active={scope === `channel:${id}`} onSelect={onSelect} />;
            })}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function SortableChannel({
  c,
  active,
  onSelect,
}: {
  c: Channel;
  active: boolean;
  onSelect: (s: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(`channel:${c.id}`)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: active ? "var(--sidebar-active)" : undefined,
        color: active || c.unread ? "#fff" : "var(--sidebar-fg)",
        fontWeight: c.unread ? 600 : 400,
        touchAction: "none",
      }}
      className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm text-left"
    >
      {c.isPrivate ? <Lock size={15} /> : <Icon name={c.icon} size={15} />}
      <span className="truncate flex-1">{c.name}</span>
      {c.isPromoted && <Star size={11} className="opacity-60" />}
      {c.hasMention && <span className="w-2 h-2 rounded-full bg-danger" />}
      {!!c.unread && !active && (
        <span className="bg-danger text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">{c.unread}</span>
      )}
    </button>
  );
}
