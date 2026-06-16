import "server-only";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { renderPreviewBody, PREVIEW_CSS } from "@/lib/preview";
import type { SessionDetailView } from "@/types";

/**
 * 일지 미리보기를 PDF/JPG 로 렌더 (공용).
 * 화면 캡처(html2canvas)는 한글 텍스트 베이스라인이 어긋나므로,
 * JPG 도 PDF 와 동일하게 puppeteer(실제 크롬 엔진)로 렌더해 결과를 일치시킨다.
 */
export type ExportKind = "pdf" | "jpeg";

/** 미리보기 본문을 출력용 완성 HTML 로 감싼다 */
function fullHtml(bodyHtml: string): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"/>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: Pretendard, system-ui, -apple-system, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  ${PREVIEW_CSS}
</style></head>
<body><div id="preview-target">${bodyHtml}</div></body></html>`;
}

/** 환경별 Chromium — 프로덕션은 @sparticuz/chromium, 로컬은 설치된 Chrome */
export async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  return puppeteer.launch({ channel: "chrome", headless: true });
}

export async function renderSessionExport(
  data: SessionDetailView,
  kind: ExportKind,
): Promise<Uint8Array<ArrayBuffer>> {
  const html = fullHtml(renderPreviewBody(data));
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 880, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load" });
    // 웹폰트(Pretendard) 적용 완료까지 대기
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    if (kind === "pdf") {
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      });
      return new Uint8Array(pdf);
    }

    // JPG: 미리보기 본문(.pv)만 잘라서 캡처
    const el = await page.$(".pv");
    if (!el) throw new Error("미리보기 영역을 찾지 못했습니다.");
    const img = await el.screenshot({ type: "jpeg", quality: 92 });
    return new Uint8Array(img);
  } finally {
    await browser.close();
  }
}
