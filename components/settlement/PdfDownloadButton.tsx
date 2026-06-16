"use client";

import { useState } from "react";
import { FileDown, Loader2, AlertCircle } from "lucide-react";

/** 서버 PDF 라우트를 fetch 해 blob 으로 다운로드하는 버튼 */
export default function PdfDownloadButton({
  url,
  filename,
  label = "PDF",
}: {
  url: string;
  filename: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "PDF 생성에 실패했습니다.");
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {label}
      </button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-expense">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
