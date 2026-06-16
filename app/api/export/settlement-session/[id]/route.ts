import { NextResponse } from "next/server";
import { getSessionSettlement } from "@/lib/settlement";
import { renderSessionSettlementHtml } from "@/lib/settlementHtml";
import { launchBrowser } from "@/lib/exportRender";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await getSessionSettlement(id);
    if (!data) {
      return NextResponse.json(
        { status: "error", error: "회차를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const html = renderSessionSettlementHtml(data);
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 760, height: 1100, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      });

      const fileBase = `정산서_${data.session.shortLabel.replace(/\s+/g, "")}`;
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
      e instanceof Error ? e.message : "정산서 PDF 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
