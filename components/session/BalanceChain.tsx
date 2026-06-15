"use client";

import { formatWon } from "@/lib/format";
import type { BalanceSummary } from "@/types";

/**
 * 잔액 흐름 표시 (claude.md 잔액 계산 공식).
 *   당일수입 - 당일지출 = 당일잔액
 *   + 교차수입 - 교차지출 + 이월금 = 총잔액
 */
export default function BalanceChain({ summary }: { summary: BalanceSummary }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-gray-100 p-4">
      <Row label="당일 수입" value={summary.dailyIncome} tone="income" />
      <Row label="당일 지출" value={summary.dailyExpense} tone="expense" minus />
      <Divider />
      <Row label="당일 잔액" value={summary.dailyBalance} tone="plain" strong />
      <Row label="선입금 (다른 회차)" value={summary.crossIncome} tone="cross" />
      <Row
        label="선지급 (다른 회차)"
        value={summary.crossExpense}
        tone="cross"
        minus
      />
      <Row label="이월금" value={summary.carryOver} tone="balance" />
      <Divider />
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-bold text-gray-900">총 잔액</span>
        <span className="text-lg font-bold text-balance tabular-nums">
          {formatWon(summary.total)}
        </span>
      </div>
    </div>
  );
}

type Tone = "income" | "expense" | "cross" | "balance" | "plain";

const TONE_CLS: Record<Tone, string> = {
  income: "text-income",
  expense: "text-expense",
  cross: "text-cross",
  balance: "text-balance",
  plain: "text-gray-900",
};

function Row({
  label,
  value,
  tone,
  minus = false,
  strong = false,
}: {
  label: string;
  value: number;
  tone: Tone;
  minus?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-semibold text-gray-700" : "text-gray-500"}>
        {label}
      </span>
      <span
        className={[
          "tabular-nums",
          strong ? "font-bold" : "font-medium",
          TONE_CLS[tone],
        ].join(" ")}
      >
        {minus && value !== 0 ? "-" : ""}
        {formatWon(value)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-dashed border-gray-100" />;
}
