import { NextResponse } from "next/server";
import { uploadReceipt } from "@/lib/receipts";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { status: "error", error: "Supabase 가 연결되지 않았습니다." },
        { status: 503 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { status: "error", error: "파일이 없습니다." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { status: "error", error: "파일이 너무 큽니다. (최대 10MB)" },
        { status: 413 },
      );
    }

    const url = await uploadReceipt(file);
    return NextResponse.json({ status: "ok", url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "영수증 업로드 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
