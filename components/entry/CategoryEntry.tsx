"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Paperclip, Loader2, X, Users } from "lucide-react";
import MemberChips from "@/components/entry/MemberChips";
import Badge from "@/components/common/Badge";
import { formatWon } from "@/lib/format";
import {
  emptyDetail,
  entryTotal,
  isMemberLinked,
} from "@/lib/sessionDraft";
import type { Category, EntryDetailDraft, EntryDraft, Member } from "@/types";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";
const NUM_CLS =
  "w-32 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-primary";

/** 영수증 파일 업로드 → public URL */
async function uploadReceipt(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/receipt", { method: "POST", body: fd });
  const data = (await res.json()) as { status?: string; url?: string; error?: string };
  if (!res.ok || data.status !== "ok" || !data.url) {
    throw new Error(data.error ?? "영수증 업로드에 실패했습니다.");
  }
  return data.url;
}

export default function CategoryEntry({
  entry,
  categories,
  attendees,
  allMembers,
  feePerPerson,
  defaultDueAmount,
  allowReceipts = false,
  onChange,
  onRemove,
}: {
  entry: EntryDraft;
  /** entry.kind 에 해당하는 활성 분류 */
  categories: Category[];
  /** 당일회비 후보 (참석자) */
  attendees: Member[];
  /** 찬조/연회비 후보 (전회원) */
  allMembers: Member[];
  feePerPerson: number;
  defaultDueAmount: number;
  allowReceipts?: boolean;
  onChange: (entry: EntryDraft) => void;
  onRemove: () => void;
}) {
  const category = categories.find((c) => c.id === entry.category_id) ?? null;
  const memberLinked = isMemberLinked(category);
  const total = entryTotal(entry);

  function update(patch: Partial<EntryDraft>) {
    onChange({ ...entry, ...patch });
  }

  // ── 분류 변경: 회원연동 여부가 바뀌면 details/member_ids 초기화 ──
  function changeCategory(id: string) {
    const next = categories.find((c) => c.id === id) ?? null;
    const nextLinked = isMemberLinked(next);
    if (nextLinked) {
      update({ category_id: id, member_ids: [], details: [] });
    } else {
      // 회원연동 → 일반으로 바뀌면 빈 상세 1줄
      const details = entry.details.length > 0 && !memberLinked
        ? entry.details
        : [emptyDetail()];
      update({ category_id: id, member_ids: [], details });
    }
  }

  // ── 회원연동: 회원 토글 (member_ids[i] ↔ details[i] 정렬 유지) ──
  function defaultMemberAmount(): number {
    if (category?.special === "daily_fee") return feePerPerson;
    if (category?.special === "annual_dues") return defaultDueAmount;
    return 0; // donation
  }

  function toggleMember(member: Member) {
    const idx = entry.member_ids.indexOf(member.id);
    if (idx >= 0) {
      update({
        member_ids: entry.member_ids.filter((_, i) => i !== idx),
        details: entry.details.filter((_, i) => i !== idx),
      });
    } else {
      update({
        member_ids: [...entry.member_ids, member.id],
        details: [
          ...entry.details,
          emptyDetail({ label: member.name, amount: defaultMemberAmount() }),
        ],
      });
    }
  }

  function setMemberAmount(index: number, amount: number) {
    update({
      details: entry.details.map((d, i) =>
        i === index ? { ...d, amount } : d,
      ),
    });
  }

  // ── 일반 분류: 상세 add/remove/edit ──
  function addDetail() {
    update({ details: [...entry.details, emptyDetail()] });
  }
  function removeDetail(uid: string) {
    const left = entry.details.filter((d) => d.uid !== uid);
    update({ details: left.length > 0 ? left : [emptyDetail()] });
  }
  function setDetail(uid: string, patch: Partial<EntryDetailDraft>) {
    update({
      details: entry.details.map((d) => (d.uid === uid ? { ...d, ...patch } : d)),
    });
  }

  const memberPool = category?.special === "daily_fee" ? attendees : allMembers;

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 p-4">
      {/* 분류 선택 + 삭제 */}
      <div className="flex items-center gap-2">
        <select
          value={entry.category_id ?? ""}
          onChange={(e) => changeCategory(e.target.value)}
          className={`${INPUT_CLS} flex-1`}
        >
          <option value="" disabled>
            분류 선택
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {category?.special === "annual_dues" && (
          <Badge color="amber">연회비 기록</Badge>
        )}
        {memberLinked && category?.special !== "annual_dues" && (
          <Badge color="blue">
            <Users className="h-3 w-3" />
            회원
          </Badge>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="분류 삭제"
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-expense"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 본문: 회원연동 vs 일반 상세 */}
      {!entry.category_id ? (
        <p className="text-xs text-gray-400">먼저 분류를 선택하세요.</p>
      ) : memberLinked ? (
        <MemberLinkedBody
          pool={memberPool}
          entry={entry}
          allMembers={allMembers}
          isDailyFee={category?.special === "daily_fee"}
          onToggle={toggleMember}
          onAmount={setMemberAmount}
        />
      ) : (
        <NormalDetails
          entry={entry}
          allowReceipts={allowReceipts}
          onAdd={addDetail}
          onRemove={removeDetail}
          onSet={setDetail}
        />
      )}

      {/* 소계 */}
      <div className="flex justify-end border-t border-gray-50 pt-2 text-sm">
        <span className="text-gray-500">
          소계 <b className="ml-1 text-gray-900">{formatWon(total)}</b>
        </span>
      </div>
    </div>
  );
}

// ─── 회원연동 분류 본문 (당일회비/찬조/연회비) ───────────────
function MemberLinkedBody({
  pool,
  entry,
  allMembers,
  isDailyFee,
  onToggle,
  onAmount,
}: {
  pool: Member[];
  entry: EntryDraft;
  allMembers: Member[];
  isDailyFee: boolean;
  onToggle: (member: Member) => void;
  onAmount: (index: number, amount: number) => void;
}) {
  const byId = new Map(allMembers.map((m) => [m.id, m] as const));
  return (
    <div className="space-y-3">
      <MemberChips
        pool={pool}
        selectedIds={entry.member_ids}
        onToggle={(id) => {
          const m = byId.get(id);
          if (m) onToggle(m);
        }}
        emptyHint={
          isDailyFee
            ? "먼저 참석자를 선택하세요 (Step2)."
            : "선택할 회원이 없습니다."
        }
      />

      {entry.member_ids.length > 0 && (
        <ul className="space-y-1.5">
          {entry.member_ids.map((id, i) => {
            const m = byId.get(id);
            const detail = entry.details[i];
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm text-gray-700">
                  {m?.name ?? "(알 수 없음)"}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={detail?.amount ?? 0}
                  onChange={(e) => onAmount(i, Number(e.target.value) || 0)}
                  className={NUM_CLS}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── 일반 분류 상세항목 (label + amount + 영수증) ────────────
function NormalDetails({
  entry,
  allowReceipts,
  onAdd,
  onRemove,
  onSet,
}: {
  entry: EntryDraft;
  allowReceipts: boolean;
  onAdd: () => void;
  onRemove: (uid: string) => void;
  onSet: (uid: string, patch: Partial<EntryDetailDraft>) => void;
}) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {entry.details.map((d) => (
          <li key={d.uid} className="flex items-start gap-2">
            <input
              value={d.label}
              onChange={(e) => onSet(d.uid, { label: e.target.value })}
              placeholder="상세 항목 (예: 황태덕장)"
              className={`${INPUT_CLS} flex-1`}
            />
            <input
              type="number"
              min={0}
              step={1000}
              value={d.amount}
              onChange={(e) =>
                onSet(d.uid, { amount: Number(e.target.value) || 0 })
              }
              placeholder="금액"
              className={NUM_CLS}
            />
            {allowReceipts && (
              <ReceiptButton
                url={d.receipt_url ?? null}
                onUploaded={(url) => onSet(d.uid, { receipt_url: url })}
                onClear={() => onSet(d.uid, { receipt_url: null })}
              />
            )}
            <button
              type="button"
              onClick={() => onRemove(d.uid)}
              aria-label="상세 삭제"
              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-expense"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-3 w-3" />
        상세 추가
      </button>
    </div>
  );
}

// ─── 영수증 첨부 버튼 (Supabase Storage 업로드) ──────────────
function ReceiptButton({
  url,
  onUploaded,
  onClear,
}: {
  url: string | null;
  onUploaded: (url: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const u = await uploadReceipt(file);
      onUploaded(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {url ? (
        <button
          type="button"
          onClick={onClear}
          title="영수증 첨부됨 — 클릭 시 제거"
          className="inline-flex items-center gap-1 rounded-lg border border-income px-2 py-2 text-xs text-income transition-colors hover:bg-green-50"
        >
          <Paperclip className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title={error ?? "영수증 첨부"}
          className={[
            "inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors",
            error
              ? "border-expense text-expense"
              : "border-gray-200 text-gray-500 hover:border-primary hover:text-primary",
          ].join(" ")}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
