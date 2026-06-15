import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { computeBalance } from "@/lib/balance";
import {
  sessionShortLabel,
  sessionTitle,
  sessionFileBase,
  typeName,
} from "@/lib/sessionLabel";
import { getSessionTypes, typeUsesNumber } from "@/lib/sessionTypes";
import type {
  Category,
  Entry,
  EntryDetail,
  Member,
  MemberType,
  PreviewEntryView,
  Session,
  SessionDetailView,
  SessionSummary,
  SessionType,
} from "@/types";

/**
 * 다음 회차번호 제안 = 같은 유형(typeCode) 중 최대 number + 1.
 * uses_number=true 인 유형만 회차번호를 부여하므로, 그 유형이 아니면 1(미사용).
 * uses_number 유형이 여러 개여도 각각 따로 카운트.
 */
export async function getNextSessionNumber(
  typeCode = "hike",
): Promise<number> {
  if (!isSupabaseConfigured()) return 1;
  if (!(await typeUsesNumber(typeCode))) return 1;
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("number")
    .eq("type", typeCode)
    .not("number", "is", null)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.number as number) + 1 : 1;
}

/**
 * 행사 등록 = status='planned' 인 빈 session 생성 (수입/지출 없음).
 * 일지는 나중에 이 session 에 채운다(status='completed'로 전환).
 */
export async function createEventSession(input: {
  name: string | null;
  type: SessionType;
  location: string;
  date_start: string;
  date_end: string | null;
  number: number | null;
}): Promise<Session> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 가 연결되지 않았습니다.");
  }
  const location = input.location.trim();
  if (!location) throw new Error("장소를 입력하세요.");
  if (!input.date_start) throw new Error("일자를 입력하세요.");

  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .insert({
      name: input.name?.trim() || null,
      type: input.type,
      location,
      date_start: input.date_start,
      date_end: input.date_end || null,
      // 회차번호는 uses_number 유형에만 부여
      number: (await typeUsesNumber(input.type)) ? input.number ?? null : null,
      status: "planned",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error(`이미 사용 중인 회차번호입니다 (${input.number}차).`);
    }
    throw error;
  }
  return data as Session;
}

