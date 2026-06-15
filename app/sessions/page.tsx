import Link from "next/link";
import { FilePlus2, CalendarPlus } from "lucide-react";
import SessionsClient from "@/components/session/SessionsClient";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionSummaries } from "@/lib/sessions";
import { getSessionTypes } from "@/lib/sessionTypes";
import type { SessionSummary, SessionTypeRow } from "@/types";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const configured = isSupabaseConfigured();

  let summaries: SessionSummary[] = [];
  let types: SessionTypeRow[] = [];
  let loadError: string | null = null;
  if (configured) {
    try {
      [summaries, types] = await Promise.all([
        getSessionSummaries(),
        getSessionTypes(),
      ]);
    } catch (e) {
      loadError =
        e instanceof Error
          ? e.message
          : "회차를 불러오지 못했습니다. 마이그레이션을 확인하세요.";
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">회차 목록</h1>
          <p className="mt-1 text-sm text-gray-500">
            작성한 일지와 예정 행사를 시간순으로 모아봅니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
          >
            <CalendarPlus className="h-4 w-4" />
            행사 등록
          </Link>
          <Link
            href="/sessions/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <FilePlus2 className="h-4 w-4" />
            새 일지
          </Link>
        </div>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && (
        <SessionsClient summaries={summaries} types={types} />
      )}
    </div>
  );
}
