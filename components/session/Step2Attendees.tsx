"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { formatWon } from "@/lib/format";
import type { MemberType } from "@/types";
import type { StepProps } from "@/components/session/SessionForm";

const TABS: { type: MemberType; label: string }[] = [
  { type: "member", label: "회원" },
  { type: "general", label: "일반회원" },
];

export default function Step2Attendees({ draft, dispatch, members }: StepProps) {
  const [tab, setTab] = useState<MemberType>("member");

  const selected = useMemo(
    () => new Set(draft.attendee_ids),
    [draft.attendee_ids],
  );

  const byType = useMemo(
    () => members.filter((m) => m.type === tab),
    [members, tab],
  );

  // 선택 인원 집계
  const selectedMembers = members.filter((m) => selected.has(m.id));
  const memberCount = selectedMembers.filter((m) => m.type === "member").length;
  const generalCount = selectedMembers.filter(
    (m) => m.type === "general",
  ).length;
  const dailyFee = draft.fee_per_person * memberCount;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">참석자</h2>
        <span className="text-sm text-gray-500">
          총 {selected.size}명 선택
        </span>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 text-sm">
        {TABS.map((t) => {
          const count = members.filter(
            (m) => m.type === t.type && selected.has(m.id),
          ).length;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => setTab(t.type)}
              className={[
                "rounded-lg border px-3 py-1.5 transition-colors",
                tab === t.type
                  ? "border-primary bg-light font-semibold text-primary"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 text-xs text-primary">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 회원 칩 목록 */}
      {byType.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          {tab === "member" ? "등록된 회원" : "등록된 일반회원"}이 없습니다.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {byType.map((m) => {
            const on = selected.has(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "toggleAttendee", memberId: m.id })
                  }
                  className={[
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    on
                      ? "border-primary bg-light font-semibold text-primary"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      on
                        ? "border-primary bg-primary text-white"
                        : "border-gray-300",
                    ].join(" ")}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{m.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 집계 + 당일회비 자동 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm">
        <span className="text-gray-600">
          회원 <b className="text-gray-900">{memberCount}</b>명 · 일반회원{" "}
          <b className="text-gray-900">{generalCount}</b>명
        </span>
        <span className="text-gray-600">
          당일회비{" "}
          <span className="text-xs text-gray-400">
            ({formatWon(draft.fee_per_person)} × 회원 {memberCount})
          </span>{" "}
          <b className="text-income">{formatWon(dailyFee)}</b>
        </span>
      </div>
    </div>
  );
}
