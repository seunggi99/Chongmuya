import SettlementClient from "@/components/settlement/SettlementClient";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getSettlement } from "@/lib/settlement";
import type { SettlementData } from "@/types";

export const dynamic = "force-dynamic";

/** 현재 연도(KST) */
function currentYearKST(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCFullYear();
}

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYearKST();

  let data: SettlementData | null = null;
  let loadError: string | null = null;
  if (configured) {
    try {
      data = await getSettlement(year);
    } catch (e) {
      loadError =
        e instanceof Error
          ? e.message
          : "결산을 불러오지 못했습니다. 마이그레이션을 확인하세요.";
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">연간 결산</h1>
        <p className="mt-1 text-sm text-gray-500">
          회차별 결산(교차 귀속)·분류별 지출·연회비·찬조 현황을 연도별로 봅니다.
        </p>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && data && <SettlementClient data={data} />}
    </div>
  );
}
