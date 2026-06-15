import { notFound } from "next/navigation";
import SessionDetailClient from "@/components/session/SessionDetailClient";
import SetupNotice from "@/components/common/SetupNotice";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionDetail } from "@/lib/sessions";
import { compactDate } from "@/lib/format";
import type { SessionDetailView } from "@/types";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">일지 상세</h1>
        </header>
        <SetupNotice />
      </div>
    );
  }

  let data: SessionDetailView | null = null;
  let loadError: string | null = null;
  try {
    data = await getSessionDetail(id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "일지를 불러오지 못했습니다.";
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {loadError}
      </div>
    );
  }
  if (!data) notFound();

  const fileBase = `일지_${data.session.number}차_${compactDate(data.session.date_start)}`;

  return <SessionDetailClient data={data} id={id} fileBase={fileBase} />;
}
