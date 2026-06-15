import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import type { Member } from "@/types";

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

/** 전체 회원 목록 (이름 가나다순) */
export async function getMembers(): Promise<Member[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("members")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Member[];
}
