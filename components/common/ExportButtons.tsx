"use client";

import { useState } from "react";
import { FileDown, ImageDown, Loader2, AlertCircle } from "lucide-react";

/** blob 을 파일로 다운로드 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 일지 내보내기 — PDF / JPG 모두 서버(puppeteer)에서 렌더.
 * 화면 캡처(html2canvas)는 한글 베이스라인이 어긋나므로 사용하지 않고,
 * 정상 렌더되는 실제 크롬 엔진으로 PDF·JPG 를 동일하게 출력한다.
 */
export default function ExportButtons({
  sessionId,
  fileBase,
}: {
  sessionId: string;
  fileBase: string; // "일지_752차_20260616"
}) {
  const [loading, setLoading] = useState<null | "pdf" | "jpg">(null);
  const [error, setError] = useState<string | null>(null);

  async function exportFile(kind: "pdf" | "jpg") {
    setLoading(kind);
    setError(null);
    try {
      const res = await fetch(`/api/export/${kind}/${sessionId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `${kind.toUpperCase()} 생성에 실패했습니다.`);
      }
      downloadBlob(await res.blob(), `${fileBase}.${kind}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `${kind.toUpperCase()} 생성 중 오류가 발생했습니다.`,
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => exportFile("pdf")}
          disabled={loading !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {loading === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          PDF
        </button>
        <button
          type="button"
          onClick={() => exportFile("jpg")}
          disabled={loading !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {loading === "jpg" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageDown className="h-4 w-4" />
          )}
          JPG
        </button>
      </div>
      {error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-expense">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
