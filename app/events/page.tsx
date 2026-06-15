import EventsClient from "@/components/events/EventsClient";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getCalendarSessions } from "@/lib/sessions";
import { getSessionTypes } from "@/lib/sessionTypes";
import type { Session, SessionTypeRow } from "@/types";

export const dynamic = "force-dynamic";

/** 오늘 날짜(KST) "YYYY-MM-DD" */
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function EventsPage() {
  const configured = isSupabaseConfigured();

  let sessions: Session[] = [];
  let types: SessionTypeRow[] = [];
  let loadError: string | null = null;
  if (configured) {
    try {
      [sessions, types] = await Promise.all([
        getCalendarSessions(),
        getSessionTypes(),
      ]);
    } catch (e) {
      loadError =
        e instanceof Error
          ? e.message
          : "행사를 불러오지 못했습니다. 마이그레이션을 확인하세요.";
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">행사 일정</h1>
        <p className="mt-1 text-sm text-gray-500">
          예정·완료된 행사를 달력으로 확인하고, 행사를 미리 등록합니다.
        </p>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && (
        <EventsClient
          initialSessions={sessions}
          types={types}
          today={todayKST()}
        />
      )}
    </div>
  );
}
