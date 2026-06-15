import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isSupabaseConfigured } from "@/lib/env";
import {
  detectBank,
  detectBankByText,
  parseBank,
  parseRows,
  parseWithMapping,
  getColumnCandidates,
  type Row,
  type ColumnMapping,
  type ParsedTransaction,
} from "@/lib/bankParsers";
import { extractRowsFromPdf } from "@/lib/pdfExtract";
import { saveBankTransactions } from "@/lib/bankTransactions";

export const runtime = "nodejs";

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

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

    // PDF 는 좌표 기반으로 표를 재구성, 그 외(xlsx/csv)는 SheetJS
    const isPdf = isPdfFile(file);
    const buffer = await file.arrayBuffer();
    let rows: Row[];
    let pdfText = "";
    if (isPdf) {
      const extracted = await extractRowsFromPdf(buffer);
      rows = extracted.rows;
      pdfText = extracted.text;
    } else {
      rows = readRows(buffer);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          error: isPdf
            ? "PDF 에서 거래 표를 추출하지 못했습니다. 컬럼 매핑이 필요한 양식일 수 있습니다."
            : "빈 파일이거나 읽을 수 없습니다.",
        },
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
      // 자동 인식 — PDF 는 전체 텍스트의 은행명 토큰도 활용
      const bank = detectBank(rows) ?? (isPdf ? detectBankByText(pdfText) : null);

      // 헤더가 잡히면 은행 시그니처와 무관하게 파싱 시도
      parsed = bank
        ? parseBank(bank, rows)
        : isPdf
          ? parseRows(rows, "pdf")
          : [];

      if (parsed.length === 0) {
        // 인식/추출 실패 → 컬럼 매핑 후보 반환 (저장 안 함)
        return NextResponse.json({
          status: "need_mapping",
          ...(bank ? { detectedBank: bank } : {}),
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
