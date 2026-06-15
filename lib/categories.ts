import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import type { Category, CategoryKind, ClubSettings } from "@/types";

// ─── 분류 (categories) ──────────────────────────────────────

/**
 * 전체 분류 (kind, sort_order 순).
 * 기본은 활성/비활성 모두 포함(설정 페이지 편집용).
 * 입력용으로 활성만 필요하면 includeInactive=false 로 호출.
 */
export async function getCategories(
  { includeInactive = true }: { includeInactive?: boolean } = {},
): Promise<Category[]> {
  if (!isSupabaseConfigured()) return [];
  let q = supabaseAdmin().from("categories").select("*");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

/**
 * 특정 kind 의 분류 (sort_order 순).
 * - 기본: is_active=true 만 (수입/지출 입력 select 용)
 * - includeInactive=true: 비활성 포함 (설정 편집 화면용)
 */
export async function getCategoriesByKind(
  kind: CategoryKind,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<Category[]> {
  if (!isSupabaseConfigured()) return [];
  let q = supabaseAdmin().from("categories").select("*").eq("kind", kind);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

/** 분류 추가 — sort_order 는 해당 kind 의 max + 10 으로 자동 배치 */
export async function createCategory(
  kind: CategoryKind,
  name: string,
): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("분류 이름을 입력하세요.");

  const sb = supabaseAdmin();
  const { data: last, error: e1 } = await sb
    .from("categories")
    .select("sort_order")
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  const nextOrder = (last?.sort_order ?? 0) + 10;

  const { data, error } = await sb
    .from("categories")
    .insert({
      name: trimmed,
      kind,
      is_system: false,
      special: null,
      sort_order: nextOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Category;
}

/** 분류 이름 변경 */
export async function renameCategory(
  id: string,
  name: string,
): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("분류 이름을 입력하세요.");
  const { data, error } = await supabaseAdmin()
    .from("categories")
    .update({ name: trimmed })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Category;
}

/** 분류 삭제 결과 — 하드 삭제 또는 소프트(비활성) 처리 */
export type DeleteCategoryResult =
  | { mode: "hard" }
  | { mode: "soft"; count: number };

/**
 * 분류 삭제 (소프트 삭제 규칙).
 * - is_system=true(당일회비/찬조/연회비)는 삭제 불가(에러).
 * - 참조하는 entry 가 0건이면 하드 삭제.
 * - entry 가 1건 이상이면 is_active=false 로 비활성 처리(소프트 삭제).
 */
export async function deleteCategory(
  id: string,
): Promise<DeleteCategoryResult> {
  const sb = supabaseAdmin();
  const { data: target, error: e1 } = await sb
    .from("categories")
    .select("is_system")
    .eq("id", id)
    .maybeSingle();
  if (e1) throw e1;
  if (!target) throw new Error("분류를 찾을 수 없습니다.");
  if (target.is_system) {
    throw new Error("시스템 분류(당일회비·찬조·연회비)는 삭제할 수 없습니다.");
  }

  // 이 분류를 참조하는 entry 수
  const { count, error: e2 } = await sb
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (e2) throw e2;
  const usedCount = count ?? 0;

  if (usedCount === 0) {
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) throw error;
    return { mode: "hard" };
  }

  // 사용 중 → 비활성 처리 (이력/집계 보존)
  const { error } = await sb
    .from("categories")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
  return { mode: "soft", count: usedCount };
}

/** 비활성 분류 복구 (is_active=true) */
export async function reactivateCategory(id: string): Promise<Category> {
  const { data, error } = await supabaseAdmin()
    .from("categories")
    .update({ is_active: true })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Category;
}

/**
 * 분류 정렬 변경. orderedIds 순서대로 sort_order 를 10,20,30... 으로 재배치.
 * (같은 kind 안에서만 호출)
 */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const sb = supabaseAdmin();
  // 개별 update (행 수가 많지 않으므로 충분)
  await Promise.all(
    orderedIds.map((id, idx) =>
      sb
        .from("categories")
        .update({ sort_order: (idx + 1) * 10 })
        .eq("id", id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    ),
  );
}

// ─── 모임 기본정보 (club_settings) ──────────────────────────

/** 모임 설정 (싱글톤 id=1). 없으면 기본값 반환 */
export async function getClubSettings(): Promise<ClubSettings> {
  const fallback: ClubSettings = {
    id: 1,
    club_name: "우리 모임",
    default_chairperson: null,
    default_treasurer: null,
    updated_at: "",
  };
  if (!isSupabaseConfigured()) return fallback;

  const { data, error } = await supabaseAdmin()
    .from("club_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (data as ClubSettings) ?? fallback;
}

/** 모임 기본정보 저장 (upsert) */
export async function updateClubSettings(input: {
  club_name: string;
  default_chairperson: string | null;
  default_treasurer: string | null;
}): Promise<ClubSettings> {
  const name = input.club_name.trim();
  if (!name) throw new Error("모임 이름을 입력하세요.");

  const { data, error } = await supabaseAdmin()
    .from("club_settings")
    .upsert({
      id: 1,
      club_name: name,
      default_chairperson: input.default_chairperson?.trim() || null,
      default_treasurer: input.default_treasurer?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClubSettings;
}
