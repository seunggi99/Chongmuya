/**
 * 잔액 계산 (entry 기반)
 *
 *  당일수입 = SUM(income  & cross_session_id IS NULL)
 *  당일지출 = SUM(expense & cross_session_id IS NULL)
 *  당일잔액 = 당일수입 - 당일지출
 *  교차수입 = SUM(income  & cross_session_id IS NOT NULL)
 *  교차지출 = SUM(expense & cross_session_id IS NOT NULL)
 *  총잔액  = 당일잔액 + 교차수입 - 교차지출 + 이월금
 *
 *  ※ entry.amount 는 항상 entry_details 합과 일치해야 한다(저장 시 검증).
 *  ※ 물품찬조(goods_donations)는 금액 계산에 미포함.
 */
import type { BalanceSummary, Entry, EntryDetail } from "@/types";

/** 잔액 계산 입력에 필요한 entry 최소 형태 */
type BalanceEntry = Pick<Entry, "kind" | "amount" | "cross_session_id">;

export function computeBalance(
  entries: BalanceEntry[],
  carryOver: number,
): BalanceSummary {
  let dailyIncome = 0;
  let dailyExpense = 0;
  let crossIncome = 0;
  let crossExpense = 0;

  for (const e of entries) {
    const isCross = e.cross_session_id != null;
    if (e.kind === "income") {
      if (isCross) crossIncome += e.amount;
      else dailyIncome += e.amount;
    } else {
      if (isCross) crossExpense += e.amount;
      else dailyExpense += e.amount;
    }
  }

  const dailyBalance = dailyIncome - dailyExpense;
  const total = dailyBalance + crossIncome - crossExpense + carryOver;

  return {
    dailyIncome,
    dailyExpense,
    dailyBalance,
    crossIncome,
    crossExpense,
    carryOver,
    total,
  };
}

/** 총잔액만 필요할 때 (= computeBalance(...).total) */
export function calculateTotalBalance(
  entries: BalanceEntry[],
  carryOver: number,
): number {
  return computeBalance(entries, carryOver).total;
}

/**
 * entry_details 합계. entry 저장 시 amount 와 비교 검증에 사용.
 */
export function sumDetails(details: Pick<EntryDetail, "amount">[]): number {
  return details.reduce((acc, d) => acc + d.amount, 0);
}

/**
 * entry.amount === Σ(entry_details.amount) 검증.
 * - detail 은 최소 1개 필수 (detail 0개는 합=0 으로 검증 실패).
 */
export function validateEntryDetails(
  amount: number,
  details: Pick<EntryDetail, "amount">[],
): { ok: boolean; sum: number; reason?: string } {
  if (details.length === 0) {
    return { ok: false, sum: 0, reason: "상세항목이 최소 1개 필요합니다." };
  }
  const sum = sumDetails(details);
  if (sum !== amount) {
    return {
      ok: false,
      sum,
      reason: `상세항목 합계(${sum.toLocaleString("ko-KR")})가 분류 금액(${amount.toLocaleString("ko-KR")})과 일치하지 않습니다.`,
    };
  }
  return { ok: true, sum };
}

/**
 * 분할 입력 검증: 분할 항목 합계 === 원본 거래 금액.
 */
export function validateSplit(
  originalAmount: number,
  parts: { amount: number }[],
): { ok: boolean; sum: number; reason?: string } {
  const sum = parts.reduce((acc, p) => acc + p.amount, 0);
  if (sum !== originalAmount) {
    return {
      ok: false,
      sum,
      reason: `분할 합계(${sum.toLocaleString("ko-KR")})가 원본 금액(${originalAmount.toLocaleString("ko-KR")})과 일치하지 않습니다.`,
    };
  }
  return { ok: true, sum };
}

/**
 * 회차들의 이월금 연쇄 재계산.
 * **시간순(date_start)** 으로 정렬한 회차 목록과 각 회차의 entries 를 받아,
 * is_manual_carry_over=true 인 회차는 그 값을 기준으로 사용하고,
 * 나머지는 직전 회차의 총잔액을 carry_over 로 채운다.
 * (산행만 number 가 있으므로 number 가 아니라 날짜 기준으로 연쇄한다.
 *  같은 날짜면 number 오름차순 → 둘 다 없으면 입력 순서.)
 *
 * @returns 각 회차 id → { carryOver, total } 재계산 결과
 */
export function recalcCarryOverChain(
  sessions: {
    id: string;
    number: number | null;
    date_start: string;
    carry_over: number;
    is_manual_carry_over: boolean;
    entries: BalanceEntry[];
  }[],
): Map<string, { carryOver: number; total: number }> {
  const ordered = [...sessions].sort((a, b) => {
    if (a.date_start !== b.date_start) return a.date_start < b.date_start ? -1 : 1;
    return (a.number ?? 0) - (b.number ?? 0);
  });
  const result = new Map<string, { carryOver: number; total: number }>();

  let prevTotal: number | null = null;
  for (const s of ordered) {
    const carryOver =
      s.is_manual_carry_over || prevTotal === null ? s.carry_over : prevTotal;
    const { total } = computeBalance(s.entries, carryOver);
    result.set(s.id, { carryOver, total });
    prevTotal = total;
  }
  return result;
}
