import { AlertCircle } from "lucide-react";

/** Supabase 미연결 / 마이그레이션 전 안내 배너 */
export default function SetupNotice({ message }: { message?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.8} />
      <div>
        <p className="font-semibold">Supabase 연결이 필요합니다.</p>
        <p className="mt-1 text-amber-700">
          {message ?? (
            <>
              <code className="rounded bg-amber-100 px-1">.env.local</code> 설정과{" "}
              <code className="rounded bg-amber-100 px-1">
                supabase/migrations
              </code>{" "}
              실행 후 이용할 수 있습니다.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
