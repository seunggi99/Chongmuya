import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionFromDraft } from "@/lib/sessionsSave";
import type { SessionDraft } from "@/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { status: "error", error: "Supabase 가 연결되지 않았습니다." },
        { status: 503 },
      );
    }

    const draft = (await req.json()) as SessionDraft;
    if (!draft || typeof draft !== "object" || !Array.isArray(draft.entries)) {
      return NextResponse.json(
        { status: "error", error: "잘못된 요청 형식입니다." },
        { status: 400 },
      );
    }

    const { id } = await createSessionFromDraft(draft);
    return NextResponse.json({ status: "ok", id });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 400 });
  }
}
