import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { computeBalance } from "@/lib/balance";
import type { Entry, Session } from "@/types";

/**
 * 다음 회차번호 제안 = 현재 최대 number + 1.
 * 회차가 하나도 없으면 1.
 */
export async function getNextSessionNumber(): Promise<number> {
  if (!isSupabaseConfigured()) return 1;
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("number")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.number as number) + 1 : 1;
}

/** 전체 회차 목록 (number 내림차순) — 교차 귀속회차 선택 등에 사용 */
export async function getSessionList(): Promise<Session[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .order("number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Session[];
}

/** 최근 회차 N개 (number 내림차순) */
export async function getRecentSessions(limit = 5): Promise<Session[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .order("number", { ascending: false })
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
 * 현재 통장 잔액 = 가장 최근(number 최대) 회차의 총잔액.
 * 이월금이 연쇄 계산되므로 최신 회차 총잔액이 곧 현재 잔액.
 */
export async function getCurrentBalance(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const sb = supabaseAdmin();
  const { data: latest, error } = await sb
    .from("sessions")
    .select("*")
    .order("number", { ascending: false })
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
