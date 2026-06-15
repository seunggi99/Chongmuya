"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/common/Modal";
import { recordDueAction, type DuesYearData } from "@/app/dues/actions";
import { DEFAULT_DUE_AMOUNT } from "@/lib/constants";
import type { Member } from "@/types";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function RecordDueModal({
  open,
  onClose,
  members,
  defaultYear,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  defaultYear: string;
  onRecorded: (yearLabel: string, data: DuesYearData) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [yearLabel, setYearLabel] = useState(defaultYear);
  const [amount, setAmount] = useState(DEFAULT_DUE_AMOUNT);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    if (pending) return;
    setError(null);
    onClose();
  }

  function handleSubmit() {
    if (!memberId) {
      setError("회원을 선택하세요.");
      return;
    }
    if (!yearLabel.trim()) {
      setError("연도를 입력하세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await recordDueAction({
        memberId,
        yearLabel: yearLabel.trim(),
        amount,
        paidAt,
      });
      if (res.ok) {
        onRecorded(yearLabel.trim(), res.data);
        setMemberId("");
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="연회비 납부 등록">
      <div className="space-y-3">
        <Field label="회원">
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">회원 선택</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="연도">
            <input
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              placeholder="26~27"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="금액(원)">
            <input
              type="number"
              value={amount}
              min={0}
              step={1000}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className={`${INPUT_CLS} tabular`}
            />
          </Field>
        </div>

        <Field label="납부일">
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={INPUT_CLS}
          />
        </Field>

        {error && <p className="text-sm text-expense">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            등록
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>
      {children}
    </label>
  );
}
