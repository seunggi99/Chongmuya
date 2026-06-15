"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/common/Modal";
import { createEventAction } from "@/app/events/actions";
import { SESSION_TYPE_LABEL, type SessionType, type Session } from "@/types";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

const TYPES = Object.keys(SESSION_TYPE_LABEL) as SessionType[];

export default function AddEventModal({
  open,
  onClose,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** 달력 날짜 클릭으로 열렸을 때 기본 시작일 */
  defaultDate?: string;
  onCreated: (sessions: Session[]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SessionType>("hike");
  const [location, setLocation] = useState("");
  const [dateStart, setDateStart] = useState(defaultDate ?? "");
  const [dateEnd, setDateEnd] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setType("hike");
    setLocation("");
    setDateStart(defaultDate ?? "");
    setDateEnd("");
    setMultiDay(false);
    setNumber("");
    setError(null);
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!location.trim()) {
      setError("장소를 입력하세요.");
      return;
    }
    if (!dateStart) {
      setError("일자를 입력하세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createEventAction({
        name: name.trim() || null,
        type,
        location,
        date_start: dateStart,
        date_end: multiDay && dateEnd ? dateEnd : null,
        number: number.trim() ? Number(number) : null,
      });
      if (res.ok) {
        onCreated(res.data);
        reset();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="행사 등록">
      <div className="space-y-3">
        <Field label="행사명" hint="비우면 유형으로 표시">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 정기 산행"
            className={INPUT_CLS}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="유형">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SessionType)}
              className={INPUT_CLS}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {SESSION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="회차번호" hint="선택">
            <input
              type="number"
              min={1}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="미정"
              className={INPUT_CLS}
            />
          </Field>
        </div>

        <Field label="장소">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="예) 설악산"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="시작일">
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className={INPUT_CLS}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={multiDay}
            onChange={(e) => setMultiDay(e.target.checked)}
            className="h-4 w-4 accent-[#2563EB]"
          />
          다박 (종료일 지정)
        </label>
        {multiDay && (
          <Field label="종료일">
            <input
              type="date"
              value={dateEnd}
              min={dateStart || undefined}
              onChange={(e) => setDateEnd(e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
        )}

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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {hint && (
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
