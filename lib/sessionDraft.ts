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
  SessionDraft,
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
  return { uid: newId(), item: "", donor: null, member_id: null, ...init };
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

/**
 * 저장 전 draft 검증 — 문제점 메시지 목록을 반환(빈 배열이면 저장 가능).
 * 클라이언트 게이팅용. 서버는 동일 규칙으로 재검증한다.
 */
export function collectDraftIssues(
  draft: SessionDraft,
  categories: Category[],
): string[] {
  const issues: string[] = [];
  const catById = new Map(categories.map((c) => [c.id, c] as const));

  if (!draft.location.trim()) issues.push("장소를 입력하세요.");
  if (!draft.date_start) issues.push("시작일을 입력하세요.");
  if (draft.isMultiDay && !draft.date_end) {
    issues.push("다박 일정의 종료일을 입력하세요.");
  }
  if (!Number.isInteger(draft.number) || draft.number < 1) {
    issues.push("회차번호가 올바르지 않습니다.");
  }

  draft.entries.forEach((entry, i) => {
    const where = entry.isCross ? "교차" : entry.kind === "income" ? "수입" : "지출";
    const tag = `${where} ${i + 1}번`;
    const cat = entry.category_id ? catById.get(entry.category_id) : null;

    if (!entry.category_id) {
      issues.push(`${tag}: 분류를 선택하세요.`);
      return;
    }
    if (entry.details.length === 0) {
      issues.push(`${tag}: 상세 항목이 최소 1개 필요합니다.`);
      return;
    }
    if (entry.details.some((d) => !Number.isFinite(d.amount) || d.amount < 0)) {
      issues.push(`${tag}: 금액이 올바르지 않습니다.`);
    }
    if (entryTotal(entry) <= 0) {
      issues.push(`${tag}: 합계가 0원입니다.`);
    }
    if (isMemberLinked(cat)) {
      if (entry.member_ids.length === 0) {
        issues.push(`${tag}(${cat?.name}): 회원을 선택하세요.`);
      }
      if (entry.member_ids.length !== entry.details.length) {
        issues.push(`${tag}(${cat?.name}): 회원과 금액 항목 수가 맞지 않습니다.`);
      }
    }
    if (entry.isCross && !entry.cross_session_id) {
      issues.push(`${tag}: 귀속회차를 선택하세요.`);
    }
  });

  // 물품찬조: 품목 비어있는 행
  if (draft.goods_donations.some((g) => !g.item.trim())) {
    issues.push("물품 찬조의 품목을 입력하거나 빈 행을 삭제하세요.");
  }

  return issues;
}
