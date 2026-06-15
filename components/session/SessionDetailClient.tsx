"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Loader2 } from "lucide-react";
import SessionPreview from "@/components/session/SessionPreview";
import ExportButtons from "@/components/common/ExportButtons";
import { deleteSessionAction } from "@/app/sessions/[id]/actions";
import { SESSION_TYPE_LABEL, type SessionDetailView } from "@/types";
import { formatDateRange, formatWon } from "@/lib/format";
import { sessionShortLabel } from "@/lib/sessionLabel";

export default function SessionDetailClient({
  data,
  id,
  fileBase,
}: {
  data: SessionDetailView;
  id: string;
  fileBase: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { session: s, balance } = data;

  function handleDelete() {
    if (!confirm(`${sessionShortLabel(s)} 일지를 삭제할까요? 되돌릴 수 없습니다.`))
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSessionAction(id);
      if (res.ok) {
        router.push("/sessions");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        회차 목록
      </Link>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* 좌: 정보 + 액션 */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-400">
              {SESSION_TYPE_LABEL[s.type]}
            </p>
            <h1 className="mt-0.5 text-xl font-bold">{sessionShortLabel(s)}</h1>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="장소" value={s.location} />
              <Row
                label="일자"
                value={formatDateRange(s.date_start, s.date_end)}
              />
              <Row
                label="당일회비"
                value={
                  s.fee_per_person > 0
                    ? `1인 ${formatWon(s.fee_per_person)}`
                    : "—"
                }
              />
              <Row label="총무" value={s.treasurer || "—"} />
              <Row label="회장" value={s.chairperson || "—"} />
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <span className="text-sm text-gray-500">총 잔액</span>
              <span className="text-lg font-bold tabular-nums text-balance">
                {formatWon(balance.total)}
              </span>
            </div>
          </div>

          {/* 내보내기 */}
          <div className="rounded-xl border border-gray-100 p-5">
            <p className="mb-2 text-sm font-semibold text-gray-700">내보내기</p>
            <ExportButtons sessionId={id} fileBase={fileBase} />
          </div>

          {/* 수정 / 삭제 */}
          <div className="flex gap-2">
            <Link
              href={`/sessions/${id}/edit`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
              수정
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-expense hover:text-expense disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              삭제
            </button>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-expense">
              {error}
            </p>
          )}
        </aside>

        {/* 우: 미리보기 */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <SessionPreview data={data} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}