/** 달력용 — 모든 회차(행사 planned + 일지 completed), 시작일 오름차순 */
export async function getCalendarSessions(): Promise<Session[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .order("date_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Session[];
}

/** 아직 일지 미작성(planned) 행사 목록 — 시작일 오름차순 */
export async function getPlannedSessions(): Promise<Session[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("status", "planned")
    .order("date_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Session[];
}

/**
 * 일지 상세 (미리보기/출력용). 회차 + 참석자·entries·상세·회원명단·물품찬조 +
 * 잔액 계산까지 묶어서 반환. 없으면 null.
 * 일지 뷰 = 이 회차의 모든 entries(교차 포함) → 통장 잔액 증명.
 */
export async function getSessionDetail(
  id: string,
): Promise<SessionDetailView | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = supabaseAdmin();

  const { data: sessionRow, error: se } = await sb
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (se) throw se;
  if (!sessionRow) return null;
  const session = sessionRow as Session;
  const types = await getSessionTypes({ includeInactive: true });

  const [attRes, entryRes, goodsRes, memberRes, catRes] = await Promise.all([
    sb
      .from("session_attendees")
      .select("member_id, member_type_snapshot")
      .eq("session_id", id),
    sb
      .from("entries")
      .select("*")
      .eq("session_id", id)
      .order("sort_order", { ascending: true }),
    sb
      .from("goods_donations")
      .select("item, donor, member_id")
      .eq("session_id", id),
    sb.from("members").select("id, name, type"),
    sb.from("categories").select("id, name, special"),
  ]);
  for (const r of [attRes, entryRes, goodsRes, memberRes, catRes]) {
    if (r.error) throw r.error;
  }

  const memberName = new Map(
    ((memberRes.data ?? []) as Pick<Member, "id" | "name">[]).map((m) => [
      m.id,
      m.name,
    ]),
  );
  const catMap = new Map(
    ((catRes.data ?? []) as Pick<Category, "id" | "name" | "special">[]).map(
      (c) => [c.id, c],
    ),
  );
  const entriesRaw = (entryRes.data ?? []) as Entry[];
  const entryIds = entriesRaw.map((e) => e.id);

  // 상세항목 · 회원연결 (entry 가 있을 때만)
  let details: EntryDetail[] = [];
  let ems: { entry_id: string; member_id: string }[] = [];
  if (entryIds.length > 0) {
    const [dRes, mRes] = await Promise.all([
      sb
        .from("entry_details")
        .select("*")
        .in("entry_id", entryIds)
        .order("sort_order", { ascending: true }),
      sb.from("entry_members").select("entry_id, member_id").in("entry_id", entryIds),
    ]);
    if (dRes.error) throw dRes.error;
    if (mRes.error) throw mRes.error;
    details = (dRes.data ?? []) as EntryDetail[];
    ems = (mRes.data ?? []) as { entry_id: string; member_id: string }[];
  }

  const detailsByEntry = new Map<string, EntryDetail[]>();
  for (const d of details) {
    const arr = detailsByEntry.get(d.entry_id) ?? [];
    arr.push(d);
    detailsByEntry.set(d.entry_id, arr);
  }
  const memberIdsByEntry = new Map<string, string[]>();
  for (const em of ems) {
    const arr = memberIdsByEntry.get(em.entry_id) ?? [];
    arr.push(em.member_id);
    memberIdsByEntry.set(em.entry_id, arr);
  }

  // 교차 귀속회차 번호
  const crossIds = Array.from(
    new Set(
      entriesRaw
        .map((e) => e.cross_session_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  // 교차 귀속회차 표시 라벨 (번호 없는 행사는 행사명·일자로)
  const crossLabel = new Map<string, string>();
  if (crossIds.length > 0) {
    const { data, error } = await sb
      .from("sessions")
      .select("id, number, name, type, date_start")
      .in("id", crossIds);
    if (error) throw error;
    for (const r of (data ?? []) as {
      id: string;
      number: number | null;
      name: string | null;
      type: SessionType;
      date_start: string;
    }[]) {
      crossLabel.set(r.id, sessionShortLabel(r, types));
    }
  }

  const entries: PreviewEntryView[] = entriesRaw.map((e) => {
    const cat = e.category_id ? catMap.get(e.category_id) : null;
    return {
      id: e.id,
      kind: e.kind,
      categoryName: cat?.name ?? "기타",
      special: cat?.special ?? null,
      amount: e.amount,
      crossSessionLabel: e.cross_session_id
        ? crossLabel.get(e.cross_session_id) ?? null
        : null,
      details: (detailsByEntry.get(e.id) ?? []).map((d) => ({
        label: d.label,
        amount: d.amount,
        receipt_url: d.receipt_url,
      })),
      memberNames: (memberIdsByEntry.get(e.id) ?? [])
        .map((mid) => memberName.get(mid) ?? "")
        .filter(Boolean),
    };
  });

  const attendees = (
    (attRes.data ?? []) as {
      member_id: string;
      member_type_snapshot: MemberType;
    }[]
  )
    .map((a) => ({
      name: memberName.get(a.member_id) ?? "?",
      type: a.member_type_snapshot,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

  const goods = (
    (goodsRes.data ?? []) as {
      item: string;
      donor: string | null;
      member_id: string | null;
    }[]
  ).map((g) => ({
    item: g.item,
    donorName: g.member_id ? memberName.get(g.member_id) ?? null : g.donor,
  }));

  const balance = computeBalance(
    entriesRaw.map((e) => ({
      kind: e.kind,
      amount: e.amount,
      cross_session_id: e.cross_session_id,
    })),
    session.carry_over,
  );

  // 선납: 다른 회차에서 이 회차로 들어온 daily_fee 선입금 entry 의 회원 = 선납자
  let prepaidDailyFeeNames: string[] = [];
  const { data: crossInRows, error: ciErr } = await sb
    .from("entries")
    .select("id, category_id")
    .eq("cross_session_id", id)
    .eq("kind", "income");
  if (ciErr) throw ciErr;
  const prepaidEntryIds = ((crossInRows ?? []) as {
    id: string;
    category_id: string | null;
  }[])
    .filter((e) => {
      const c = e.category_id ? catMap.get(e.category_id) : null;
      return c?.special === "daily_fee";
    })
    .map((e) => e.id);
  if (prepaidEntryIds.length > 0) {
    const { data: pm, error: pmErr } = await sb
      .from("entry_members")
      .select("member_id")
      .in("entry_id", prepaidEntryIds);
    if (pmErr) throw pmErr;
    const names = Array.from(
      new Set(
        ((pm ?? []) as { member_id: string }[])
          .map((r) => memberName.get(r.member_id) ?? "")
          .filter(Boolean),
      ),
    );
    prepaidDailyFeeNames = names.sort((a, b) => a.localeCompare(b, "ko-KR"));
  }

  return {
    session,
    attendees,
    entries,
    goods,
    balance,
    prepaidDailyFeeNames,
    title: sessionTitle(session, types),
    shortLabel: sessionShortLabel(session, types),
    fileBase: sessionFileBase(session, types),
    typeName: typeName(session.type, types),
  };
}

/**
 * 회차 목록 카드용 요약 — 전체 세션(시간순 최신 위) + 참석 인원 + 총잔액.
 * 총잔액 = computeBalance(entries, carry_over).total (carry_over 는 저장 시 연쇄 갱신됨)
 */
export async function getSessionSummaries(): Promise<SessionSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = supabaseAdmin();
  const { data: sessions, error } = await sb
    .from("sessions")
    .select("*")
    .order("date_start", { ascending: false });
  if (error) throw error;
  const list = (sessions ?? []) as Session[];
  if (list.length === 0) return [];
  const ids = list.map((s) => s.id);

  const [entryRes, attRes] = await Promise.all([
    sb
      .from("entries")
      .select("session_id, kind, amount, cross_session_id")
      .in("session_id", ids),
    sb.from("session_attendees").select("session_id").in("session_id", ids),
  ]);
  if (entryRes.error) throw entryRes.error;
  if (attRes.error) throw attRes.error;

  const entriesBy = new Map<
    string,
    { kind: "income" | "expense"; amount: number; cross_session_id: string | null }[]
  >();
  for (const en of (entryRes.data ?? []) as {
    session_id: string;
    kind: "income" | "expense";
    amount: number;
    cross_session_id: string | null;
  }[]) {
    const arr = entriesBy.get(en.session_id) ?? [];
    arr.push({
      kind: en.kind,
      amount: en.amount,
      cross_session_id: en.cross_session_id,
    });
    entriesBy.set(en.session_id, arr);
  }

  const attBy = new Map<string, number>();
  for (const a of (attRes.data ?? []) as { session_id: string }[]) {
    attBy.set(a.session_id, (attBy.get(a.session_id) ?? 0) + 1);
  }

  return list.map((session) => ({
    session,
    attendeeCount: attBy.get(session.id) ?? 0,
    total: computeBalance(entriesBy.get(session.id) ?? [], session.carry_over)
      .total,
  }));
}

/** 전체 회차 목록 (시간순 내림차순) — 교차 귀속회차 선택 등에 사용 */
export async function getSessionList(): Promise<Session[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .order("date_start", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Session[];
}

/** 최근 회차 N개 (작성 완료 일지만, 시간순 내림차순) */
export async function getRecentSessions(limit = 5): Promise<Session[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("status", "completed")
    .order("date_start", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Session[];
}

/** 특정 연·월에 시작하는 회차 + 그 entries (대시보드 집계용) */
async function getSessionsInMonth(
  year: number,
  month: number, // 1-12
): Promise<{ session: Session; entries: Entry[] }[]> {
  if (!isSupabaseConfigured()) return [];
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toMonth = month === 12 ? 1 : month + 1;
  const toYear = month === 12 ? year + 1 : year;
  const to = `${toYear}-${String(toMonth).padStart(2, "0")}-01`;

  const sb = supabaseAdmin();
  const { data: sessions, error } = await sb
    .from("sessions")
    .select("*")
    .eq("status", "completed")
    .gte("date_start", from)
    .lt("date_start", to);
  if (error) throw error;
  const list = (sessions ?? []) as Session[];
  if (list.length === 0) return [];

  const { data: entries, error: e2 } = await sb
    .from("entries")
    .select("*")
    .in(
      "session_id",
      list.map((s) => s.id),
    );
  if (e2) throw e2;
  const bySession = new Map<string, Entry[]>();
  for (const en of (entries ?? []) as Entry[]) {
    const arr = bySession.get(en.session_id) ?? [];
    arr.push(en);
    bySession.set(en.session_id, arr);
  }
  return list.map((session) => ({
    session,
    entries: bySession.get(session.id) ?? [],
  }));
}

/** 이번 달 회차 수 */
export async function getMonthlySessionCount(
  year: number,
  month: number,
): Promise<number> {
  const rows = await getSessionsInMonth(year, month);
  return rows.length;
}

/** 이번 달 총지출 (당일+교차 지출 entry 합계) */
export async function getMonthlyExpense(
  year: number,
  month: number,
): Promise<number> {
  const rows = await getSessionsInMonth(year, month);
  let sum = 0;
  for (const { entries } of rows) {
    for (const e of entries) if (e.kind === "expense") sum += e.amount;
  }
  return sum;
}

/**
 * 현재 통장 잔액 = 가장 최근(시간순) 완료 회차의 총잔액.
 * 이월금이 시간순으로 연쇄 계산되므로 최신 회차 총잔액이 곧 현재 잔액.
 */
export async function getCurrentBalance(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const sb = supabaseAdmin();
  const { data: latest, error } = await sb
    .from("sessions")
    .select("*")
    .eq("status", "completed")
    .order("date_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!latest) return 0;
  const session = latest as Session;

  const { data: entries, error: e2 } = await sb
    .from("entries")
    .select("*")
    .eq("session_id", session.id);
  if (e2) throw e2;

  return computeBalance((entries ?? []) as Entry[], session.carry_over).total;
}
