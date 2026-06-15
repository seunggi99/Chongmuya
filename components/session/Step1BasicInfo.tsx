"use client";

import { SESSION_TYPE_LABEL, type SessionType } from "@/types";
import { diffNights } from "@/lib/format";
import type { StepProps } from "@/components/session/SessionForm";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

const SESSION_TYPES = Object.keys(SESSION_TYPE_LABEL) as SessionType[];

/** "YYYY-MM-DD" → 로컬 자정 Date (타임존 밀림 방지) */
function toDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export default function Step1BasicInfo({ draft, dispatch }: StepProps) {
  // 다박 기간 라벨 (N박 M일)
  const start = toDate(draft.date_start);
  const end = draft.date_end ? toDate(draft.date_end) : null;
  const nights = start && end ? diffNights(start, end) : 0;
  const rangeInvalid = Boolean(start && end && end.getTime() < start.getTime());

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">기본정보</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 회차번호 */}
        <Field label="회차번호" hint="직전 회차 +1 자동 제안">
          <input
            type="number"
            min={1}
            value={draft.number}
            onChange={(e) =>
              dispatch({
                type: "patch",
                patch: { number: Number(e.target.value) || 0 },
              })
            }
            className={INPUT_CLS}
          />
        </Field>

        {/* 모임 유형 */}
        <Field label="모임 유형">
          <select
            value={draft.type}
            onChange={(e) =>
              dispatch({
                type: "patch",
                patch: { type: e.target.value as SessionType },
              })
            }
            className={INPUT_CLS}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SESSION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* 행사명 */}
      <Field label="행사명" hint="비우면 유형으로 표시">
        <input
          value={draft.name}
          onChange={(e) =>
            dispatch({ type: "patch", patch: { name: e.target.value } })
          }
          placeholder="예) 가을 정기산행"
          className={INPUT_CLS}
        />
      </Field>

      {/* 장소 */}
      <Field label="장소" required>
        <input
          value={draft.location}
          onChange={(e) =>
            dispatch({ type: "patch", patch: { location: e.target.value } })
          }
          placeholder="예) 설악산 대청봉"
          className={INPUT_CLS}
        />
      </Field>

      {/* 날짜 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="시작일" required>
          <input
            type="date"
            value={draft.date_start}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { date_start: e.target.value } })
            }
            className={INPUT_CLS}
          />
        </Field>

        <div>
          <label className="flex cursor-pointer items-center gap-2 pt-7 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.isMultiDay}
              onChange={(e) =>
                dispatch({
                  type: "patch",
                  patch: { isMultiDay: e.target.checked },
                })
              }
              className="h-4 w-4 accent-[#2563EB]"
            />
            다박 (1박 이상)
          </label>
        </div>
      </div>

      {draft.isMultiDay && (
        <Field label="종료일" required>
          <input
            type="date"
            value={draft.date_end ?? ""}
            min={draft.date_start || undefined}
            onChange={(e) =>
              dispatch({
                type: "patch",
                patch: { date_end: e.target.value || null },
              })
            }
            className={INPUT_CLS}
          />
          {rangeInvalid ? (
            <p className="mt-1 text-xs text-expense">
              종료일이 시작일보다 빠릅니다.
            </p>
          ) : nights > 0 ? (
            <p className="mt-1 text-xs text-primary">
              {nights}박 {nights + 1}일
            </p>
          ) : null}
        </Field>
      )}

      {/* 당일회비 단가 */}
      <Field label="당일회비 단가" hint="1인당 금액 (원). 참석자 수와 곱해 자동 계산">
        <input
          type="number"
          min={0}
          step={1000}
          value={draft.fee_per_person}
          onChange={(e) =>
            dispatch({
              type: "patch",
              patch: { fee_per_person: Number(e.target.value) || 0 },
            })
          }
          className={INPUT_CLS}
        />
      </Field>

      {/* 메모 */}
      <Field label="메모">
        <textarea
          value={draft.note}
          onChange={(e) =>
            dispatch({ type: "patch", patch: { note: e.target.value } })
          }
          rows={2}
          placeholder="비고 (선택)"
          className={`${INPUT_CLS} resize-none`}
        />
      </Field>

      {/* 총무·회장 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="총무" hint="설정 기본값 자동 채움">
          <input
            value={draft.treasurer}
            onChange={(e) =>
              dispatch({ type: "patch", patch: { treasurer: e.target.value } })
            }
            className={INPUT_CLS}
          />
        </Field>
        <Field label="회장" hint="설정 기본값 자동 채움">
          <input
            value={draft.chairperson}
            onChange={(e) =>
              dispatch({
                type: "patch",
                patch: { chairperson: e.target.value },
              })
            }
            className={INPUT_CLS}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-expense">*</span>}
        {hint && (
          <span className="ml-1.5 font-normal text-xs text-gray-400">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
