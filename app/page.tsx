import Link from "next/link";
import {
  CalendarDays,
  Wallet,
  TrendingDown,
  Users,
  FilePlus2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import StatCard from "@/components/common/StatCard";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getRecentSessions,
  getMonthlySessionCount,
  getMonthlyExpense,
  getCurrentBalance,
} from "@/lib/sessions";
import { getActiveMemberCount } from "@/lib/members";
import { formatKRW, formatDateRange } from "@/lib/format";
import { sessionShortLabel } from "@/lib/sessionLabel";
import { SESSION_TYPE_LABEL, type Session } from "@/types";

// 항상 최신 데이터 (대시보드)
export const dynamic = "force-dynamic";

interface DashboardData {
  monthlyCount: number;
  currentBalance: number;
  monthlyExpense: number;
  memberCount: number;
  recent: Session[];
  error: string | null;
}

async function loadDashboard(year: number, month: number): Promise<DashboardData> {
  const empty: DashboardData = {
    monthlyCount: 0,
    currentBalance: 0,
    monthlyExpense: 0,
    memberCount: 0,
    recent: [],
    error: null,
  };
  if (!isSupabaseConfigured()) return empty;
  try {
    const [monthlyCount, currentBalance, monthlyExpense, memberCount, recent] =
      await Promise.all([
        getMonthlySessionCount(year, month),
        getCurrentBalance(),
        getMonthlyExpense(year, month),
        getActiveMemberCount(),
        getRecentSessions(5),
      ]);
    return {
      monthlyCount,
      currentBalance,
      monthlyExpense,
      memberCount,
      recent,
      error: null,
    };
  } catch (e) {
    return {
      ...empty,
      error:
        e instanceof Error
          ? e.message
          : "데이터를 불러오지 못했습니다. 마이그레이션(001_init.sql)을 실행했는지 확인하세요.",
    };
  }
}

export default async function HomePage() {
  // 서버 기준 현재 연·월 (표시용)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const data = await loadDashboard(year, month);
  const configured = isSupabaseConfigured();

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">홈</h1>
          <p className="mt-1 text-sm text-gray-500">
            {year}년 {month}월 · 모임 경비 현황
          </p>
        </div>
        <Link
          href="/sessions/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <FilePlus2 className="h-4 w-4" strokeWidth={2} />새 일지
        </Link>
      </header>

      {/* 설정 안내 배너 */}
      {!configured && <SetupBanner />}
      {configured && data.error && <ErrorBanner message={data.error} />}

      {/* 지표 카드 4개 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          label="이번 달 회차"
          value={formatKRW(data.monthlyCount)}
          unit="회"
          icon={CalendarDays}
          accent="primary"
        />
        <StatCard
          label="현재 통장잔액"
          value={formatKRW(data.currentBalance)}
          unit="원"
          icon={Wallet}
          accent="balance"
          hint="최근 회차 기준"
        />
        <StatCard
          label="이번 달 총지출"
          value={formatKRW(data.monthlyExpense)}
          unit="원"
          icon={TrendingDown}
          accent="expense"
        />
        <StatCard
          label="전체 회원"
          value={formatKRW(data.memberCount)}
          unit="명"
          icon={Users}
          accent="gray"
          hint="활성 회원"
        />
      </section>

      {/* 최근 회차 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 회차</h2>
          <Link
            href="/sessions"
            className="inline-flex items-center text-sm text-gray-500 hover:text-primary"
          >
            전체보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {data.recent.length === 0 ? (
          <EmptyRecent configured={configured} />
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
            {data.recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="font-semibold">{sessionShortLabel(s)}</span>
                      <span className="rounded-md bg-light px-1.5 py-0.5 text-xs text-primary">
                        {SESSION_TYPE_LABEL[s.type]}
                      </span>
                      <span className="truncate text-gray-700">{s.location}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDateRange(s.date_start, s.date_end)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SetupBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.8} />
      <div>
        <p className="font-semibold">Supabase 연결이 필요합니다.</p>
        <p className="mt-1 text-amber-700">
          <code className="rounded bg-amber-100 px-1">.env.local</code> 에 Supabase
          URL/키를 입력하고{" "}
          <code className="rounded bg-amber-100 px-1">
            supabase/migrations/001_init.sql
          </code>{" "}
          을 실행하세요.
        </p>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.8} />
      <p>{message}</p>
    </div>
  );
}

function EmptyRecent({ configured }: { configured: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
      <p className="text-sm text-gray-500">
        {configured
          ? "아직 작성된 일지가 없습니다."
          : "Supabase 연결 후 일지를 작성하면 여기에 표시됩니다."}
      </p>
      <Link
        href="/sessions/new"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
      >
        <FilePlus2 className="h-4 w-4" />첫 일지 작성하기
      </Link>
    </div>
  );
}
