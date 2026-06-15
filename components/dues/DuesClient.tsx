"use client";

import { useState, useTransition } from "react";
import { Plus, Check, X, Loader2 } from "lucide-react";
import RecordDueModal from "@/components/dues/RecordDueModal";
import { formatDate } from "@/lib/format";
import {
  getDuesForYearAction,
  deleteDueAction,
  type DuesYearData,
} from "@/app/dues/actions";
import type { Member } from "@/types";

export default function DuesClient({
  initialYears,
  initialYear,
  initialData,
  members,
}: {
  initialYears: string[];
  initialYear: string;
  initialData: DuesYearData;
  members: Member[];
}) {
  const [years, setYears] = useState<string[]>(initialYears);
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<DuesYearData>(initialData);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectYear(y: string) {
    if (y === year) return;
    setError(null);
    setYear(y);
    startTransition(async () => {
      const res = await getDuesForYearAction(y);
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
  }

  function handleRecorded(yearLabel: string, next: DuesYearData) {
    setYears((prev) =>
      prev.includes(yearLabel)
        ? prev
        : [...prev, yearLabel].sort((a, b) => b.localeCompare(a)),
    );
    setYear(yearLabel);
    setData(next);
  }

  function handleCancel(dueId: string, memberName: string) {
    if (!confirm(`'${memberName}'의 ${year} 연회비 납부를 취소할까요?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDueAction(dueId, year);
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
  }

  const { status, rate } = data;

  return (
    <div className="space-y-4">
      {/* 연도 탭 + 납부율 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => selectYear(y)}
              className={[
                "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
                y === year
                  ? "bg-light font-semibold text-primary"
                  : "text-gray-500 hover:bg-gray-50",
              ].join(" ")}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {pending && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
          <span className="text-sm text-gray-500">
            납부율{" "}
            <span className="font-bold text-primary">{rate.paidCount}</span> /{" "}
            {rate.totalCount}명
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            납부 등록
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-expense">
          {error}
        </p>
      )}

      {/* 회원 그리드 */}
      {status.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          활성 회원이 없습니다.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {status.map((row) => (
            <li
              key={row.member.id}
              className={[
                "group relative rounded-xl border p-3",
                row.paid
                  ? "border-green-100 bg-green-50/40"
                  : "border-gray-100",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                {row.paid ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-income text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                )}
                <span className="truncate font-medium">{row.member.name}</span>
              </div>
              <p className="mt-1 pl-7 text-xs text-gray-400">
                {row.paid && row.paidAt ? formatDate(row.paidAt) : "미납"}
              </p>

              {row.paid && row.dueId && (
                <button
                  type="button"
                  onClick={() => handleCancel(row.dueId!, row.member.name)}
                  disabled={pending}
                  aria-label={`${row.member.name} 납부 취소`}
                  className="absolute right-2 top-2 rounded-md p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-expense group-hover:opacity-100 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <RecordDueModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        members={members}
        defaultYear={year}
        onRecorded={handleRecorded}
      />
    </div>
  );
}
