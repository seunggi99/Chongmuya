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
/**
 * 행사 유형 코드. 커스텀 가능(session_types.code)하므로 string.
 * 기본 코드: hike·general_meeting·regular_meeting·sansanje·travel·flash
 */
export type SessionType = string;

/** 행사/일지 상태: planned=행사만 등록, completed=일지 작성 완료 */
export type SessionStatus = "planned" | "completed";

// 기본 유형 라벨 (DB session_types 미연결 시 폴백). 시드 이름과 일치.
export const SESSION_TYPE_LABEL: Record<string, string> = {
  hike: "산행",
  general_meeting: "정기총회",
  regular_meeting: "정기모임",
  sansanje: "시산제",
  travel: "여행",
  flash: "번개",
};

/** 행사 유형 (커스텀 가능, session_types 테이블) */
export interface SessionTypeRow {
  id: string;
  code: string; // sessions.type 와 매칭
  name: string;
  uses_number: boolean; // 회차번호 부여 여부
  badge_color: string; // 배지색 (BadgeColor 문자열)
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
}

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
  number: number | null; // 행사 등록 시 미정 가능 → 일지 작성 시 확정
  name: string | null; // 행사명 (없으면 유형 라벨로 대체 표시)
  status: SessionStatus; // planned | completed
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
  donor: string | null; // 비회원/외부인 찬조자 텍스트 (member_id 없을 때)
  member_id: string | null; // 회원 찬조자 (있으면 우선)
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
  dues_renewal_month: number; // 연회비 갱신 월 (1~12), year_label 계산 기준
  default_due_amount: number; // 연회비 기본 금액(원)
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

// ─── 연회비 현황 (계산 결과) ────────────────────────────────
export interface DuesStatusRow {
  member: Member;
  paid: boolean;
  paidAt: string | null; // date
  amount: number | null;
  dueId: string | null; // 납부 취소(삭제)용
}

// ─── 연간 결산 (결산 뷰) ────────────────────────────────────
export interface SettlementSummary {
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  sessionCount: number;
}
export interface SettlementSessionRow {
  id: string;
  shortLabel: string;
  location: string;
  date_start: string;
  date_end: string | null;
  income: number;
  expense: number;
  balance: number;
}
export interface SettlementCategoryRow {
  name: string;
  amount: number;
}
export interface SettlementDonationRow {
  name: string; // 찬조자(회원명)
  amount: number;
}
export interface SettlementGoodsRow {
  donorName: string | null;
  item: string;
}
export interface SettlementData {
  year: number;
  availableYears: number[];
  summary: SettlementSummary;
  sessions: SettlementSessionRow[];
  expenseByCategory: SettlementCategoryRow[];
  duesYearLabel: string;
  dues: DuesStatusRow[];
  donations: SettlementDonationRow[];
  goods: SettlementGoodsRow[];
}

