import NewSessionFlow from "@/components/session/NewSessionFlow";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getNextSessionNumber,
  getCurrentBalance,
  getSessionList,
  getPlannedSessions,
} from "@/lib/sessions";
import { getMembersWithDues } from "@/lib/members";
import { currentYearLabel } from "@/lib/dues";
import { getClubSettings, getCategories } from "@/lib/categories";
import { getSessionTypes } from "@/lib/sessionTypes";
import type { Category, Member, Session, SessionTypeRow } from "@/types";

export const dynamic = "force-dynamic";

/** 오늘 날짜(KST) "YYYY-MM-DD" — 서버 타임존과 무관하게 계산 */
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { event: eventId } = await searchParams;

  let nextNumber = 1;
  let chairperson = "";
  let treasurer = "";
  let treasurerTitle = "총무";
  let chairpersonTitle = "회장";
  let carryOver = 0;
  let members: Member[] = [];
  let categories: Category[] = [];
  let sessions: Session[] = [];
  let planned: Session[] = [];
  let paidDuesMemberIds: string[] = [];
  let types: SessionTypeRow[] = [];
  let defaultDueAmount = 100_000;
  let loadError: string | null = null;

  if (configured) {
    try {
      const yearLabel = await currentYearLabel();
      const [
        number,
        settings,
        balance,
        duesRes,
        categoryList,
        sessionList,
        plannedList,
        typeList,
      ] = await Promise.all([
        getNextSessionNumber(),
        getClubSettings(),
        getCurrentBalance(),
        getMembersWithDues(yearLabel),
        getCategories({ includeInactive: false }),
        getSessionList(),
        getPlannedSessions(),
        getSessionTypes(),
      ]);
      nextNumber = number;
      chairperson = settings.default_chairperson ?? "";
      treasurer = settings.default_treasurer ?? "";
      treasurerTitle = settings.treasurer_title || "총무";
      chairpersonTitle = settings.chairperson_title || "회장";
      defaultDueAmount = settings.default_due_amount;
      carryOver = balance;
      members = duesRes.members;
      paidDuesMemberIds = duesRes.paidMemberIds;
      categories = categoryList;
      sessions = sessionList;
      planned = plannedList;
      types = typeList;
      // 기본 유형(첫 유형)이 hike 가 아니면 그 유형 기준으로 회차번호 재제안
      const first = types[0];
      if (first && first.uses_number && first.code !== "hike") {
        nextNumber = await getNextSessionNumber(first.code);
      }
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
          예정 행사를 골라 채우거나, 행사 없이 바로 작성합니다.
        </p>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && (
        <NewSessionFlow
          plannedSessions={planned}
          initialEventId={eventId ?? null}
          formProps={{
            nextNumber,
            defaultChairperson: chairperson,
            defaultTreasurer: treasurer,
            carryOver,
            today: todayKST(),
            members,
            categories,
            defaultDueAmount,
            configured,
            sessions,
            paidDuesMemberIds,
            types,
            treasurerTitle,
            chairpersonTitle,
          }}
        />
      )}
    </div>
  );
}
