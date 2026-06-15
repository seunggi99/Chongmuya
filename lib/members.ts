import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import type { Member, MemberType } from "@/types";

/** 가나다순 정렬 (한국어 로케일) */
function sortByName(members: Member[]): Member[] {
  return [...members].sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
}

/** 활성 회원 수 */
export async function getActiveMemberCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count, error } = await supabaseAdmin()
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

/**
 * 회원 목록 (가나다순).
 * - 기본: 활성 회원만 (is_active=true)
 * - includeInactive=true: 비활성 포함 (회원 관리 화면용)
 */
export async function getMembers(
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<Member[]> {
  if (!isSupabaseConfigured()) return [];
  let q = supabaseAdmin().from("members").select("*");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return sortByName((data ?? []) as Member[]);
}

/**
 * 회원 목록 + 특정 연도 연회비 납부 여부.
 * @returns members(가나다순) 와 납부 회원 id 집합(paidMemberIds)
 */
export async function getMembersWithDues(
  yearLabel: string,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<{ members: Member[]; paidMemberIds: string[] }> {
  if (!isSupabaseConfigured()) return { members: [], paidMemberIds: [] };
  const members = await getMembers({ includeInactive });

  const { data, error } = await supabaseAdmin()
    .from("annual_dues")
    .select("member_id")
    .eq("year_label", yearLabel);
  if (error) throw error;

  const paidMemberIds = Array.from(
    new Set((data ?? []).map((r) => r.member_id as string)),
  );
  return { members, paidMemberIds };
}

/** 신규 회원 추가 */
export async function createMember(input: {
  name: string;
  type: MemberType;
  phone?: string | null;
  joinedAt?: string | null;
}): Promise<Member> {
  const name = input.name.trim();
  if (!name) throw new Error("이름을 입력하세요.");
  const { data, error } = await supabaseAdmin()
    .from("members")
    .insert({
      name,
      type: input.type,
      phone: input.phone?.trim() || null,
      joined_at: input.joinedAt || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Member;
}

/** 회원 정보 수정 (이름/전화/가입일/등급 등) */
export async function updateMember(
  id: string,
  fields: Partial<Pick<Member, "name" | "type" | "phone" | "joined_at">>,
): Promise<Member> {
  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    const n = fields.name.trim();
    if (!n) throw new Error("이름을 입력하세요.");
    patch.name = n;
  }
  if (fields.type !== undefined) patch.type = fields.type;
  if (fields.phone !== undefined) patch.phone = fields.phone?.trim() || null;
  if (fields.joined_at !== undefined) patch.joined_at = fields.joined_at || null;

  const { data, error } = await supabaseAdmin()
    .from("members")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Member;
}

/** 등급 변경 ('member' | 'general') */
export async function changeMemberType(
  id: string,
  type: MemberType,
): Promise<Member> {
  return updateMember(id, { type });
}

/** 비활성 처리 (소프트 삭제) */
export async function deactivateMember(id: string): Promise<Member> {
  const { data, error } = await supabaseAdmin()
    .from("members")
    .update({ is_active: false })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Member;
}

/** 비활성 회원 복구 */
export async function reactivateMember(id: string): Promise<Member> {
  const { data, error } = await supabaseAdmin()
    .from("members")
    .update({ is_active: true })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Member;
}
