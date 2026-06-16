"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarDays,
  FileDown,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import StatCard from "@/components/common/StatCard";
import Badge from "@/components/common/Badge";
import ExpenseChart from "@/components/settlement/ExpenseChart";
import { formatWon, formatDateRange, formatDate } from "@/lib/format";
import type { SettlementData } from "@/types";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function SettlementClient({ data }: { data: SettlementData }) {
  const router = useRouter();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years =
    data.availableYears.length > 0 ? data.availableYears : [data.year];

  async function exportPdf() {
    setPdfLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/export/settlement?year=${data.year}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "PDF 생성에 실패했습니다.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `결산_${data.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 연도 선택 + PDF */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={data.year}
          onChange={(e) => router.push(`/settlement?year=${e.target.value}`)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          aria-label="연도 선택"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportPdf}
          disabled={pdfLoading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          결산 PDF
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-expense">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* 1) 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="총수입"
          value={formatWon(data.summary.totalIncome)}
          icon={TrendingUp}
          accent="income"
        />
        <StatCard
          label="총지출"
          value={formatWon(data.summary.totalExpense)}
          icon={TrendingDown}
          accent="expense"
        />
        <StatCard
          label="총잔액"
          value={formatWon(data.summary.totalBalance)}
          icon={Wallet}
          accent="balance"
        />
        <StatCard
          label="회차수"
          value={`${data.summary.sessionCount}`}
          unit="회"
          icon={CalendarDays}
          accent="primary"
        />
      </div>

      {/* 2) 회차별 결산 테이블 */}
      <Section
        title="회차별 결산"
        hint="결산 뷰: 교차(선입금/선지급)는 귀속회차로 집계 — 통장 잔액과 다를 수 있습니다."
      >
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">회차</th>
                <th className="px-4 py-3 font-medium">장소</th>
                <th className="px-4 py-3 font-medium">일자</th>
                <th className="px-4 py-3 text-right font-medium">수입</th>
                <th className="px-4 py-3 text-right font-medium">지출</th>
                <th className="px-4 py-3 text-right font-medium">잔액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.shortLabel}</td>
                  <td className="px-4 py-3 text-gray-600">{s.location}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDateRange(s.date_start, s.date_end)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-income">
                    {formatWon(s.income)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-expense">
                    {formatWon(s.expense)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatWon(s.balance)}
                  </td>
                </tr>
              ))}
              {data.sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    이 연도에 작성된 일지가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 3) 분류별 지출 차트 */}
      <Section title="분류별 지출">
        <div className="rounded-xl border border-gray-100 p-4">
          <ExpenseChart data={data.expenseByCategory} />
        </div>
      </Section>

      {/* 4) 연회비 납부 현황 */}
      <Section title="연회비 납부 현황" hint={`기준 ${data.duesYearLabel}`}>
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <ul className="divide-y divide-gray-50">
            {data.dues.map((d) => (
              <li
                key={d.member.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{d.member.name}</span>
                {d.paid ? (
                  <span className="flex items-center gap-2 text-gray-500">
                    {d.paidAt && (
                      <span className="text-xs">{formatDate(d.paidAt)}</span>
                    )}
                    <Badge color="green">
                      <Check className="h-3 w-3" />
                      완납
                    </Badge>
                  </span>
                ) : (
                  <Badge color="gray">미납</Badge>
                )}
              </li>
            ))}
            {data.dues.length === 0 && (
              <li className="px-4 py-8 text-center text-gray-400">
                회원이 없습니다.
              </li>
            )}
          </ul>
        </div>
      </Section>

      {/* 5) 누적 찬조액 */}
      <Section title="찬조 현황" hint="현금 찬조는 가나다순 · 물품 찬조는 비고">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="mb-2 text-sm font-semibold text-gray-700">현금 찬조</p>
            {data.donations.length === 0 ? (
              <p className="text-sm text-gray-400">내역 없음</p>
            ) : (
              <ul className="space-y-1.5">
                {data.donations.map((d) => (
                  <li
                    key={d.name}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-gray-700">{d.name}</span>
                    <span className="font-medium tabular-nums text-income">
                      {formatWon(d.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="mb-2 text-sm font-semibold text-gray-700">물품 찬조</p>
            {data.goods.length === 0 ? (
              <p className="text-sm text-gray-400">내역 없음</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-gray-700">
                {data.goods.map((g, i) => (
                  <li key={i}>
                    {g.donorName ? `${g.donorName} — ` : ""}
                    {g.item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
