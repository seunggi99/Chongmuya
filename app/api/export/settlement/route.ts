import { NextResponse } from "next/server";
import { getSettlement } from "@/lib/settlement";
import { renderSettlementHtml } from "@/lib/settlementHtml";
import { launchBrowser } from "@/lib/exportRender";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const year = Number(new URL(req.url).searchParams.get("year"));
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return NextResponse.json(
        { status: "error", error: "연도가 올바르지 않습니다." },
        { status: 400 },
      );
    }
    const data = await getSettlement(year);
    if (!data) {
      return NextResponse.json(
        { status: "error", error: "Supabase 가 연결되지 않았습니다." },
        { status: 503 },
      );
    }

    const html = renderSettlementHtml(data);
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 880, height: 1200, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      });

      const fileBase = `결산_${year}`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="settlement.pdf"; filename*=UTF-8''${encodeURIComponent(`${fileBase}.pdf`)}`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "결산 PDF 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
