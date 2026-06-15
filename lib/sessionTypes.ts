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

/** 유형 추가 — code 자동생성, sort_order=max+10 */
export async function createSessionType(input: {
  name: string;
  uses_number: boolean;
  badge_color: string;
}): Promise<SessionTypeRow> {
  const name = input.name.trim();
  if (!name) throw new Error("유형 이름을 입력하세요.");
  const sb = supabaseAdmin();
  const { data: last, error: e1 } = await sb
    .from("session_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  const nextOrder = (last?.sort_order ?? 0) + 10;
  const code = `t_${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await sb
    .from("session_types")
    .insert({
      code,
      name,
      uses_number: input.uses_number,
      badge_color: input.badge_color,
      is_system: false,
      sort_order: nextOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SessionTypeRow;
}

/** 유형 수정 (이름·색상·uses_number — is_system 도 이 항목들은 변경 가능) */
export async function updateSessionType(
  id: string,
  fields: Partial<Pick<SessionTypeRow, "name" | "uses_number" | "badge_color">>,
): Promise<SessionTypeRow> {
  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    const n = fields.name.trim();
    if (!n) throw new Error("유형 이름을 입력하세요.");
    patch.name = n;
  }
  if (fields.uses_number !== undefined) patch.uses_number = fields.uses_number;
  if (fields.badge_color !== undefined) patch.badge_color = fields.badge_color;

  const { data, error } = await supabaseAdmin()
    .from("session_types")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as SessionTypeRow;
}

export type DeleteTypeResult = { mode: "hard" } | { mode: "soft"; count: number };

/**
 * 유형 삭제.
 *  - is_system=true → 삭제 불가(에러)
 *  - 참조 세션 0건 → 하드 삭제
 *  - 1건 이상 → 소프트 삭제(is_active=false)
 */
export async function deleteSessionType(id: string): Promise<DeleteTypeResult> {
  const sb = supabaseAdmin();
  const { data: target, error: e1 } = await sb
    .from("session_types")
    .select("code, is_system")
    .eq("id", id)
    .maybeSingle();
  if (e1) throw e1;
  if (!target) throw new Error("유형을 찾을 수 없습니다.");
  if (target.is_system) {
    throw new Error("기본 유형은 삭제할 수 없습니다.");
  }

  const { count, error: e2 } = await sb
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("type", target.code as string);
  if (e2) throw e2;
  const used = count ?? 0;

  if (used === 0) {
    const { error } = await sb.from("session_types").delete().eq("id", id);
    if (error) throw error;
    return { mode: "hard" };
  }
  const { error } = await sb
    .from("session_types")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
  return { mode: "soft", count: used };
}

/** 비활성 유형 복구 */
export async function reactivateSessionType(
  id: string,
): Promise<SessionTypeRow> {
  const { data, error } = await supabaseAdmin()
    .from("session_types")
    .update({ is_active: true })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as SessionTypeRow;
}

/** 정렬 변경 (orderedIds 순서대로 sort_order 10,20,30…) */
export async function reorderSessionTypes(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const sb = supabaseAdmin();
  await Promise.all(
    orderedIds.map((id, idx) =>
      sb
        .from("session_types")
        .update({ sort_order: (idx + 1) * 10 })
        .eq("id", id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    ),
  );
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