// ─── 회차별 상세 결산 (정산서, 결산 뷰) ────────────────────
export interface SessionSettlementRow {
  name: string; // 분류명
  amount: number;
}
export interface SessionSettlementView {
  session: {
    id: string;
    shortLabel: string;
    typeName: string;
    location: string;
    date_start: string;
    date_end: string | null;
  };
  income: SessionSettlementRow[];
  expense: SessionSettlementRow[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface DuesRate {
  paidCount: number;
  totalCount: number;
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

// ─── 회차 목록 카드용 요약 ──────────────────────────────────
export interface SessionSummary {
  session: Session;
  attendeeCount: number;
  total: number; // 총잔액 (completed 만 의미 있음)
}

// ─── 일지 상세/미리보기 뷰 (조회 + 계산 결과) ───────────────
export interface PreviewDetailView {
  label: string;
  amount: number;
  receipt_url: string | null;
}

export interface PreviewEntryView {
  id: string;
  kind: EntryKind;
  categoryName: string;
  special: CategorySpecial;
  amount: number;
  /** 교차(선입금/선지급) 귀속회차 표시 라벨(번호 없으면 행사명·일자) — 당일 항목이면 null */
  crossSessionLabel: string | null;
  details: PreviewDetailView[];
  /** 회원연동(당일회비/찬조/연회비) 명단 */
  memberNames: string[];
}

export interface PreviewAttendeeView {
  name: string;
  type: MemberType;
}

export interface PreviewGoodsView {
  item: string;
  donorName: string | null; // 회원명 또는 외부 찬조자 텍스트
}

export interface SessionDetailView {
  session: Session;
  attendees: PreviewAttendeeView[];
  entries: PreviewEntryView[];
  goods: PreviewGoodsView[];
  balance: BalanceSummary;
  /** 이 회차로 들어온 선입금(daily_fee) 선납 회원명 — 당일회비 계산식 표시용 */
  prepaidDailyFeeNames: string[];
  // 유형(session_types) 기반으로 서버에서 미리 계산한 표시값
  title: string; // 미리보기 제목 ("제740차 산행" / "2506 정기총회")
  shortLabel: string; // 짧은 라벨 ("740차" / "2506 정기모임")
  fileBase: string; // 내보내기 파일명 베이스
  typeName: string; // 유형명
}

// ─── 일지 작성 폼 draft (클라이언트 상태) ────────────────────
// DB 저장 전 폼이 들고 있는 작성 중 상태. id/session_id 등 서버가
// 채우는 필드는 제외하고, 화면 입력에 필요한 값만 보관한다.

/** 상세항목 입력값 (한 분류 안의 식당1·버스1 …) */
export interface EntryDetailDraft {
  uid: string; // 클라이언트 전용 식별자 (React key·업데이트용)
  label: string;
  amount: number; // 정수(원)
  receipt_url?: string | null;
}

/** 분류 단위 입력값 (수입/지출 한 줄) */
export interface EntryDraft {
  uid: string; // 클라이언트 전용 식별자
  kind: EntryKind;
  category_id: string | null;
  /**
   * 교차 항목(선입금/선지급) 여부 — 클라이언트 전용.
   * 귀속회차(cross_session_id) 미선택 상태에서도 Step3·4(당일)와
   * Step5(교차)를 구분하기 위한 플래그. 저장 시 서버는 무시한다.
   */
  isCross?: boolean;
  /** 선입금/선지급 귀속회차 (당일이면 null) */
  cross_session_id: string | null;
  /** 은행 거래 매칭(있으면) */
  bank_tx_id: string | null;
  details: EntryDetailDraft[];
  /**
   * 당일회비/찬조/연회비 명단 (그 외 분류는 빈 배열).
   * 회원연동 분류에서는 member_ids[i] 와 details[i] 가 같은 회원을 가리킨다.
   */
  member_ids: string[];
}

/** 물품 찬조 입력값 (금액 없음) */
export interface GoodsDonationDraft {
  uid: string; // 클라이언트 전용 식별자
  item: string;
  /** 비회원/외부인 찬조자 텍스트 (member_id 없을 때) */
  donor: string | null;
  /** 회원 찬조자 (있으면 우선) */
  member_id: string | null;
}

/** 일지 작성 6단계 폼 전체 상태 */
export interface SessionDraft {
  /** 완성 중인 planned 행사 session id (있으면 새로 만들지 않고 그 행을 채워 completed 전환) */
  eventSessionId: string | null;
  // Step1 기본정보
  number: number;
  name: string; // 행사명 (선택)
  type: SessionType;
  location: string;
  date_start: string; // YYYY-MM-DD ('' = 미입력)
  isMultiDay: boolean; // 다박 여부 (true면 date_end 사용)
  date_end: string | null; // 다박 종료일 (당일이면 null)
  fee_per_person: number; // 당일회비 단가
  note: string;
  chairperson: string;
  treasurer: string;
  // Step6 이월금 (자동 세팅, 수동 보정 가능)
  carry_over: number;
  is_manual_carry_over: boolean;
  // Step2 참석자 (member.id 목록)
  attendee_ids: string[];
  // Step3·4 수입/지출
  entries: EntryDraft[];
  // 물품 찬조
  goods_donations: GoodsDonationDraft[];
}
