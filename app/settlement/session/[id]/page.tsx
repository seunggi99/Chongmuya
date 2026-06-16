import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import PdfDownloadButton from "@/components/settlement/PdfDownloadButton";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionSettlement } from "@/lib/settlement";
import { formatDateRange, formatWon } from "@/lib/format";
import type { SessionSettlementRow, SessionSettlementView } from "@/types";

export const dynamic = "force-dynamic";

function SideTable({
  title,
  rows,
  total,
  tone,
}: {
  title: string;
  rows: SessionSettlementRow[];
  total: number;
  tone: "income" | "expense";
}) {
  const toneText = tone === "income" ? "text-income" : "text-expense";
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <div className={`px-4 py-2.5 text-sm font-bold ${toneText}`}>{title}</div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-50 border-t border-gray-100">
          {rows.length > 0 ? (
            rows.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-2.5 text-gray-700">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatWon(r.amount)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                내역 없음
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-100 bg-gray-50/60">
            <td className="px-4 py-2.5 font-semibold">합계</td>
            <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${toneText}`}>
              {formatWon(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default async function SessionSettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">회차 결산</h1>
        </header>
        <SetupNotice />
      </div>
    );
  }

  let data: SessionSettlementView | null = null;
  let loadError: string | null = null;
  try {
    data = await getSessionSettlement(id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "결산을 불러오지 못했습니다.";
  }
  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {loadError}
      </div>
    );
  }
  if (!data) notFound();

  const s = data.session;

  return (
    <div className="space-y-6">
      <Link
        href="/settlement"
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        연간 결산
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-400">
            {s.typeName} · 회차 결산
          </p>
          <h1 className="mt-0.5 text-2xl font-bold">{s.shortLabel}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {s.location} · {formatDateRange(s.date_start, s.date_end)}
          </p>
        </div>
        <PdfDownloadButton
          url={`/api/export/settlement-session/${s.id}`}
          filename={`정산서_${s.shortLabel.replace(/\s+/g, "")}.pdf`}
          label="정산서 PDF"
        />
      </div>

      <p className="flex items-start gap-1.5 rounded-lg bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        결산 뷰입니다. 이 회차에 <b className="mx-0.5">귀속</b>된 수입·지출만 보여주며
        (선입금/선지급은 귀속회차로 집계), 일지(통장 잔액)와 다를 수 있습니다.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <SideTable title="수입" rows={data.income} total={data.totalIncome} tone="income" />
        <SideTable title="지출" rows={data.expense} total={data.totalExpense} tone="expense" />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-light/40 px-5 py-4">
        <span className="font-semibold text-gray-700">결산 잔액 (수입 − 지출)</span>
        <span className="text-xl font-bold tabular-nums text-balance">
          {formatWon(data.balance)}
        </span>
      </div>
    </div>
  );
}
