/**
 * 총무야 도메인 타입 (중앙 관리)
 * - 금액은 모두 정수(원). 표시할 때만 toLocaleString 포맷.
 * - DB row 그대로의 형태를 기본으로 하고, 조인된 확장 타입은 *WithX 로 명명.
 */

// ─── 공통 enum 성격의 유니온 ────────────────────────────────
export type MemberType = "member" | "general"; // 정회원 / 일반회원
export type EntryKind = "income" | "expense";
export type CategoryKind = EntryKind;
export type CategorySpecial = "daily_fee" | "donation" | "annual_dues" | null;
export type SessionType =
  | "hike" // 산행
  | "general_meeting" // 총회
  | "regular_meeting" // 정기모임
  | "sansanje" // 산신제
  | "travel" // 여행
  | "flash"; // 번개

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  hike: "산행",
  general_meeting: "총회",
  regular_meeting: "정기모임",
  sansanje: "산신제",
  travel: "여행",
  flash: "번개",
};

// ─── members ────────────────────────────────────────────────
export interface Member {
  id: string;
  name: string;
  type: MemberType;
  phone: string | null;
  joined_at: string | null; // date (YYYY-MM-DD)
  is_active: boolean;
  created_at: string; // timestamptz
}

// ─── categories ─────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  is_system: boolean;
  special: CategorySpecial;
  sort_order: number;
  is_active: boolean; // false면 입력 목록에서 숨김(소프트 삭제)
}

// ─── sessions ───────────────────────────────────────────────
export interface Session {
  id: string;
  number: number;
  type: SessionType;
  location: string;
  date_start: string; // date
  date_end: string | null; // date | null (당일이면 null)
  fee_per_person: number; // 당일회비 단가
  note: string | null;
  chairperson: string | null;
  treasurer: string | null;
  carry_over: number; // 이월금
  is_manual_carry_over: boolean;
  created_at: string;
  updated_at: string;
}

// ─── session_attendees ──────────────────────────────────────
export interface SessionAttendee {
  id: string;
  session_id: string;
  member_id: string;
  member_type_snapshot: MemberType;
}

// ─── entries ────────────────────────────────────────────────
export interface Entry {
  id: string;
  session_id: string;
  kind: EntryKind;
  category_id: string | null;
  amount: number; // 분류 합계 (entry_details 합과 일치)
  cross_session_id: string | null; // 선입금/선지급 귀속회차 (당일이면 null)
  bank_tx_id: string | null;
  sort_order: number;
}

// ─── entry_details ──────────────────────────────────────────
export interface EntryDetail {
  id: string;
  entry_id: string;
  label: string;
  amount: number;
  receipt_url: string | null;
  sort_order: number;
}

// ─── entry_members (당일회비/찬조/연회비 명단 연결) ──────────
export interface EntryMember {
  id: string;
  entry_id: string;
  member_id: string;
}

// ─── goods_donations (물품 찬조 — 금액 없음) ────────────────
export interface GoodsDonation {
  id: string;
  session_id: string;
  item: string; // '텀블러 20개'
  donor: string | null; // '최봉식'
}

// ─── annual_dues ────────────────────────────────────────────
export interface AnnualDue {
  id: string;
  member_id: string;
  session_id: string | null;
  year_label: string; // '25~26'
  amount: number; // default 100000
  paid_at: string; // date
  note: string | null;
}

// ─── bank_transactions ──────────────────────────────────────
export interface BankTransaction {
  id: string;
  session_id: string | null;
  tx_date: string; // date
  description: string;
  amount: number; // 입금 양수, 출금 음수
  bank: string | null; // 'kbank' | 'kookmin' | ...
  is_used: boolean;
  raw: Record<string, unknown> | null;
}

// ─── club_settings (모임 기본정보 — 싱글톤) ─────────────────
export interface ClubSettings {
  id: number; // 항상 1
  club_name: string;
  default_chairperson: string | null;
  default_treasurer: string | null;
  updated_at: string;
}

// ─── 잔액 요약 (계산 결과) ──────────────────────────────────
export interface BalanceSummary {
  /** 당일 수입 (cross_session_id IS NULL) */
  dailyIncome: number;
  /** 당일 지출 (cross_session_id IS NULL) */
  dailyExpense: number;
  /** 당일잔액 = 당일수입 - 당일지출 */
  dailyBalance: number;
  /** 교차 수입 (cross_session_id IS NOT NULL) */
  crossIncome: number;
  /** 교차 지출 (cross_session_id IS NOT NULL) */
  crossExpense: number;
  /** 이월금 */
  carryOver: number;
  /** 총잔액 = 당일잔액 + 교차수입 - 교차지출 + 이월금 */
  total: number;
}

// ─── 조인 확장 타입 (필요 시 사용) ──────────────────────────
export interface EntryWithDetails extends Entry {
  details: EntryDetail[];
  members?: EntryMember[];
  category?: Category | null;
}

export interface SessionWithRelations extends Session {
  attendees?: SessionAttendee[];
  entries?: EntryWithDetails[];
  goods_donations?: GoodsDonation[];
}
