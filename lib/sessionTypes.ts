import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import type { SessionTypeRow } from "@/types";

/**
 * 행사 유형 목록 (sort_order 순).
 * 기본은 활성만(폼·표시용). 설정 편집 화면은 includeInactive=true.
 */
export async function getSessionTypes(
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<SessionTypeRow[]> {
  if (!isSupabaseConfigured()) return [];
  let q = supabaseAdmin().from("session_types").select("*");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SessionTypeRow[];
}

/** code → uses_number (없거나 조회 실패 시 레거시 폴백: hike 만 true) */
export async function typeUsesNumber(code: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return code === "hike";
  try {
    const { data, error } = await supabaseAdmin()
      .from("session_types")
      .select("uses_number")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!data) return code === "hike";
    return Boolean(data.uses_number);
  } catch {
    return code === "hike"; // 테이블 미생성 등 → 레거시 규칙
  }
}
