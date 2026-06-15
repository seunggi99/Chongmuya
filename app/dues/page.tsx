import DuesClient from "@/components/dues/DuesClient";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getMembers } from "@/lib/members";
import { getClubSettings } from "@/lib/categories";
import {
  currentYearLabel,
  getDuesYears,
  getDuesStatus,
  getDuesRate,
} from "@/lib/dues";
import { DEFAULT_DUE_AMOUNT } from "@/lib/constants";
import type { DuesRate, DuesStatusRow, Member } from "@/types";

export const dynamic = "force-dynamic";

export default async function DuesPage() {
  const configured = isSupabaseConfigured();
  const current = await currentYearLabel();

  let years: string[] = [];
  let selectedYear = current;
  let status: DuesStatusRow[] = [];
  let rate: DuesRate = { paidCount: 0, totalCount: 0 };
  let members: Member[] = [];
  let defaultDueAmount = DEFAULT_DUE_AMOUNT;
  let loadError: string | null = null;

  if (configured) {
    try {
      const [existing, activeMembers, settings] = await Promise.all([
        getDuesYears(),
        getMembers(),
        getClubSettings(),
      ]);
      members = activeMembers;
      defaultDueAmount = settings.default_due_amount;

      // 현재 연도는 항상 탭에 포함 (데이터 없어도 기본 노출)
      years = Array.from(new Set([current, ...existing])).sort((a, b) =>
        b.localeCompare(a),
      );
      selectedYear = years.includes(current) ? current : years[0];

      [status, rate] = await Promise.all([
        getDuesStatus(selectedYear),
        getDuesRate(selectedYear),
      ]);
    } catch (e) {
      loadError =
        e instanceof Error
          ? e.message
          : "연회비 현황을 불러오지 못했습니다. 마이그레이션을 확인하세요.";
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">연회비현황</h1>
        <p className="mt-1 text-sm text-gray-500">
          연도별 회원 납부 현황을 확인하고 수동으로 보정합니다.
        </p>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && (
        <DuesClient
          initialYears={years}
          initialYear={selectedYear}
          initialData={{ status, rate }}
          members={members}
          defaultDueAmount={defaultDueAmount}
        />
      )}
    </div>
  );
}
