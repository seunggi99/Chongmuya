import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isSupabaseConfigured } from "@/lib/env";
import {
  detectBank,
  parseBank,
  parseWithMapping,
  getColumnCandidates,
  type Row,
  type ColumnMapping,
  type ParsedTransaction,
} from "@/lib/bankParsers";
import { saveBankTransactions } from "@/lib/bankTransactions";

export const runtime = "nodejs";

/** 워크북 첫 시트를 2차원 배열로 (날짜·금액은 포맷 문자열로 유지) */
function readRows(buffer: ArrayBuffer): Row[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as Row[];
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { status: "error", error: "파일이 없습니다." },
        { status: 400 },
      );
    }

    const rows = readRows(await file.arrayBuffer());
    if (rows.length === 0) {
      return NextResponse.json(
        { status: "error", error: "빈 파일이거나 읽을 수 없습니다." },
        { status: 400 },
      );
    }

    const mappingRaw = form.get("mapping");
    let parsed: ParsedTransaction[];

    if (typeof mappingRaw === "string" && mappingRaw.trim()) {
      // 사용자 지정 컬럼 매핑
      const mapping = JSON.parse(mappingRaw) as ColumnMapping;
      parsed = parseWithMapping(rows, mapping);
    } else {
      // 자동 인식
      const bank = detectBank(rows);
      if (!bank) {
        // 인식 실패 → 컬럼 매핑 후보 반환 (저장 안 함)
        return NextResponse.json({
          status: "need_mapping",
          ...getColumnCandidates(rows),
        });
      }
      parsed = parseBank(bank, rows);
      if (parsed.length === 0) {
        // 인식은 됐지만 추출 0건 → 매핑으로 폴백
        return NextResponse.json({
          status: "need_mapping",
          detectedBank: bank,
          ...getColumnCandidates(rows),
        });
      }
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { status: "error", error: "거래를 추출하지 못했습니다. 컬럼을 확인하세요." },
        { status: 422 },
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { status: "error", error: "Supabase 가 연결되지 않았습니다." },
        { status: 503 },
      );
    }

    const saved = await saveBankTransactions(parsed);
    return NextResponse.json({
      status: "saved",
      bank: parsed[0]?.bank ?? null,
      count: saved.length,
      transactions: saved,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "업로드 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
