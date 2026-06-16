import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionTypes } from "@/lib/sessionTypes";
import { sessionShortLabel, typeName } from "@/lib/sessionLabel";
import { getDuesStatus } from "@/lib/dues";
import type {
  Category,
  Session,
  SessionSettlementRow,
  SessionSettlementView,
  SettlementData,
  SettlementSessionRow,
} from "@/types";

type SupabaseAdmin = ReturnType<typeof supabaseAdmin>;

interface EntryRow {
  id: string;
  session_id: string;
  kind: "income" | "expense";
  category_id: string | null;
  amount: number | string; // bigint 가 문자열로 올 수 있어 Number 로 강제
  cross_session_id: string | null;
}

/** 결산 귀속 회차 = 교차면 귀속(cross_session_id), 아니면 본인 session */
interface AttributedEntry {
  toSessionId: string;
  kind: "income" | "expense";
  category_id: string | null;
  amount: number;
  id: string;
}

/**
 * 결산 귀속 항목 조회 (공용).
 *  - 포함: 대상 회차의 비교차 항목(cross_session_id IS NULL)
 *  - 포함: 다른 회차에서 대상 회차로 귀속된 교차(cross_session_id = 대상)
 *  - 제외: 대상 회차에서 다른 회차로 나간 교차(그 귀속회차 결산에 잡힘)
 */
