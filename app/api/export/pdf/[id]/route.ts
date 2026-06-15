import { NextResponse } from "next/server";
import { getSessionDetail } from "@/lib/sessions";
import { renderSessionExport } from "@/lib/exportRender";
import { sessionFileBase } from "@/lib/sessionLabel";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const pdf = await renderSessionExport(data, "pdf");
    const fileBase = sessionFileBase(data.session);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="session.pdf"; filename*=UTF-8''${encodeURIComponent(`${fileBase}.pdf`)}`,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "PDF 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
