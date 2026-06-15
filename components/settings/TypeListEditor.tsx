"use client";

import { useRef, useState, useTransition } from "react";
import { GripVertical, Lock, Trash2, Plus, Loader2, RotateCcw, Info, Hash } from "lucide-react";
import type { BadgeColor } from "@/components/common/Badge";
import {
  addSessionTypeAction,
  updateSessionTypeAction,
  deleteSessionTypeAction,
  reactivateSessionTypeAction,
  reorderSessionTypesAction,
} from "@/app/settings/actions";
import type { SessionTypeRow } from "@/types";

const COLORS: BadgeColor[] = ["blue", "purple", "green", "amber", "red", "gray"];
const SWATCH: Record<BadgeColor, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-gray-400",
};
function asColor(c: string): BadgeColor {
  return (COLORS as string[]).includes(c) ? (c as BadgeColor) : "gray";
}

export default function TypeListEditor({
  initial,
}: {
  initial: SessionTypeRow[];
}) {
  const [list, setList] = useState<SessionTypeRow[]>(initial);
  const [newName, setNewName] = useState("");
  const [newUsesNumber, setNewUsesNumber] = useState(false);
  const [newColor, setNewColor] = useState<BadgeColor>("blue");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dragId = useRef<string | null>(null);
  const orderBeforeDrag = useRef<SessionTypeRow[] | null>(null);

  function run(
    action: () => Promise<{
      ok: boolean;
      data?: SessionTypeRow[];
      error?: string;
    }>,
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok && res.data) setList(res.data);
      else if (!res.ok) setError(res.error ?? "오류가 발생했습니다.");
    });
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    setNewUsesNumber(false);
    setNewColor("blue");
    run(() =>
      addSessionTypeAction({
        name,
        uses_number: newUsesNumber,
        badge_color: newColor,
      }),
    );
  }

  function handleRename(t: SessionTypeRow, value: string) {
    const name = value.trim();
    if (!name || name === t.name) return;
    run(() => updateSessionTypeAction(t.id, { name }));
  }

  function handleColor(t: SessionTypeRow, color: BadgeColor) {
    if (color === t.badge_color) return;
    run(() => updateSessionTypeAction(t.id, { badge_color: color }));
  }

  function handleUsesNumber(t: SessionTypeRow) {
    run(() => updateSessionTypeAction(t.id, { uses_number: !t.uses_number }));
  }

  function handleDelete(t: SessionTypeRow) {
    if (t.is_system) return;
    if (!confirm(`'${t.name}' 유형을 삭제할까요?`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await deleteSessionTypeAction(t.id);
      if (res.ok) {
        setList(res.data.list);
        if (res.data.notice) setNotice(res.data.notice);
      } else {
        setError(res.error);
      }
    });
  }

  function handleReactivate(t: SessionTypeRow) {
    run(() => reactivateSessionTypeAction(t.id));
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
      const from = prev.findIndex((t) => t.id === fromId);
      const to = prev.findIndex((t) => t.id === overId);
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
    if (
      before &&
      before.map((t) => t.id).join() === list.map((t) => t.id).join()
    ) {
      return;
    }
    const orderedIds = list.map((t) => t.id);
    setError(null);
    startTransition(async () => {
      const res = await reorderSessionTypesAction(orderedIds);
      if (res.ok) setList(res.data);
      else {
        setError(res.error);
        if (before) setList(before);
      }
    });
  }

  return (
    <section className="rounded-xl border border-gray-100 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">행사 유형</h3>
        <span className="text-xs text-gray-400">{list.length}개</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        회차번호(uses) 켜면 같은 유형끼리 회차번호가 매겨집니다 (산행 등).
      </p>

      <ul className="space-y-1">
        {list.map((t) => (
          <li
            key={t.id}
            draggable
            onDragStart={() => onDragStart(t.id)}
            onDragOver={(e) => onDragOver(e, t.id)}
            onDragEnd={onDragEnd}
            className={[
              "group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-gray-100 hover:bg-gray-50",
              t.is_active ? "" : "opacity-50",
            ].join(" ")}
          >
            <span
              className="cursor-grab text-gray-300 active:cursor-grabbing"
              aria-label="드래그하여 정렬"
            >
              <GripVertical className="h-4 w-4" />
            </span>

            <input
              defaultValue={t.name}
              onBlur={(e) => handleRename(t, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-gray-200 focus:bg-white"
            />

            {/* 색상 */}
            <div className="flex shrink-0 items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleColor(t, c)}
                  aria-label={`색상 ${c}`}
                  className={[
                    "h-4 w-4 rounded-full transition-transform",
                    SWATCH[c],
                    asColor(t.badge_color) === c
                      ? "ring-2 ring-gray-400 ring-offset-1"
                      : "opacity-60 hover:opacity-100",
                  ].join(" ")}
                />
              ))}
            </div>

            {/* 회차번호 토글 */}
            <button
              type="button"
              onClick={() => handleUsesNumber(t)}
              disabled={pending}
              title="회차번호 부여 여부"
              className={[
                "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                t.uses_number
                  ? "border-primary bg-light text-primary"
                  : "border-gray-200 text-gray-400 hover:bg-gray-50",
              ].join(" ")}
            >
              <Hash className="h-3 w-3" />
              회차
            </button>

            {!t.is_active && (
              <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                비활성
              </span>
            )}

            {t.is_system ? (
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                <Lock className="h-3 w-3" />
                기본
              </span>
            ) : t.is_active ? (
              <button
                type="button"
                onClick={() => handleDelete(t)}
                disabled={pending}
                aria-label={`${t.name} 삭제`}
                className="shrink-0 rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-expense disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleReactivate(t)}
                disabled={pending}
                aria-label={`${t.name} 복구`}
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
            등록된 유형이 없습니다.
          </li>
        )}
      </ul>

      {/* 추가 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="새 유형 이름"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              aria-label={`색상 ${c}`}
              className={[
                "h-5 w-5 rounded-full transition-transform",
                SWATCH[c],
                newColor === c
                  ? "ring-2 ring-gray-400 ring-offset-1"
                  : "opacity-60 hover:opacity-100",
              ].join(" ")}
            />
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={newUsesNumber}
            onChange={(e) => setNewUsesNumber(e.target.checked)}
            className="h-4 w-4 accent-[#2563EB]"
          />
          회차번호
        </label>
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