async function fetchAttributed(
  sb: SupabaseAdmin,
  sessionIds: string[],
): Promise<AttributedEntry[]> {
  if (sessionIds.length === 0) return [];
  const cols = "id, session_id, kind, category_id, amount, cross_session_id";
  const [ownRes, inRes] = await Promise.all([
    sb.from("entries").select(cols).in("session_id", sessionIds).is("cross_session_id", null),
    sb.from("entries").select(cols).in("cross_session_id", sessionIds),
  ]);
  if (ownRes.error) throw ownRes.error;
  if (inRes.error) throw inRes.error;
  const map = (e: EntryRow, to: string): AttributedEntry => ({
    toSessionId: to,
    kind: e.kind,
    category_id: e.category_id,
    amount: Number(e.amount) || 0,
    id: e.id,
  });
  return [
    ...((ownRes.data ?? []) as EntryRow[]).map((e) => map(e, e.session_id)),
    ...((inRes.data ?? []) as EntryRow[]).map((e) =>
      map(e, e.cross_session_id as string),
    ),
  ];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
/** 결산 연도 Y → 연회비 year_label "YY~(YY+1)" (연도에 시작하는 회계연도) */
function yearLabelForYear(year: number): string {
  return `${pad2(year % 100)}~${pad2((year + 1) % 100)}`;
}

/**
 * 연간 결산 (결산 뷰).
 * ★ 결산 뷰: 각 회차의 집계 = (그 회차의 cross_session_id IS NULL 항목)
 *   + (다른 회차에서 cross_session_id = 이 회차인 항목). 교차로 넘어온 항목은
 *   "귀속회차"의 수입/지출로, 원래 category 로 집계된다.
 * 회차는 date_start 가 해당 연도이고 status=completed 인 것만.
 */
export async function getSettlement(
  year: number,
): Promise<SettlementData | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = supabaseAdmin();

  // 선택 가능한 연도(완료 회차 기준)
  const { data: allRows, error: e0 } = await sb
    .from("sessions")
    .select("date_start")
    .eq("status", "completed");
  if (e0) throw e0;
  const availableYears = Array.from(
    new Set(
      ((allRows ?? []) as { date_start: string }[]).map((r) =>
        Number(r.date_start.slice(0, 4)),
      ),
    ),
  ).sort((a, b) => b - a);

  const [types, catRes, duesYearLabel] = [
    await getSessionTypes({ includeInactive: true }),
    await sb.from("categories").select("id, name, special"),
    yearLabelForYear(year),
  ];
  if (catRes.error) throw catRes.error;
  const catMap = new Map(
    ((catRes.data ?? []) as Pick<Category, "id" | "name" | "special">[]).map(
      (c) => [c.id, c] as const,
    ),
  );

  // 해당 연도 완료 회차
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const { data: ys, error: e1 } = await sb
    .from("sessions")
    .select("*")
    .eq("status", "completed")
    .gte("date_start", from)
    .lt("date_start", to)
    .order("date_start", { ascending: true });
  if (e1) throw e1;
  const yearSessions = (ys ?? []) as Session[];
  const yearIds = yearSessions.map((s) => s.id);

  // 결산 항목 = 본인 비교차 + 다른 회차에서 귀속된 교차
  const attributed = await fetchAttributed(sb, yearIds);

  // 회차별 수입/지출
  const incomeBy = new Map<string, number>();
  const expenseBy = new Map<string, number>();
  for (const a of attributed) {
    const m = a.kind === "income" ? incomeBy : expenseBy;
    m.set(a.toSessionId, (m.get(a.toSessionId) ?? 0) + a.amount);
  }

  const sessions: SettlementSessionRow[] = yearSessions.map((s) => {
    const income = incomeBy.get(s.id) ?? 0;
    const expense = expenseBy.get(s.id) ?? 0;
    return {
      id: s.id,
      shortLabel: sessionShortLabel(s, types),
      location: s.location,
      date_start: s.date_start,
      date_end: s.date_end,
      income,
      expense,
      balance: income - expense,
    };
  });

  const totalIncome = sessions.reduce((a, s) => a + s.income, 0);
  const totalExpense = sessions.reduce((a, s) => a + s.expense, 0);

  // 분류별 지출
  const expByCat = new Map<string, number>();
  for (const a of attributed) {
    if (a.kind !== "expense") continue;
    const name = (a.category_id && catMap.get(a.category_id)?.name) || "기타";
    expByCat.set(name, (expByCat.get(name) ?? 0) + a.amount);
  }
  const expenseByCategory = Array.from(expByCat.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((x, y) => y.amount - x.amount);

  // 현금 찬조 (special=donation 수입) — 상세 라벨(=회원명)별 합계, 가나다순
  const donationIds = attributed
    .filter(
      (a) =>
        a.kind === "income" &&
        a.category_id &&
        catMap.get(a.category_id)?.special === "donation",
    )
    .map((a) => a.id);
  const donationByName = new Map<string, number>();
  if (donationIds.length > 0) {
    const { data: dets, error: e2 } = await sb
      .from("entry_details")
      .select("entry_id, label, amount")
      .in("entry_id", donationIds);
    if (e2) throw e2;
    for (const d of (dets ?? []) as {
      label: string;
      amount: number | string;
    }[]) {
      const name = d.label.trim() || "(미상)";
      donationByName.set(
        name,
        (donationByName.get(name) ?? 0) + (Number(d.amount) || 0),
      );
    }
  }
  const donations = Array.from(donationByName.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

  // 물품 찬조 (금액 없음)
  let goods: SettlementData["goods"] = [];
  if (yearIds.length > 0) {
    const { data: gRows, error: e3 } = await sb
      .from("goods_donations")
      .select("item, donor, member_id")
      .in("session_id", yearIds);
    if (e3) throw e3;
    const rows = (gRows ?? []) as {
      item: string;
      donor: string | null;
      member_id: string | null;
    }[];
    const mids = rows
      .map((g) => g.member_id)
      .filter((x): x is string => Boolean(x));
    const memberName = new Map<string, string>();
    if (mids.length > 0) {
      const { data: ms, error: e4 } = await sb
        .from("members")
        .select("id, name")
        .in("id", mids);
      if (e4) throw e4;
      for (const m of (ms ?? []) as { id: string; name: string }[]) {
        memberName.set(m.id, m.name);
      }
    }
    goods = rows.map((g) => ({
      donorName: g.member_id ? memberName.get(g.member_id) ?? null : g.donor,
      item: g.item,
    }));
  }

  // 연회비 현황
  const dues = await getDuesStatus(duesYearLabel);

  return {
    year,
    availableYears,
    summary: {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
      sessionCount: yearSessions.length,
    },
    sessions,
    expenseByCategory,
    duesYearLabel,
    dues,
    donations,
    goods,
  };
}

/**
 * 회차별 상세 결산 (정산서, 결산 뷰).
 * 이 회차에 귀속된 수입·지출을 분류별로 집계한다. (일지=통장 뷰와 다를 수 있음)
 *  - 포함: 본인 비교차 + 다른 회차에서 이 회차로 귀속된 선입금/선지급(원래 분류로)
 *  - 제외: 이 회차에서 다른 회차로 나간 선입금/선지급(그 귀속회차 결산에 잡힘)
 * 결과에는 "교차" 표시가 없다 — 순수 귀속 수입/지출만.
 */
export async function getSessionSettlement(
  sessionId: string,
): Promise<SessionSettlementView | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = supabaseAdmin();

  const { data: sRow, error } = await sb
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!sRow) return null;
  const session = sRow as Session;

  const [types, catRes] = await Promise.all([
    getSessionTypes({ includeInactive: true }),
    sb.from("categories").select("id, name, special"),
  ]);
  if (catRes.error) throw catRes.error;
  const catMap = new Map(
    ((catRes.data ?? []) as Pick<Category, "id" | "name">[]).map(
      (c) => [c.id, c.name] as const,
    ),
  );

  const attributed = await fetchAttributed(sb, [sessionId]);

  const incomeBy = new Map<string, number>();
  const expenseBy = new Map<string, number>();
  for (const a of attributed) {
    const name = (a.category_id && catMap.get(a.category_id)) || "기타";
    const m = a.kind === "income" ? incomeBy : expenseBy;
    m.set(name, (m.get(name) ?? 0) + a.amount);
  }
  const toRows = (m: Map<string, number>): SessionSettlementRow[] =>
    Array.from(m.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((x, y) => y.amount - x.amount);

  const income = toRows(incomeBy);
  const expense = toRows(expenseBy);
  const totalIncome = income.reduce((a, r) => a + r.amount, 0);
  const totalExpense = expense.reduce((a, r) => a + r.amount, 0);

  return {
    session: {
      id: session.id,
      shortLabel: sessionShortLabel(session, types),
      typeName: typeName(session.type, types),
      location: session.location,
      date_start: session.date_start,
      date_end: session.date_end,
    },
    income,
    expense,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}
