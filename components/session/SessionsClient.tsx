"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import Badge, { type BadgeColor } from "@/components/common/Badge";
import { sessionShortLabel } from "@/lib/sessionLabel";
import { formatDateRange, formatWon } from "@/lib/format";
import {
  SESSION_TYPE_LABEL,
  type SessionSummary,
  type SessionType,
} from "@/types";

const SELECT_CLS =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary";

/** 유형별 배지색 */
const TYPE_BADGE: Record<SessionType, BadgeColor> = {
  hike: "blue",
  general_meeting: "purple",
  regular_meeting: "gray",
  sansanje: "green",
  travel: "amber",
  flash: "red",
};

type StatusFilter = "all" | "completed" | "planned";

export default function SessionsClient({
  summaries,
}: {
  summaries: SessionSummary[];
}) {
  const [year, setYear] = useState("all");
  const [type, setType] = useState<"all" | SessionType>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const years = useMemo(() => {
    const set = new Set(summaries.map((s) => s.session.date_start.slice(0, 4)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [summaries]);

  const filtered = useMemo(
    () =>
      summaries.filter(({ session }) => {
        if (year !== "all" && session.date_start.slice(0, 4) !== year) return false;
        if (type !== "all" && session.type !== type) return false;
        if (status !== "all" && session.status !== status) return false;
        return true;
      }),
    [summaries, year, type, status],
  );

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={SELECT_CLS}
          aria-label="연도 필터"
        >
          <option value="all">전체 연도</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "all" | SessionType)}
          className={SELECT_CLS}
          aria-label="유형 필터"
        >
          <option value="all">전체 유형</option>
          {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map((t) => (
            <option key={t} value={t}>
              {SESSION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={SELECT_CLS}
          aria-label="상태 필터"
        >
          <option value="all">전체 상태</option>
          <option value="completed">완료</option>
          <option value="planned">예정</option>
        </select>
        <span className="ml-auto self-center text-sm text-gray-400">
          {filtered.length}건
        </span>
      </div>

      {/* 카드 리스트 */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          조건에 맞는 회차가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(({ session: s, attendeeCount, total }) => {
            const planned = s.status === "planned";
            const href = planned
              ? `/sessions/new?event=${s.id}`
              : `/sessions/${s.id}`;
            return (
              <li key={s.id}>
                <Link
                  href={href}
                  className={[
                    "flex items-center gap-4 rounded-xl border border-gray-100 px-5 py-4 transition-colors hover:border-primary hover:bg-light/30",
                    planned ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {sessionShortLabel(s)}
                      </span>
                      <Badge color={TYPE_BADGE[s.type]}>
                        {SESSION_TYPE_LABEL[s.type]}
                      </Badge>
                      {planned && <Badge color="gray">예정</Badge>}
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-600">
                      {s.location}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                      <span>{formatDateRange(s.date_start, s.date_end)}</span>
                      {!planned && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {attendeeCount}명
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {planned ? (
                      <span className="text-xs text-gray-400">일지 미작성</span>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400">총잔액</p>
                        <p className="font-bold tabular-nums text-balance">
                          {formatWon(total)}
                        </p>
                      </>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
