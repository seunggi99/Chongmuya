"use client";

import { useReducer, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type {
  BankTransaction,
  Category,
  EntryDraft,
  GoodsDonationDraft,
  Member,
  Session,
  SessionDraft,
  SessionTypeRow,
} from "@/types";
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
  | { type: "addEntry"; entry: EntryDraft }
  | { type: "updateEntry"; uid: string; entry: EntryDraft }
  | { type: "removeEntry"; uid: string }
  | { type: "setGoods"; goods: GoodsDonationDraft[] }
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
    case "addEntry":
      return { ...state, entries: [...state.entries, action.entry] };
    case "updateEntry":
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.uid === action.uid ? action.entry : e,
        ),
      };
    case "removeEntry":
      return {
        ...state,
        entries: state.entries.filter((e) => e.uid !== action.uid),
      };
    case "setGoods":
      return { ...state, goods_donations: action.goods };
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
  /** 활성 회원 전체 (가나다순) */
  members: Member[];
  /** 활성 분류 전체 (수입·지출) */
  categories: Category[];
  /** 연회비 기본 금액 */
  defaultDueAmount: number;
  /** 업로드된 은행 거래 (수입·지출 공유) */
  bankTxs: BankTransaction[];
  setBankTxs: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
  /** Supabase 연결 여부 (은행 가져오기 가용) */
  configured: boolean;
  /** 기존 회차 목록 (교차 귀속회차 선택용) */
  sessions: Session[];
  /** 직전 회차 총잔액 = 자동 이월금 (수동 보정 되돌리기용) */
  autoCarryOver: number;
  /** 올해 연회비 납부완료 회원 id (연회비 선택 목록에서 제외) */
  paidDuesMemberIds: string[];
  /** 행사 유형 목록 (유형 select·uses_number·라벨) */
  types: SessionTypeRow[];
}

const STEPS = [
  { id: 1, label: "기본정보" },
  { id: 2, label: "참석자" },
  { id: 3, label: "수입" },
  { id: 4, label: "지출" },
  { id: 5, label: "선입금·선지급" },
  { id: 6, label: "확인" },
] as const;

function initDraft(p: {
  nextNumber: number;
  defaultChairperson: string;
  defaultTreasurer: string;
  carryOver: number;
  today: string;
  event: Session | null;
}): SessionDraft {
  const ev = p.event;
  return {
    eventSessionId: ev?.id ?? null,
    // 행사가 있으면 기본정보 자동 채움 (회차번호 없으면 다음 번호 제안)
    number: ev?.number ?? p.nextNumber,
    name: ev?.name ?? "",
    type: ev?.type ?? "hike",
    location: ev?.location ?? "",
    date_start: ev?.date_start ?? p.today,
    isMultiDay: Boolean(ev?.date_end),
    date_end: ev?.date_end ?? null,
    fee_per_person: ev?.fee_per_person ?? 0,
    note: ev?.note ?? "",
    chairperson: ev?.chairperson || p.defaultChairperson,
    treasurer: ev?.treasurer || p.defaultTreasurer,
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
  categories,
  defaultDueAmount,
  configured,
  sessions,
  paidDuesMemberIds,
  types,
  event = null,
}: {
  nextNumber: number;
  defaultChairperson: string;
  defaultTreasurer: string;
  carryOver: number;
  today: string;
  members: Member[];
  categories: Category[];
  defaultDueAmount: number;
  configured: boolean;
  sessions: Session[];
  paidDuesMemberIds: string[];
  types: SessionTypeRow[];
  /** 채워 넣을 planned 행사 (없으면 새 일지) */
  event?: Session | null;
}) {
  const [draft, dispatch] = useReducer(
    draftReducer,
    { nextNumber, defaultChairperson, defaultTreasurer, carryOver, today, event },
    initDraft,
  );
  const [step, setStep] = useState(1);
  const [bankTxs, setBankTxs] = useState<BankTransaction[]>([]);

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

  const stepProps: StepProps = {
    draft,
    dispatch,
    members,
    categories,
    defaultDueAmount,
    bankTxs,
    setBankTxs,
    configured,
    sessions,
    autoCarryOver: carryOver,
    paidDuesMemberIds,
    types,
  };

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
          // 마지막 단계의 저장 버튼은 Step6Confirm 내부에서 제공
          <span className="text-xs text-gray-400">아래에서 저장하세요</span>
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
