import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";

const BUCKET = "receipts";

/** 안전한 확장자 추출 (영숫자만, 없으면 bin) */
function safeExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "bin";
}

/**
 * 영수증 파일을 Storage 에 업로드하고 공개 URL 을 반환.
 * 서버 전용 (service_role) — RLS 우회.
 */
export async function uploadReceipt(file: File): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 가 연결되지 않았습니다.");
  }
  const path = `${crypto.randomUUID()}.${safeExt(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
