"use client";

import { renderPreviewBody, PREVIEW_CSS } from "@/lib/preview";
import type { SessionDetailView } from "@/types";

/**
 * 일지 미리보기 (출력 대상). id="preview-target" 가 PDF/JPG 캡처 기준.
 * 마크업·스타일은 lib/preview 의 단일 소스를 그대로 사용한다.
 */
export default function SessionPreview({ data }: { data: SessionDetailView }) {
  return (
    <div id="preview-target">
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: renderPreviewBody(data) }} />
    </div>
  );
}
