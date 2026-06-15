import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { getSessionDetail } from "@/lib/sessions";
import { renderPreviewBody, PREVIEW_CSS } from "@/lib/preview";
import { compactDate } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 미리보기 본문을 A4 출력용 완성 HTML 로 감싼다 */
function fullHtml(bodyHtml: string): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"/>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Pretendard, system-ui, -apple-system, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  ${PREVIEW_CSS}
</style></head>
<body><div id="preview-target">${bodyHtml}</div></body></html>`;
}

/** 환경별 Chromium 실행 — 프로덕션은 @sparticuz/chromium, 로컬은 설치된 Chrome */
async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  return puppeteer.launch({ channel: "chrome", headless: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await getSessionDetail(id);
    if (!data) {
      return NextResponse.json(
        { status: "error", error: "일지를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const html = fullHtml(renderPreviewBody(data));
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      // load = 이미지·스타일시트까지 대기, 이후 웹폰트(Pretendard) 적용 대기
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      });

      const fileBase = `일지_${data.session.number}차_${compactDate(data.session.date_start)}`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="session.pdf"; filename*=UTF-8''${encodeURIComponent(`${fileBase}.pdf`)}`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "PDF 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
