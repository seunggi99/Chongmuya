import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionTypes } from "@/lib/sessionTypes";
import { sessionShortLabel } from "@/lib/sessionLabel";
import { getDuesStatus } from "@/lib/dues";
import type {
  Category,
  Session,
  SettlementData,
  SettlementSessionRow,
} from "@/types";

interface EntryRow {
  id: string;
  session_id: string;
  kind: "income" | "expense";
  category_id: string | null;
  amount: number;
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
  let attributed: AttributedEntry[] = [];
  if (yearIds.length > 0) {
    const [ownRes, inRes] = await Promise.all([
      sb
        .from("entries")
        .select("id, session_id, kind, category_id, amount, cross_session_id")
        .in("session_id", yearIds)
        .is("cross_session_id", null),
      sb
        .from("entries")
        .select("id, session_id, kind, category_id, amount, cross_session_id")
        .in("cross_session_id", yearIds),
    ]);
    if (ownRes.error) throw ownRes.error;
    if (inRes.error) throw inRes.error;
    attributed = [
      ...((ownRes.data ?? []) as EntryRow[]).map((e) => ({
        toSessionId: e.session_id,
        kind: e.kind,
        category_id: e.category_id,
        amount: e.amount,
        id: e.id,
      })),
      ...((inRes.data ?? []) as EntryRow[]).map((e) => ({
        toSessionId: e.cross_session_id as string,
        kind: e.kind,
        category_id: e.category_id,
        amount: e.amount,
        id: e.id,
      })),
    ];
  }

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
    for (const d of (dets ?? []) as { label: string; amount: number }[]) {
      const name = d.label.trim() || "(미상)";
      donationByName.set(name, (donationByName.get(name) ?? 0) + d.amount);
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
