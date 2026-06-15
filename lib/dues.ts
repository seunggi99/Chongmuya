import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { getMembers } from "@/lib/members";
import type { AnnualDue, DuesRate, DuesStatusRow } from "@/types";

export { DEFAULT_DUE_AMOUNT } from "@/lib/constants";

/**
 * 현재 연회비 year_label.
 * 달력연도 기준 2자리 ("26~27"). 모임 갱신월이 다르면 이 함수만 조정하면 된다.
 */
export function currentYearLabel(date: Date = new Date()): string {
  const yy = date.getFullYear() % 100;
  const next = (yy + 1) % 100;
  return `${pad2(yy)}~${pad2(next)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** annual_dues 에 존재하는 year_label 목록 (최신순) */
export async function getDuesYears(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("annual_dues")
    .select("year_label");
  if (error) throw error;
  const labels = Array.from(
    new Set((data ?? []).map((r) => r.year_label as string)),
  );
  // "26~27" 형태 — 앞 2자리 내림차순
  labels.sort((a, b) => b.localeCompare(a));
  return labels;
}

/**
 * 특정 연도 납부 현황 — 활성 회원 × 납부여부 (가나다순).
 * 회원당 납부 기록이 여러 개면 가장 최근(paid_at) 기록을 사용.
 */
export async function getDuesStatus(
  yearLabel: string,
): Promise<DuesStatusRow[]> {
  if (!isSupabaseConfigured()) return [];
  const members = await getMembers(); // 활성, 가나다순

  const { data, error } = await supabaseAdmin()
    .from("annual_dues")
    .select("*")
    .eq("year_label", yearLabel);
  if (error) throw error;
  const dues = (data ?? []) as AnnualDue[];

  const byMember = new Map<string, AnnualDue>();
  for (const d of dues) {
    const cur = byMember.get(d.member_id);
    if (!cur || d.paid_at > cur.paid_at) byMember.set(d.member_id, d);
  }

  return members.map((member) => {
    const due = byMember.get(member.id);
    return {
      member,
      paid: Boolean(due),
      paidAt: due?.paid_at ?? null,
      amount: due?.amount ?? null,
      dueId: due?.id ?? null,
    };
  });
}

/** 납부율 (납부 회원 / 활성 회원 전체) */
export async function getDuesRate(yearLabel: string): Promise<DuesRate> {
  const status = await getDuesStatus(yearLabel);
  return {
    paidCount: status.filter((r) => r.paid).length,
    totalCount: status.length,
  };
}

/** 수동 납부 등록 */
export async function recordDue(
  memberId: string,
  yearLabel: string,
  amount: number,
  paidAt: string,
): Promise<AnnualDue> {
  if (!memberId) throw new Error("회원을 선택하세요.");
  if (!yearLabel.trim()) throw new Error("연도를 입력하세요.");
  if (!paidAt) throw new Error("납부일을 입력하세요.");

  const { data, error } = await supabaseAdmin()
    .from("annual_dues")
    .insert({
      member_id: memberId,
      year_label: yearLabel.trim(),
      amount,
      paid_at: paidAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AnnualDue;
}

/** 납부 취소 (기록 삭제) */
export async function deleteDue(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("annual_dues")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
