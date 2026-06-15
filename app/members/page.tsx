import MembersClient from "@/components/member/MembersClient";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getMembersWithDues } from "@/lib/members";
import { currentYearLabel } from "@/lib/dues";
import type { Member } from "@/types";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const configured = isSupabaseConfigured();
  const yearLabel = await currentYearLabel();

  let members: Member[] = [];
  let paidMemberIds: string[] = [];
  let loadError: string | null = null;

  if (configured) {
    try {
      const res = await getMembersWithDues(yearLabel, {
        includeInactive: true,
      });
      members = res.members;
      paidMemberIds = res.paidMemberIds;
    } catch (e) {
      loadError =
        e instanceof Error
          ? e.message
          : "회원을 불러오지 못했습니다. 마이그레이션을 확인하세요.";
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">회원관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          정회원·일반회원 명단과 연회비 납부 현황을 관리합니다.
        </p>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && (
        <MembersClient
          initialMembers={members}
          paidMemberIds={paidMemberIds}
          yearLabel={yearLabel}
        />
      )}
    </div>
  );
}
