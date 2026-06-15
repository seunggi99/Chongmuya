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
 * 일지 내보내기 — PDF(서버 puppeteer) / JPG(클라이언트 html2canvas).
 * JPG 는 #preview-target 을 캡처한다.
 */
export default function ExportButtons({
  sessionId,
  fileBase,
}: {
  sessionId: string;
  fileBase: string; // "일지_752차_20260616"
}) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [jpgLoading, setJpgLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPdf() {
    setPdfLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/export/pdf/${sessionId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "PDF 생성에 실패했습니다.");
      }
      downloadBlob(await res.blob(), `${fileBase}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setPdfLoading(false);
    }
  }

  async function exportJpg() {
    setJpgLoading(true);
    setError(null);
    try {
      const el = document.getElementById("preview-target");
      if (!el) throw new Error("미리보기를 찾을 수 없습니다.");
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95),
      );
      if (!blob) throw new Error("이미지 생성에 실패했습니다.");
      downloadBlob(blob, `${fileBase}.jpg`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "JPG 생성 중 오류가 발생했습니다.");
    } finally {
      setJpgLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={exportPdf}
          disabled={pdfLoading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          PDF
        </button>
        <button
          type="button"
          onClick={exportJpg}
          disabled={jpgLoading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {jpgLoading ? (
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
