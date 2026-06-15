"use client";

import { useMemo, useState } from "react";
import { Plus, Landmark, PencilLine } from "lucide-react";
import BankImporter from "@/components/bank/BankImporter";
import TransactionList from "@/components/bank/TransactionList";
import SplitModal, { type SplitMode } from "@/components/bank/SplitModal";
import CategoryEntry from "@/components/entry/CategoryEntry";
import { formatWon } from "@/lib/format";
import { emptyEntry, entriesTotal } from "@/lib/sessionDraft";
import type { BankTransaction, EntryDraft, EntryKind } from "@/types";
import type { StepProps } from "@/components/session/SessionForm";

type InputMode = "bank" | "manual";

/**
 * 수입(Step3)·지출(Step4) 공통 입력 섹션.
 *  - 은행내역 가져오기 또는 직접 입력 토글
 *  - 분류+상세(CategoryEntry), 분할(SplitModal)
 *  - 합계 실시간 표시
 */
export default function EntryStep({
  draft,
  dispatch,
  members,
  categories,
  defaultDueAmount,
  bankTxs,
  setBankTxs,
  configured,
  kind,
  allowReceipts,
}: StepProps & { kind: EntryKind; allowReceipts: boolean }) {
  const [mode, setMode] = useState<InputMode>("bank");
  const [split, setSplit] = useState<{ tx: BankTransaction; mode: SplitMode } | null>(
    null,
  );

  const attendees = useMemo(
    () => members.filter((m) => draft.attendee_ids.includes(m.id)),
    [members, draft.attendee_ids],
  );
  const kindCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  );
  // 당일(비교차) 항목만 — 교차(선입금/선지급)는 Step5에서 관리
  const entries = draft.entries.filter((e) => e.kind === kind && !e.isCross);
  const txForKind = bankTxs.filter((t) =>
    kind === "income" ? t.amount >= 0 : t.amount < 0,
  );
  const total = entriesTotal(entries);

  function onImported(incoming: BankTransaction[]) {
    setBankTxs((prev) => {
      const seen = new Set(prev.map((t) => t.id));
      return [...prev, ...incoming.filter((t) => !seen.has(t.id))];
    });
  }

  function markTx(txId: string, used: boolean) {
    setBankTxs((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, is_used: used } : t)),
    );
  }

  function confirmSplit(newEntries: EntryDraft[]) {
    newEntries.forEach((e) => dispatch({ type: "addEntry", entry: e }));
    const txId = newEntries[0]?.bank_tx_id;
    if (txId) markTx(txId, true);
    setSplit(null);
  }

  function addManual() {
    dispatch({ type: "addEntry", entry: emptyEntry(kind) });
    setMode("manual");
  }

  function removeEntry(entry: EntryDraft) {
    const sharesTx = draft.entries.some(
      (e) => e.uid !== entry.uid && e.bank_tx_id === entry.bank_tx_id,
    );
    dispatch({ type: "removeEntry", uid: entry.uid });
    if (entry.bank_tx_id && !sharesTx) markTx(entry.bank_tx_id, false);
  }

  return (
    <div className="space-y-5">
      {/* 입력 방식 토글 */}
      <div className="flex gap-2 text-sm">
        <ModeBtn active={mode === "bank"} onClick={() => setMode("bank")}>
          <Landmark className="h-4 w-4" />
          은행내역 가져오기
        </ModeBtn>
        <ModeBtn active={mode === "manual"} onClick={() => setMode("manual")}>
          <PencilLine className="h-4 w-4" />
          직접 입력
        </ModeBtn>
      </div>

      {mode === "bank" ? (
        <div className="space-y-4">
          <BankImporter onImported={onImported} configured={configured} />
          {txForKind.length > 0 && (
            <TransactionList
              transactions={txForKind}
              onInput={(tx) => setSplit({ tx, mode: "single" })}
              onSplit={(tx) => setSplit({ tx, mode: "split" })}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={addManual}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          분류 추가
        </button>
      )}

      {/* 입력된 entries */}
      {entries.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            입력된 {kind === "income" ? "수입" : "지출"} {entries.length}건
          </p>
          {entries.map((entry) => (
            <CategoryEntry
              key={entry.uid}
              entry={entry}
              categories={kindCategories}
              attendees={attendees}
              allMembers={members}
              feePerPerson={draft.fee_per_person}
              defaultDueAmount={defaultDueAmount}
              allowReceipts={allowReceipts}
              onChange={(e) => dispatch({ type: "updateEntry", uid: entry.uid, entry: e })}
              onRemove={() => removeEntry(entry)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          아직 입력된 항목이 없습니다.
        </p>
      )}

      {/* 합계 */}
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm">
        <span className="text-gray-600">
          {kind === "income" ? "수입" : "지출"} 합계
        </span>
        <b className={kind === "income" ? "text-income" : "text-expense"}>
          {formatWon(total)}
        </b>
      </div>

      <SplitModal
        key={split ? `${split.tx.id}:${split.mode}` : "closed"}
        tx={split?.tx ?? null}
        mode={split?.mode ?? "single"}
        categories={categories}
        attendees={attendees}
        allMembers={members}
        feePerPerson={draft.fee_per_person}
        defaultDueAmount={defaultDueAmount}
        onClose={() => setSplit(null)}
        onConfirm={confirmSplit}
      />
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-colors",
        active
          ? "border-primary bg-light font-semibold text-primary"
          : "border-gray-200 text-gray-600 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
