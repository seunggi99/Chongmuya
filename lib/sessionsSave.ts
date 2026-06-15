import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { recalcCarryOverChain } from "@/lib/balance";
import { currentYearLabel } from "@/lib/dues";
import { collectDraftIssues, isMemberLinked } from "@/lib/sessionDraft";
import type { Category, Member, SessionDraft } from "@/types";

type SupabaseAdmin = ReturnType<typeof supabaseAdmin>;

interface SessionChainRow {
  id: string;
  number: number;
  carry_over: number;
  is_manual_carry_over: boolean;
}

interface BalanceEntryRow {
  session_id: string;
  kind: "income" | "expense";
  amount: number;
  cross_session_id: string | null;
}

/**
 * 작성 폼(SessionDraft)을 DB에 저장한다.
 * 저장 순서: sessions → session_attendees → entries → entry_details
 *           → entry_members → (연회비) annual_dues → goods_donations → bank_tx
 * 이후 이월금 연쇄 재계산.
 *
 * 진짜 트랜잭션 대신 "보상(compensation)" 방식: 세션 생성 후 단계 실패 시
 * 세션을 삭제(자식 cascade)하고 별도 삽입한 연회비 기록을 제거한다.
 */
export async function createSessionFromDraft(
  draft: SessionDraft,
): Promise<{ id: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 가 연결되지 않았습니다.");
  }
  const sb = supabaseAdmin();

  // 1. 기준 데이터 (분류·회원) 로드 — 검증/스냅샷용
  const [{ data: cats, error: ce }, { data: mems, error: me }] =
    await Promise.all([
      sb.from("categories").select("*"),
      sb.from("members").select("*"),
    ]);
  if (ce) throw ce;
  if (me) throw me;
  const categories = (cats ?? []) as Category[];
  const members = (mems ?? []) as Member[];
  const catById = new Map(categories.map((c) => [c.id, c] as const));
  const memTypeById = new Map(members.map((m) => [m.id, m.type] as const));

  // 2. 서버측 재검증 (클라이언트와 동일 규칙)
  const issues = collectDraftIssues(draft, categories);
  if (issues.length > 0) {
    throw new Error(issues[0]);
  }

  // 3. 세션 생성
  const { data: sessionRow, error: se } = await sb
    .from("sessions")
    .insert({
      number: draft.number,
      type: draft.type,
      location: draft.location.trim(),
      date_start: draft.date_start,
      date_end: draft.isMultiDay ? draft.date_end : null,
      fee_per_person: Math.round(draft.fee_per_person) || 0,
      note: draft.note.trim() || null,
      chairperson: draft.chairperson.trim() || null,
      treasurer: draft.treasurer.trim() || null,
      carry_over: Math.round(draft.carry_over) || 0,
      is_manual_carry_over: draft.is_manual_carry_over,
    })
    .select("id")
    .single();
  if (se) {
    // number unique 충돌 등 — 사용자 친화 메시지
    if (se.code === "23505") {
      throw new Error(`이미 존재하는 회차번호입니다 (${draft.number}차).`);
    }
    throw se;
  }
  const sessionId = sessionRow.id as string;

  const insertedDueIds: string[] = [];
  try {
    // 4. 참석자
    if (draft.attendee_ids.length > 0) {
      const rows = draft.attendee_ids.map((id) => ({
        session_id: sessionId,
        member_id: id,
        member_type_snapshot: memTypeById.get(id) ?? "member",
      }));
      const { error } = await sb.from("session_attendees").insert(rows);
      if (error) throw error;
    }

    // 5. entries → details → members → 연회비
    const yearLabel = await currentYearLabel();
    for (let i = 0; i < draft.entries.length; i++) {
      const entry = draft.entries[i];
      const cat = entry.category_id ? catById.get(entry.category_id) : null;
      const details = entry.details.map((d, di) => ({
        label: d.label?.trim() || cat?.name || "항목",
        amount: Math.round(d.amount) || 0,
        receipt_url: d.receipt_url ?? null,
        sort_order: di,
      }));
      const amount = details.reduce((s, d) => s + d.amount, 0);

      const { data: entryRow, error: ee } = await sb
        .from("entries")
        .insert({
          session_id: sessionId,
          kind: entry.kind,
          category_id: entry.category_id,
          amount,
          cross_session_id: entry.cross_session_id,
          bank_tx_id: entry.bank_tx_id,
          sort_order: i,
        })
        .select("id")
        .single();
      if (ee) throw ee;
      const entryId = entryRow.id as string;

      const { error: de } = await sb
        .from("entry_details")
        .insert(details.map((d) => ({ ...d, entry_id: entryId })));
      if (de) throw de;

      if (isMemberLinked(cat) && entry.member_ids.length > 0) {
        const { error: eme } = await sb.from("entry_members").insert(
          entry.member_ids.map((mid) => ({
            entry_id: entryId,
            member_id: mid,
          })),
        );
        if (eme) throw eme;

        // 연회비 → annual_dues (회원별 = 정렬된 detail 금액)
        if (cat?.special === "annual_dues") {
          const dueRows = entry.member_ids.map((mid, idx) => ({
            member_id: mid,
            session_id: sessionId,
            year_label: yearLabel,
            amount: details[idx]?.amount ?? 0,
            paid_at: draft.date_start,
          }));
          const { data: dues, error: ade } = await sb
            .from("annual_dues")
            .insert(dueRows)
            .select("id");
          if (ade) throw ade;
          for (const d of dues ?? []) insertedDueIds.push(d.id as string);
        }
      }
    }

    // 6. 물품 찬조
    const goods = draft.goods_donations.filter((g) => g.item.trim());
    if (goods.length > 0) {
      const { error } = await sb.from("goods_donations").insert(
        goods.map((g) => ({
          session_id: sessionId,
          item: g.item.trim(),
          donor: g.donor?.trim() || null,
        })),
      );
      if (error) throw error;
    }

    // 7. 은행 거래 사용 처리 (중복 방지)
    const txIds = Array.from(
      new Set(
        draft.entries
          .map((e) => e.bank_tx_id)
          .filter((x): x is string => Boolean(x)),
      ),
    );
    if (txIds.length > 0) {
      const { error } = await sb
        .from("bank_transactions")
        .update({ is_used: true, session_id: sessionId })
        .in("id", txIds);
      if (error) throw error;
    }

    // 8. 이월금 연쇄 재계산
    await recalcCarryOverChainInDb(sb);

    return { id: sessionId };
  } catch (err) {
    // 보상 롤백
    if (insertedDueIds.length > 0) {
      await sb.from("annual_dues").delete().in("id", insertedDueIds);
    }
    await sb.from("sessions").delete().eq("id", sessionId);
    throw err;
  }
}

