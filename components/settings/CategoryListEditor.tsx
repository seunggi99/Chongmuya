"use client";

import { useState, useRef, useTransition } from "react";
import {
  GripVertical,
  Lock,
  Trash2,
  Plus,
  Loader2,
  RotateCcw,
  Info,
} from "lucide-react";
import {
  addCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  reactivateCategoryAction,
  reorderCategoriesAction,
} from "@/app/settings/actions";
import type { Category, CategoryKind } from "@/types";

const KIND_LABEL: Record<CategoryKind, string> = {
  expense: "지출 분류",
  income: "수입 분류",
};

const SPECIAL_LABEL: Record<string, string> = {
  daily_fee: "당일회비",
  donation: "찬조",
  annual_dues: "연회비",
};

export default function CategoryListEditor({
  kind,
  initial,
}: {
  kind: CategoryKind;
  initial: Category[];
}) {
  const [list, setList] = useState<Category[]>(initial);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 드래그 상태
  const dragId = useRef<string | null>(null);
  const orderBeforeDrag = useRef<Category[] | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; data?: Category[]; error?: string }>,
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok && res.data) {
        setList(res.data);
      } else if (!res.ok) {
        setError(res.error ?? "오류가 발생했습니다.");
      }
    });
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    run(() => addCategoryAction(kind, name));
  }

  function handleRename(cat: Category, value: string) {
    const name = value.trim();
    if (!name || name === cat.name) return;
    run(() => renameCategoryAction(cat.id, kind, name));
  }

  function handleDelete(cat: Category) {
    if (cat.is_system) return;
    if (!confirm(`'${cat.name}' 분류를 삭제할까요?`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await deleteCategoryAction(cat.id, kind);
      if (res.ok) {
        setList(res.data.list);
        if (res.data.notice) setNotice(res.data.notice);
      } else {
        setError(res.error);
      }
    });
  }

  function handleReactivate(cat: Category) {
    run(() => reactivateCategoryAction(cat.id, kind));
  }

  // ─── 드래그 정렬 ───
  function onDragStart(id: string) {
    dragId.current = id;
    orderBeforeDrag.current = list;
  }

  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    const fromId = dragId.current;
    if (!fromId || fromId === overId) return;
    setList((prev) => {
      const from = prev.findIndex((c) => c.id === fromId);
      const to = prev.findIndex((c) => c.id === overId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onDragEnd() {
    const moved = dragId.current !== null;
    dragId.current = null;
    if (!moved) return;
    const before = orderBeforeDrag.current;
    orderBeforeDrag.current = null;
    // 순서가 그대로면 저장 생략
    if (before && before.map((c) => c.id).join() === list.map((c) => c.id).join()) {
      return;
    }
    const orderedIds = list.map((c) => c.id);
    setError(null);
    startTransition(async () => {
      const res = await reorderCategoriesAction(kind, orderedIds);
      if (res.ok) {
        setList(res.data);
      } else {
        setError(res.error);
        if (before) setList(before); // 실패 시 원복
      }
    });
  }

  return (
    <section className="rounded-xl border border-gray-100 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">{KIND_LABEL[kind]}</h3>
        <span className="text-xs text-gray-400">{list.length}개</span>
      </div>

      <ul className="space-y-1">
        {list.map((cat) => (
          <li
            key={cat.id}
            draggable
            onDragStart={() => onDragStart(cat.id)}
            onDragOver={(e) => onDragOver(e, cat.id)}
            onDragEnd={onDragEnd}
            className={[
              "group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-gray-100 hover:bg-gray-50",
              cat.is_active ? "" : "opacity-50",
            ].join(" ")}
          >
            <span
              className="cursor-grab text-gray-300 active:cursor-grabbing"
              aria-label="드래그하여 정렬"
            >
              <GripVertical className="h-4 w-4" />
            </span>

            <input
              defaultValue={cat.name}
              onBlur={(e) => handleRename(cat, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-gray-200 focus:bg-white"
            />

            {!cat.is_active && (
              <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                비활성
              </span>
            )}

            {cat.is_system ? (
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                <Lock className="h-3 w-3" />
                {cat.special ? SPECIAL_LABEL[cat.special] ?? "시스템" : "시스템"}
              </span>
            ) : cat.is_active ? (
              <button
                type="button"
                onClick={() => handleDelete(cat)}
                disabled={pending}
                aria-label={`${cat.name} 삭제`}
                className="shrink-0 rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-expense disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleReactivate(cat)}
                disabled={pending}
                aria-label={`${cat.name} 복구`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                복구
              </button>
            )}
          </li>
        ))}
        {list.length === 0 && (
          <li className="px-2 py-3 text-sm text-gray-400">
            등록된 분류가 없습니다.
          </li>
        )}
      </ul>

      {/* 추가 */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="새 분류 이름"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !newName.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          추가
        </button>
      </div>

      {notice && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-expense">{error}</p>}
    </section>
  );
}
