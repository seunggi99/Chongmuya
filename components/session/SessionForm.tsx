"use client";

import { useReducer, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { Member, SessionDraft } from "@/types";
import Step1BasicInfo from "@/components/session/Step1BasicInfo";
import Step2Attendees from "@/components/session/Step2Attendees";
import Step3Income from "@/components/session/Step3Income";
import Step4Expense from "@/components/session/Step4Expense";
import Step5Cross from "@/components/session/Step5Cross";
import Step6Confirm from "@/components/session/Step6Confirm";

// ─── 폼 상태 reducer ────────────────────────────────────────
export type DraftAction =
  | { type: "patch"; patch: Partial<SessionDraft> }
  | { type: "toggleAttendee"; memberId: string }
  | { type: "setAttendees"; ids: string[] }
  | { type: "reset"; draft: SessionDraft };

function draftReducer(state: SessionDraft, action: DraftAction): SessionDraft {
  switch (action.type) {
    case "patch": {
      const next = { ...state, ...action.patch };
      // 다박 해제 시 종료일 정리
      if (action.patch.isMultiDay === false) next.date_end = null;
      return next;
    }
    case "toggleAttendee": {
      const has = state.attendee_ids.includes(action.memberId);
      return {
        ...state,
        attendee_ids: has
          ? state.attendee_ids.filter((id) => id !== action.memberId)
          : [...state.attendee_ids, action.memberId],
      };
    }
    case "setAttendees":
      return { ...state, attendee_ids: action.ids };
    case "reset":
      return action.draft;
    default:
      return state;
  }
}

/** Step 컴포넌트 공통 props */
export interface StepProps {
  draft: SessionDraft;
  dispatch: React.Dispatch<DraftAction>;
  members: Member[];
}

const STEPS = [
  { id: 1, label: "기본정보" },
  { id: 2, label: "참석자" },
  { id: 3, label: "수입" },
  { id: 4, label: "지출" },
  { id: 5, label: "교차·연회비" },
  { id: 6, label: "확인" },
] as const;

function initDraft(p: {
  nextNumber: number;
  defaultChairperson: string;
  defaultTreasurer: string;
  carryOver: number;
  today: string;
}): SessionDraft {
  return {
    number: p.nextNumber,
    type: "hike",
    location: "",
    date_start: p.today,
    isMultiDay: false,
    date_end: null,
    fee_per_person: 0,
    note: "",
    chairperson: p.defaultChairperson,
    treasurer: p.defaultTreasurer,
    carry_over: p.carryOver,
    is_manual_carry_over: false,
    attendee_ids: [],
    entries: [],
    goods_donations: [],
  };
}

export default function SessionForm({
  nextNumber,
  defaultChairperson,
  defaultTreasurer,
  carryOver,
  today,
  members,
}: {
  nextNumber: number;
  defaultChairperson: string;
  defaultTreasurer: string;
  carryOver: number;
  today: string;
  members: Member[];
}) {
  const [draft, dispatch] = useReducer(
    draftReducer,
    { nextNumber, defaultChairperson, defaultTreasurer, carryOver, today },
    initDraft,
  );
  const [step, setStep] = useState(1);

  // Step1 진행 조건: 장소·시작일 필수, 다박이면 종료일 필수
  const step1Ready =
    draft.location.trim() !== "" &&
    draft.date_start !== "" &&
    (!draft.isMultiDay || !!draft.date_end);
  const canNext = step === 1 ? step1Ready : true;

  function goPrev() {
    setStep((s) => Math.max(1, s - 1));
  }
  function goNext() {
    if (!canNext) return;
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  const stepProps: StepProps = { draft, dispatch, members };

  return (
    <div className="space-y-6">
      <Stepper current={step} onJump={setStep} />

      <div className="rounded-xl border border-gray-100 p-5">
        {step === 1 && <Step1BasicInfo {...stepProps} />}
        {step === 2 && <Step2Attendees {...stepProps} />}
        {step === 3 && <Step3Income {...stepProps} />}
        {step === 4 && <Step4Expense {...stepProps} />}
        {step === 5 && <Step5Cross {...stepProps} />}
        {step === 6 && <Step6Confirm {...stepProps} />}
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 1}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </button>

        {step < STEPS.length ? (
          <div className="flex flex-col items-end gap-1">
            {!canNext && (
              <span className="text-xs text-gray-400">
                장소·시작일{draft.isMultiDay ? "·종료일" : ""}을 입력하세요.
              </span>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled
            title="저장 기능은 다음 단계에서 구현됩니다."
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white opacity-40"
          >
            <Check className="h-4 w-4" />
            저장 (예정)
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 상단 스텝 표시 ─────────────────────────────────────────
function Stepper({
  current,
  onJump,
}: {
  current: number;
  onJump: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {STEPS.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        // 이미 지난 단계(완료)는 클릭해 되돌아갈 수 있음
        const clickable = s.id <= current;
        return (
          <li key={s.id} className="flex items-center">
            <button
              type="button"
              onClick={() => clickable && onJump(s.id)}
              disabled={!clickable}
              className="flex items-center gap-2"
            >
              <span
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : done
                      ? "bg-light text-primary"
                      : "bg-gray-100 text-gray-400",
                ].join(" ")}
              >
                {done ? <Check className="h-4 w-4" /> : s.id}
              </span>
              <span
                className={[
                  "text-sm",
                  active
                    ? "font-semibold text-gray-900"
                    : done
                      ? "text-primary"
                      : "text-gray-400",
                ].join(" ")}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="mx-2 h-px w-5 shrink-0 bg-gray-200 sm:w-8" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
