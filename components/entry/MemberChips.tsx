"use client";

import { Check } from "lucide-react";
import type { Member } from "@/types";

/**
 * 회원 칩 선택. 당일회비는 참석자만, 찬조/연회비는 전회원을
 * pool 로 넘겨 사용한다. 선택은 selectedIds 로 제어.
 */
export default function MemberChips({
  pool,
  selectedIds,
  onToggle,
  emptyHint = "선택할 회원이 없습니다.",
}: {
  pool: Member[];
  selectedIds: string[];
  onToggle: (memberId: string) => void;
  emptyHint?: string;
}) {
  const selected = new Set(selectedIds);

  if (pool.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {pool.map((m) => {
        const on = selected.has(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggle(m.id)}
            className={[
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors",
              on
                ? "border-primary bg-light font-semibold text-primary"
                : "border-gray-200 text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {on && <Check className="h-3 w-3" />}
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
