"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveClubInfoAction } from "@/app/settings/actions";
import type { ClubSettings } from "@/types";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

export default function ClubInfoCard({
  initial,
}: {
  initial: ClubSettings;
}) {
  const [clubName, setClubName] = useState(initial.club_name);
  const [chair, setChair] = useState(initial.default_chairperson ?? "");
  const [treasurer, setTreasurer] = useState(initial.default_treasurer ?? "");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { type: "ok" | "error"; msg: string } | null
  >(null);

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveClubInfoAction({
        club_name: clubName,
        default_chairperson: chair || null,
        default_treasurer: treasurer || null,
      });
      if (res.ok) {
        setFeedback({ type: "ok", msg: "저장되었습니다." });
      } else {
        setFeedback({ type: "error", msg: res.error });
      }
    });
  }

  return (
    <section className="rounded-xl border border-gray-100 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold">모임 기본정보</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          일지 작성 시 회장·총무 기본값으로 사용됩니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="모임 이름" className="sm:col-span-2">
          <input
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            placeholder="예) 한마음 산악회"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="회장 기본값">
          <input
            value={chair}
            onChange={(e) => setChair(e.target.value)}
            placeholder="회장 이름"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="총무 기본값">
          <input
            value={treasurer}
            onChange={(e) => setTreasurer(e.target.value)}
            placeholder="총무 이름"
            className={INPUT_CLS}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          저장
        </button>
        {feedback && (
          <span
            className={
              feedback.type === "ok"
                ? "text-sm text-income"
                : "text-sm text-expense"
            }
          >
            {feedback.msg}
          </span>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>
      {children}
    </label>
  );
}
