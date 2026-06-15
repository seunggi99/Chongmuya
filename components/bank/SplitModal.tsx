"use client";

import { useMemo, useState } from "react";
import { X, Plus, Split, AlertCircle } from "lucide-react";
import CategoryEntry from "@/components/entry/CategoryEntry";
import { formatDate, formatWon } from "@/lib/format";
import {
  emptyDetail,
  emptyEntry,
  entriesTotal,
} from "@/lib/sessionDraft";
import type {
  BankTransaction,
  Category,
  EntryDraft,
  Member,
} from "@/types";

export type SplitMode = "single" | "split";

/**
 * 은행 거래 1건을 entry(들)로 변환.
 *  - single: 한 분류로 입력
 *  - split: 여러 분류로 분할
 * 분할 합계 = 원본 금액(절대값) 이어야 저장 가능 (불일치 시 차단).
 */
export default function SplitModal({
  tx,
  mode,
  categories,
  attendees,
  allMembers,
  feePerPerson,
  defaultDueAmount,
  onClose,
  onConfirm,
}: {
  tx: BankTransaction | null; // null = 닫힘
  mode: SplitMode;
  categories: Category[]; // 활성 분류 (수입·지출 전체)
  attendees: Member[];
  allMembers: Member[];
  feePerPerson: number;
  defaultDueAmount: number;
  onClose: () => void;
  onConfirm: (entries: EntryDraft[]) => void;
}) {
  const kind = tx && tx.amount < 0 ? "expense" : "income";
  const target = tx ? Math.abs(tx.amount) : 0;

  const kindCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  );

  // tx.id + mode 를 key 로 받아 remount 되므로, 초기 행은 lazy init 으로 1회 세팅.
  const [rows, setRows] = useState<EntryDraft[]>(() =>
    tx
      ? [
          emptyEntry(kind, {
            bank_tx_id: tx.id,
            details: [emptyDetail({ label: tx.description, amount: target })],
          }),
        ]
      : [],
  );

  if (!tx) return null;
  const txId = tx.id;

  const sum = entriesTotal(rows);
  const diff = target - sum;
  const allHaveCategory = rows.every((r) => r.category_id);
  const canConfirm = diff === 0 && allHaveCategory && rows.length > 0;

  function updateRow(uid: string, entry: EntryDraft) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? entry : r)));
  }
  function removeRow(uid: string) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.uid !== uid) : prev,
    );
  }
  function addRow() {
    // 남은 금액을 새 행 기본값으로
    const remain = Math.max(0, diff);
    setRows((prev) => [
      ...prev,
      emptyEntry(kind, {
        bank_tx_id: txId,
        details: [emptyDetail({ amount: remain })],
      }),
    ]);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "split" ? "거래 분할" : "거래 입력"}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              {mode === "split" && <Split className="h-4 w-4 text-cross" />}
              {mode === "split" ? "거래 분할" : "거래 입력"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {formatDate(tx.tx_date)} · {tx.description || "(적요 없음)"}
            </p>
            <p className="mt-0.5 text-sm">
              <span className="text-gray-500">원본 금액</span>{" "}
              <b className={kind === "income" ? "text-income" : "text-expense"}>
                {kind === "income" ? "+" : "-"}
                {formatWon(target)}
              </b>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {rows.map((row) => (
            <CategoryEntry
              key={row.uid}
              entry={row}
              categories={kindCategories}
              attendees={attendees}
              allMembers={allMembers}
              feePerPerson={feePerPerson}
              defaultDueAmount={defaultDueAmount}
              onChange={(e) => updateRow(row.uid, e)}
              onRemove={() => removeRow(row.uid)}
            />
          ))}

          {mode === "split" && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-cross hover:text-cross"
            >
              <Plus className="h-4 w-4" />
              분할 행 추가
            </button>
          )}
        </div>

        {/* 푸터: 합계 검증 */}
        <div className="space-y-3 border-t border-gray-100 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              입력 합계 {formatWon(sum)} / 원본 {formatWon(target)}
            </span>
            {diff === 0 ? (
              <span className="font-semibold text-income">일치</span>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-expense">
                <AlertCircle className="h-4 w-4" />
                {diff > 0 ? `${formatWon(diff)} 부족` : `${formatWon(-diff)} 초과`}
              </span>
            )}
          </div>

          {!allHaveCategory && (
            <p className="text-xs text-expense">
              모든 행의 분류를 선택하세요.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => onConfirm(rows)}
              disabled={!canConfirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              반영
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
