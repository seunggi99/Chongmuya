"use client";

import { useMemo } from "react";
import { Plus, ArrowRightLeft } from "lucide-react";
import CategoryEntry from "@/components/entry/CategoryEntry";
import { formatWon } from "@/lib/format";
import {
  annualDuesExcludedMemberIds,
  emptyEntry,
  entriesTotal,
} from "@/lib/sessionDraft";
import { sessionPickerLabel } from "@/lib/sessionLabel";
import type {
  Category,
  EntryDraft,
  EntryKind,
  Member,
  Session,
  SessionDraft,
} from "@/types";
import type { StepProps } from "@/components/session/SessionForm";

export default function Step5Cross({
  draft,
  dispatch,
  members,
  categories,
  defaultDueAmount,
  sessions,
  paidDuesMemberIds,
}: StepProps) {
  const attendees = useMemo(
    () => members.filter((m) => draft.attendee_ids.includes(m.id)),
    [members, draft.attendee_ids],
  );

  function addCross(kind: EntryKind) {
    dispatch({ type: "addEntry", entry: emptyEntry(kind, { isCross: true }) });
  }

  const crossOf = (kind: EntryKind) =>
    draft.entries.filter((e) => e.isCross && e.kind === kind);

  // 귀속회차 후보: 작성 중인 본인 행사는 제외 (planned/completed 모두 포함)
  const pickerSessions = sessions.filter((s) => s.id !== draft.eventSessionId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-1.5 text-lg font-bold">
          <ArrowRightLeft className="h-4 w-4 text-cross" />
          교차 항목
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          이번 회차 통장에서 오갔지만 <b>다른 회차에 귀속</b>되는 선입금·선지급을
          입력합니다. 결산은 귀속회차의 원래 분류로 집계됩니다. (연회비는
          Step3에서 입력)
        </p>
      </div>

      <CrossSection
        title="교차 수입 (선입금)"
        kind="income"
        entries={crossOf("income")}
        sessions={pickerSessions}
        attendees={attendees}
        members={members}
        categories={categories}
        draft={draft}
        paidDuesMemberIds={paidDuesMemberIds}
        feePerPerson={draft.fee_per_person}
        defaultDueAmount={defaultDueAmount}
        onAdd={() => addCross("income")}
        onChange={(uid, entry) => dispatch({ type: "updateEntry", uid, entry })}
        onRemove={(uid) => dispatch({ type: "removeEntry", uid })}
      />

      <CrossSection
        title="교차 지출 (선지급)"
        kind="expense"
        entries={crossOf("expense")}
        sessions={pickerSessions}
        attendees={attendees}
        members={members}
        categories={categories}
        draft={draft}
        paidDuesMemberIds={paidDuesMemberIds}
        feePerPerson={draft.fee_per_person}
        defaultDueAmount={defaultDueAmount}
        onAdd={() => addCross("expense")}
        onChange={(uid, entry) => dispatch({ type: "updateEntry", uid, entry })}
        onRemove={(uid) => dispatch({ type: "removeEntry", uid })}
      />
    </div>
  );
}

function CrossSection({
  title,
  kind,
  entries,
  sessions,
  attendees,
  members,
  categories,
  draft,
  paidDuesMemberIds,
  feePerPerson,
  defaultDueAmount,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string;
  kind: EntryKind;
  entries: EntryDraft[];
  sessions: Session[];
  attendees: Member[];
  members: Member[];
  categories: Category[];
  draft: SessionDraft;
  paidDuesMemberIds: string[];
  feePerPerson: number;
  defaultDueAmount: number;
  onAdd: () => void;
  onChange: (uid: string, entry: EntryDraft) => void;
  onRemove: (uid: string) => void;
}) {
  const kindCategories = categories.filter((c) => c.kind === kind);
  const total = entriesTotal(entries);
  const tone = kind === "income" ? "text-income" : "text-expense";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-sm text-gray-500">
          합계 <b className={tone}>{formatWon(total)}</b>
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
          교차 항목이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.uid}
              className="space-y-3 rounded-xl border border-cross/30 bg-amber-50/30 p-3"
            >
              {/* 귀속회차 */}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-cross">
                  귀속회차
                </span>
                <select
                  value={entry.cross_session_id ?? ""}
                  onChange={(e) =>
                    onChange(entry.uid, {
                      ...entry,
                      cross_session_id: e.target.value || null,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">귀속회차 선택</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sessionPickerLabel(s)}
                    </option>
                  ))}
                </select>
                {sessions.length === 0 && (
                  <span className="mt-1 block text-xs text-gray-400">
                    선택 가능한 기존 회차가 없습니다. 귀속회차가 먼저 저장되어
                    있어야 합니다.
                  </span>
                )}
              </label>

              <CategoryEntry
                entry={entry}
                categories={kindCategories}
                attendees={attendees}
                allMembers={members}
                feePerPerson={feePerPerson}
                defaultDueAmount={defaultDueAmount}
                duesExcludedMemberIds={annualDuesExcludedMemberIds(
                  draft,
                  categories,
                  entry.uid,
                  paidDuesMemberIds,
                )}
                onChange={(e) => onChange(entry.uid, e)}
                onRemove={() => onRemove(entry.uid)}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-cross hover:text-cross"
      >
        <Plus className="h-4 w-4" />
        {kind === "income" ? "선입금 추가" : "선지급 추가"}
      </button>
    </section>
  );
}
