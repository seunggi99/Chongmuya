/**
 * 일지 작성 폼(SessionDraft) 클라이언트 헬퍼.
 * server-only 아님 — 클라이언트 컴포넌트에서 사용.
 */
import type {
  Category,
  EntryDetailDraft,
  EntryDraft,
  EntryKind,
  GoodsDonationDraft,
} from "@/types";

/** 클라이언트 전용 식별자 생성 */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}`;
}

/** 빈 상세항목 */
export function emptyDetail(init?: Partial<EntryDetailDraft>): EntryDetailDraft {
  return { uid: newId(), label: "", amount: 0, receipt_url: null, ...init };
}

/** 빈 분류 entry (상세 1줄 기본) */
export function emptyEntry(
  kind: EntryKind,
  init?: Partial<EntryDraft>,
): EntryDraft {
  return {
    uid: newId(),
    kind,
    category_id: null,
    cross_session_id: null,
    bank_tx_id: null,
    details: [emptyDetail()],
    member_ids: [],
    ...init,
  };
}

/** 빈 물품찬조 */
export function emptyGoods(init?: Partial<GoodsDonationDraft>): GoodsDonationDraft {
  return { uid: newId(), item: "", donor: null, ...init };
}

/** entry 합계 = 상세항목 amount 합 */
export function entryTotal(entry: EntryDraft): number {
  return entry.details.reduce((sum, d) => sum + (d.amount || 0), 0);
}

/** 여러 entry 합계 */
export function entriesTotal(entries: EntryDraft[]): number {
  return entries.reduce((sum, e) => sum + entryTotal(e), 0);
}

/** 회원연동 분류 여부 (당일회비/찬조/연회비) */
export function isMemberLinked(cat: Category | null | undefined): boolean {
  return (
    !!cat &&
    (cat.special === "daily_fee" ||
      cat.special === "donation" ||
      cat.special === "annual_dues")
  );
}
