"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/common/Modal";
import { addMemberAction } from "@/app/members/actions";
import type { Member, MemberType } from "@/types";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AddMemberModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (members: Member[]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MemberType>("member");
  const [phone, setPhone] = useState("");
  const [joinedAt, setJoinedAt] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setType("member");
    setPhone("");
    setJoinedAt(todayISO());
    setError(null);
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("이름을 입력하세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addMemberAction({
        name,
        type,
        phone: phone || null,
        joinedAt: joinedAt || null,
      });
      if (res.ok) {
        onAdded(res.data);
        reset();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="회원 추가">
      <div className="space-y-3">
        <Field label="이름">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="회원 이름"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="등급">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MemberType)}
            className={INPUT_CLS}
          >
            <option value="member">회원</option>
            <option value="general">일반회원</option>
          </select>
        </Field>

        <Field label="전화">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            inputMode="tel"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="가입일">
          <input
            type="date"
            value={joinedAt}
            onChange={(e) => setJoinedAt(e.target.value)}
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
            추가
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
