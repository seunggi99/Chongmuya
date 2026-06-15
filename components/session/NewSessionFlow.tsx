"use client";

import { useState } from "react";
import { CalendarCheck, FilePlus2, ArrowLeft, CalendarDays } from "lucide-react";
import SessionForm from "@/components/session/SessionForm";
import { formatDateRange } from "@/lib/format";
import { SESSION_TYPE_LABEL, type Category, type Member, type Session } from "@/types";

interface FormProps {
  nextNumber: number;
  defaultChairperson: string;
  defaultTreasurer: string;
  carryOver: number;
  today: string;
  members: Member[];
  categories: Category[];
  defaultDueAmount: number;
  configured: boolean;
  sessions: Session[];
  paidDuesMemberIds: string[];
}

type Selection =
  | { mode: "choosing" }
  | { mode: "event"; event: Session }
  | { mode: "fresh" };

/**
 * 새 일지 흐름:
 *  1) planned 행사를 선택해 기본정보 자동 채움 → 그 행사에 일지 작성
 *  2) 또는 "행사 없이 바로 작성"
 */
export default function NewSessionFlow({
  plannedSessions,
  initialEventId,
  formProps,
}: {
  plannedSessions: Session[];
  initialEventId: string | null;
  formProps: FormProps;
}) {
  const [selection, setSelection] = useState<Selection>(() => {
    if (initialEventId) {
      const ev = plannedSessions.find((s) => s.id === initialEventId);
      if (ev) return { mode: "event", event: ev };
    }
    return { mode: "choosing" };
  });

  function eventTitle(s: Session): string {
    const base = s.name?.trim() || SESSION_TYPE_LABEL[s.type];
    return s.number != null ? `${s.number}차 ${base}` : base;
  }

  if (selection.mode === "choosing") {
    return (
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-gray-800">예정 행사에 작성</h2>
          </div>
          {plannedSessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
              일지 미작성 행사가 없습니다. 행사 일정에서 먼저 등록하거나, 아래에서
              바로 작성하세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {plannedSessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelection({ mode: "event", event: s })}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-light/40"
                  >
                    <CalendarDays className="h-5 w-5 shrink-0 text-gray-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {eventTitle(s)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {formatDateRange(s.date_start, s.date_end)} · {s.location}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setSelection({ mode: "fresh" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
          >
            <FilePlus2 className="h-4 w-4" />
            행사 없이 바로 작성
          </button>
        </div>
      </div>
    );
  }

  const event = selection.mode === "event" ? selection.event : null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setSelection({ mode: "choosing" })}
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        행사 다시 선택
      </button>
      {event && (
        <div className="flex items-center gap-2 rounded-lg bg-light px-3 py-2 text-sm text-primary">
          <CalendarCheck className="h-4 w-4" />
          <span className="font-medium">{eventTitle(event)}</span>
          <span className="text-primary/70">
            에 일지를 작성합니다 (저장 시 완료 처리)
          </span>
        </div>
      )}
      <SessionForm {...formProps} event={event} />
    </div>
  );
}
