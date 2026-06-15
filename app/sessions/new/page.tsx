import SessionForm from "@/components/session/SessionForm";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getNextSessionNumber, getCurrentBalance } from "@/lib/sessions";
import { getMembers } from "@/lib/members";
import { getClubSettings } from "@/lib/categories";
import type { Member } from "@/types";

export const dynamic = "force-dynamic";

/** 오늘 날짜(KST) "YYYY-MM-DD" — 서버 타임존과 무관하게 계산 */
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function NewSessionPage() {
  const configured = isSupabaseConfigured();

  let nextNumber = 1;
  let chairperson = "";
  let treasurer = "";
  let carryOver = 0;
  let members: Member[] = [];
  let loadError: string | null = null;

  if (configured) {
    try {
      const [number, settings, balance, memberList] = await Promise.all([
        getNextSessionNumber(),
        getClubSettings(),
        getCurrentBalance(),
        getMembers(),
      ]);
      nextNumber = number;
      chairperson = settings.default_chairperson ?? "";
      treasurer = settings.default_treasurer ?? "";
      carryOver = balance;
      members = memberList;
    } catch (e) {
      loadError =
        e instanceof Error
          ? e.message
          : "작성에 필요한 정보를 불러오지 못했습니다. 마이그레이션을 확인하세요.";
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">새 일지 작성</h1>
        <p className="mt-1 text-sm text-gray-500">
          6단계로 회차 일지를 작성합니다.
        </p>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && (
        <SessionForm
          nextNumber={nextNumber}
          defaultChairperson={chairperson}
          defaultTreasurer={treasurer}
          carryOver={carryOver}
          today={todayKST()}
          members={members}
        />
      )}
    </div>
  );
}
