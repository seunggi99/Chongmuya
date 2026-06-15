"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { sessionTitle } from "@/lib/sessionLabel";
import type { Session } from "@/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 행사가 해당 날짜(dayStr)에 걸치는지 (ISO 문자열 비교) */
function covers(s: Session, dayStr: string): boolean {
  const end = s.date_end || s.date_start;
  return s.date_start <= dayStr && dayStr <= end;
}

/**
 * 가벼운 월간 달력 (라이브러리 없이 순수 날짜 계산).
 * planned=예정(회색), completed=완료(파랑). 행사 클릭 시 이동.
 */
export default function EventCalendar({
  sessions,
  today,
  onPickDate,
}: {
  sessions: Session[];
  today: string; // YYYY-MM-DD
  onPickDate: (date: string) => void;
}) {
  const [t] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m };
  });
  const [view, setView] = useState<{ y: number; m: number }>(t);

  const firstWeekday = new Date(view.y, view.m - 1, 1).getDay();
  const daysInMonth = new Date(view.y, view.m, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    setView((v) => {
      const total = v.y * 12 + (v.m - 1) + delta;
      return { y: Math.floor(total / 12), m: (total % 12) + 1 };
    });
  }

  return (
    <div className="rounded-xl border border-gray-100">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-lg font-bold">
          {view.y}년 {view.m}월
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="이전 달"
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView(t)}
            className="rounded-md px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="다음 달"
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 border-b border-gray-100 text-center text-xs">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={[
              "py-2 font-medium",
              i === 0 ? "text-expense" : i === 6 ? "text-primary" : "text-gray-400",
            ].join(" ")}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (d === null) {
            return <div key={i} className="min-h-20 border-b border-r border-gray-50" />;
          }
          const dayStr = ymd(view.y, view.m, d);
          const isToday = dayStr === today;
          const dayEvents = sessions.filter((s) => covers(s, dayStr));
          const weekday = i % 7;
          return (
            <div
              key={i}
              onClick={() => onPickDate(dayStr)}
              className="min-h-20 cursor-pointer border-b border-r border-gray-50 p-1.5 transition-colors hover:bg-gray-50/60"
            >
              <span
                className={[
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs",
                  isToday
                    ? "bg-primary font-semibold text-white"
                    : weekday === 0
                      ? "text-expense"
                      : weekday === 6
                        ? "text-primary"
                        : "text-gray-600",
                ].join(" ")}
              >
                {d}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.map((s) => {
                  const completed = s.status === "completed";
                  const href = completed
                    ? `/sessions/${s.id}`
                    : `/sessions/new?event=${s.id}`;
                  return (
                    <Link
                      key={s.id}
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      title={sessionTitle(s)}
                      className={[
                        "block truncate rounded px-1 py-0.5 text-[11px] font-medium",
                        completed
                          ? "bg-light text-primary"
                          : "bg-gray-100 text-gray-500",
                      ].join(" ")}
                    >
                      {sessionTitle(s)}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 px-4 py-2.5 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gray-100" /> 예정 (일지 미작성)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-light" /> 완료 (일지 작성됨)
        </span>
      </div>
    </div>
  );
}
