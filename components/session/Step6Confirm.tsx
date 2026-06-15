"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, Save, Loader2, AlertCircle } from "lucide-react";
import BalanceChain from "@/components/session/BalanceChain";
import Badge from "@/components/common/Badge";
import { computeBalance } from "@/lib/balance";
import { collectDraftIssues, entryTotal } from "@/lib/sessionDraft";
import { formatWon } from "@/lib/format";
import type { StepProps } from "@/components/session/SessionForm";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

export default function Step6Confirm({
  draft,
  dispatch,
  categories,
  autoCarryOver,
  types,
}: StepProps) {
  const router = useRouter();
  const [editingCarry, setEditingCarry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 잔액 요약 — entry.amount = 상세합
  const summary = useMemo(
    () =>
      computeBalance(
        draft.entries.map((e) => ({
          kind: e.kind,
          amount: entryTotal(e),
          cross_session_id: e.cross_session_id,
        })),
        draft.carry_over,
      ),
    [draft.entries, draft.carry_over],
  );

  const usesNumber = Boolean(
    types.find((t) => t.code === draft.type)?.uses_number,
  );
  const issues = useMemo(
    () => collectDraftIssues(draft, categories, usesNumber),
    [draft, categories, usesNumber],
  );
  const canSave = issues.length === 0 && !saving;

  function setManualCarry(value: number) {
    dispatch({
      type: "patch",
      patch: { carry_over: value, is_manual_carry_over: true },
    });
  }
  function revertCarry() {
    dispatch({
      type: "patch",
      patch: { carry_over: autoCarryOver, is_manual_carry_over: false },
    });
    setEditingCarry(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as
        | { status: "ok"; id: string }
        | { status: "error"; error: string };
      if (data.status === "ok") {
        router.push(`/sessions/${data.id}`);
        return; // 이동 중 — 로딩 유지
      }
      setError(data.error);
      setSaving(false);
    } catch {
      setError("저장 중 오류가 발생했습니다. 네트워크를 확인하세요.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">확인 · 저장</h2>

      {/* 잔액 흐름 */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">잔액 흐름</h3>
        <BalanceChain summary={summary} />
      </section>

      {/* 이월금 */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">이월금</h3>
          {draft.is_manual_carry_over ? (
            <Badge color="amber">수동 보정</Badge>
          ) : (
            <Badge color="gray">자동</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-100 p-4">
          {draft.is_manual_carry_over || editingCarry ? (
            <input
              type="number"
              autoFocus
              value={draft.carry_over}
              onChange={(e) => setManualCarry(Number(e.target.value) || 0)}
              className={`${INPUT_CLS} max-w-xs text-right tabular-nums`}
            />
          ) : (
            <span className="flex-1 text-lg font-bold tabular-nums text-balance">
              {formatWon(draft.carry_over)}
            </span>
          )}

          {draft.is_manual_carry_over ? (
            <button
              type="button"
              onClick={revertCarry}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition-colors hover:border-primary hover:text-primary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              자동(직전 회차 잔액)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditingCarry(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition-colors hover:border-primary hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
              수동 보정
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">
          기본값은 직전 회차의 총잔액입니다. 저장 후 이후 회차 이월금이 자동
          재계산됩니다.
        </p>
      </section>

      {/* 총무·회장 최종 확인 */}
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            총무
          </span>
          <input
            value={draft.treasurer}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { treasurer: e.target.value } })
            }
            className={INPUT_CLS}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            회장
          </span>
          <input
            value={draft.chairperson}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { chairperson: e.target.value } })
            }
            className={INPUT_CLS}
          />
        </label>
      </section>

      {/* 검증 이슈 */}
      {issues.length > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-cross">
            <AlertCircle className="h-4 w-4" />
            저장 전 확인이 필요합니다
          </p>
          <ul className="ml-1 list-inside list-disc text-sm text-gray-600">
            {issues.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-expense">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* 저장 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          일지 저장
        </button>
      </div>
    </div>
  );
}
