import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import type { ParsedTransaction } from "@/lib/bankParsers";
import type { BankTransaction } from "@/types";

/**
 * 파싱된 거래를 bank_transactions 에 저장.
 * session_id 는 null(미매칭), is_used=false 로 입력. 저장된 행을 반환.
 */
export async function saveBankTransactions(
  txs: ParsedTransaction[],
): Promise<BankTransaction[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 가 연결되지 않았습니다.");
  }
  if (txs.length === 0) return [];

  const payload = txs.map((t) => ({
    session_id: null,
    tx_date: t.tx_date,
    description: t.description,
    amount: t.amount,
    bank: t.bank,
    is_used: false,
    raw: t.raw,
  }));

  const { data, error } = await supabaseAdmin()
    .from("bank_transactions")
    .insert(payload)
    .select("*");
  if (error) throw error;
  return (data ?? []) as BankTransaction[];
}

/** 미매칭(session_id null) 거래 목록 — 최근 거래일 순 */
export async function getUnmatchedBankTransactions(): Promise<
  BankTransaction[]
> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseAdmin()
    .from("bank_transactions")
    .select("*")
    .is("session_id", null)
    .order("tx_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BankTransaction[];
}
