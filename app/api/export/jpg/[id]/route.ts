import { NextResponse } from "next/server";
import { getSessionDetail } from "@/lib/sessions";
import { renderSessionExport } from "@/lib/exportRender";
import { compactDate } from "@/lib/format";

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

    const jpg = await renderSessionExport(data, "jpeg");
    const fileBase = `일지_${data.session.number}차_${compactDate(data.session.date_start)}`;
    return new NextResponse(jpg, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="session.jpg"; filename*=UTF-8''${encodeURIComponent(`${fileBase}.jpg`)}`,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "JPG 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