/**
 * 전체 회차 이월금 연쇄 재계산 후, 값이 바뀐 회차만 carry_over 갱신.
 * is_manual_carry_over=true 회차는 그 값을 기준으로 사용(건너뜀).
 */
async function recalcCarryOverChainInDb(sb: SupabaseAdmin): Promise<void> {
  const { data: sessions, error } = await sb
    .from("sessions")
    .select("id, number, carry_over, is_manual_carry_over");
  if (error) throw error;
  const list = (sessions ?? []) as SessionChainRow[];
  if (list.length === 0) return;

  const { data: entries, error: e2 } = await sb
    .from("entries")
    .select("session_id, kind, amount, cross_session_id");
  if (e2) throw e2;

  const bySession = new Map<
    string,
    { kind: "income" | "expense"; amount: number; cross_session_id: string | null }[]
  >();
  for (const en of (entries ?? []) as BalanceEntryRow[]) {
    const arr = bySession.get(en.session_id) ?? [];
    arr.push({
      kind: en.kind,
      amount: en.amount,
      cross_session_id: en.cross_session_id,
    });
    bySession.set(en.session_id, arr);
  }

  const result = recalcCarryOverChain(
    list.map((s) => ({ ...s, entries: bySession.get(s.id) ?? [] })),
  );

  for (const s of list) {
    const r = result.get(s.id);
    if (r && r.carryOver !== s.carry_over) {
      const { error: ue } = await sb
        .from("sessions")
        .update({ carry_over: r.carryOver })
        .eq("id", s.id);
      if (ue) throw ue;
    }
  }
}
