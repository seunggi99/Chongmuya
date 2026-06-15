import ClubInfoCard from "@/components/settings/ClubInfoCard";
import CategoryListEditor from "@/components/settings/CategoryListEditor";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getCategories, getClubSettings } from "@/lib/categories";
import type { Category, ClubSettings } from "@/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const configured = isSupabaseConfigured();

  let expense: Category[] = [];
  let income: Category[] = [];
  let settings: ClubSettings | null = null;
  let loadError: string | null = null;

  if (configured) {
    try {
      const [cats, club] = await Promise.all([
        getCategories(),
        getClubSettings(),
      ]);
      expense = cats.filter((c) => c.kind === "expense");
      income = cats.filter((c) => c.kind === "income");
      settings = club;
    } catch (e) {
      loadError =
        e instanceof Error
          ? e.message
          : "설정을 불러오지 못했습니다. 마이그레이션(001·002)을 확인하세요.";
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          모임 기본정보와 수입/지출 분류를 관리합니다.
        </p>
      </header>

      {!configured && <SetupNotice />}
      {configured && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {configured && !loadError && settings && (
        <>
          <ClubInfoCard initial={settings} />
          <div className="grid gap-4 md:grid-cols-2">
            <CategoryListEditor kind="expense" initial={expense} />
            <CategoryListEditor kind="income" initial={income} />
          </div>
        </>
      )}
    </div>
  );
}
