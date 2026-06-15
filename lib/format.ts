/**
 * 표시용 포맷 유틸. (DB 는 항상 정수 원, 여기서만 포맷)
 */

/** 1234567 → "1,234,567" (원 단위, 기호 없음) */
export function formatKRW(amount: number): string {
  return Math.trunc(amount).toLocaleString("ko-KR");
}

/** 1234567 → "1,234,567원" */
export function formatWon(amount: number): string {
  return `${formatKRW(amount)}원`;
}

/** 부호 포함 ("+12,000" / "-3,000") — 수입/지출 표시용 */
export function formatSigned(amount: number): string {
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${sign}${formatKRW(Math.abs(amount))}`;
}

/** "YYYY-MM-DD" → "YYYYMMDD" (파일명용) */
export function compactDate(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 8);
}

/** Date | "YYYY-MM-DD" → "YYYY. M. D" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? parseDate(value) : value;
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

/**
 * 회차 기간 표시.
 *  - 당일(end 없음 또는 start===end): "2026. 6. 16"
 *  - 다박: "2026. 6. 16 ~ 6. 18 (2박3일)"
 */
export function formatDateRange(
  start: string | Date | null | undefined,
  end?: string | Date | null,
): string {
  if (!start) return "";
  const s = typeof start === "string" ? parseDate(start) : start;
  if (!s) return "";
  const e = end ? (typeof end === "string" ? parseDate(end) : end) : null;

  if (!e || s.getTime() === e.getTime()) {
    return formatDate(s);
  }

  // 종료일이 같은 해/달이면 축약
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  const endStr = sameMonth
    ? `${e.getDate()}`
    : sameYear
      ? `${e.getMonth() + 1}. ${e.getDate()}`
      : formatDate(e);

  const nights = diffNights(s, e);
  const label = nights > 0 ? ` (${nights}박${nights + 1}일)` : "";
  return `${formatDate(s)} ~ ${endStr}${label}`;
}

/** 두 날짜 사이 박 수 (일수 차이) */
export function diffNights(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** "YYYY-MM-DD" → 로컬 자정 Date (타임존 밀림 방지) */
function parseDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
