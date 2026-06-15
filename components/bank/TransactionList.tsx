"use client";

import { useState } from "react";
import { Split, Plus } from "lucide-react";
import Badge from "@/components/common/Badge";
import { formatDate, formatKRW } from "@/lib/format";
import type { BankTransaction } from "@/types";

export default function TransactionList({
  transactions,
  onInput,
  onSplit,
}: {
  transactions: BankTransaction[];
  /** "입력" — 단일 entry 로 반영 (다음 단계 G에서 연결) */
  onInput?: (tx: BankTransaction) => void;
  /** "분할" — SplitModal 호출 (다음 단계 F에서 연결) */
  onSplit?: (tx: BankTransaction) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
        가져온 거래가 없습니다. 파일을 업로드하세요.
      </div>
    );
  }

  const selectableCount = transactions.filter((t) => !t.is_used).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-sm text-gray-500">
        <span>
          총 {transactions.length}건
          {selectableCount < transactions.length &&
            ` · 반영됨 ${transactions.length - selectableCount}건`}
        </span>
        {selected.size > 0 && (
          <span className="font-medium text-primary">{selected.size}건 선택</span>
        )}
      </div>

      <ul className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-100">
        {transactions.map((tx) => {
          const income = tx.amount >= 0;
          const used = tx.is_used;
          return (
            <li
              key={tx.id}
              className={[
                "flex items-center gap-3 px-4 py-3",
                used ? "bg-gray-50/60" : "",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={selected.has(tx.id)}
                disabled={used}
                onChange={() => toggle(tx.id)}
                className="h-4 w-4 shrink-0 accent-[#2563EB] disabled:opacity-40"
                aria-label="거래 선택"
              />

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate text-sm text-gray-800">
                    {tx.description || "(적요 없음)"}
                  </span>
                  {used && <Badge color="gray">반영됨</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {formatDate(tx.tx_date)}
                  {tx.bank ? ` · ${tx.bank}` : ""}
                </p>
              </div>

              <span
                className={[
                  "tabular shrink-0 text-sm font-semibold",
                  income ? "text-income" : "text-expense",
                ].join(" ")}
              >
                {income ? "+" : "-"}
                {formatKRW(Math.abs(tx.amount))}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onInput?.(tx)}
                  disabled={used}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                  입력
                </button>
                <button
                  type="button"
                  onClick={() => onSplit?.(tx)}
                  disabled={used}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:border-cross hover:text-cross disabled:opacity-40"
                >
                  <Split className="h-3 w-3" />
                  분할
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
