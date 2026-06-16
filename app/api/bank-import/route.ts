import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import officeCrypto from "officecrypto-tool";
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

function isCsvFile(file: File): boolean {
  return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
}

/**
 * 잠긴 엑셀(xls/xlsx)이면 복호화한 바이트를 돌려준다.
 * SheetJS 내장 복호화는 일부 스킴만 지원하므로, officecrypto-tool 로
 * ECMA-376 agile/standard 와 xls97(RC4 CryptoAPI) 를 모두 처리한다.
 * - 잠긴 파일 + 비번 없음 → "File is password-protected" throw (라우트가 분류)
 * - 비번 불일치 → officecrypto-tool 이 throw
 */
async function decryptIfNeeded(
  buffer: ArrayBuffer,
  isCsv: boolean,
  password: string,
): Promise<Uint8Array> {
  const u8 = new Uint8Array(buffer);
  if (isCsv) return u8; // CSV 는 암호화 대상 아님
  const buf = Buffer.from(buffer);
  let encrypted = false;
  try {
    encrypted = officeCrypto.isEncrypted(buf);
  } catch {
    encrypted = false; // CFB/zip 가 아니면 암호화 아님으로 간주
  }
  if (!encrypted) return u8;
  if (!password) throw new Error("File is password-protected");
  const decrypted = await officeCrypto.decrypt(buf, { password });
  return new Uint8Array(decrypted);
}

/** 워크북 첫 시트를 2차원 배열로 (날짜·금액은 포맷 문자열로 유지) */
function readRows(data: Uint8Array): Row[] {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as Row[];
}

/**
 * 파일 열기(복호화) 단계 에러를 사용자 메시지로 분류.
 * needPassword=true 면 클라이언트에서 비밀번호 입력을 유도한다.
 */
function classifyOpenError(
  err: unknown,
  isPdf: boolean,
  hasPassword: boolean,
): { message: string; needPassword: boolean } {
  const e = err as { name?: string; code?: number; message?: string };
  const msg = e?.message ?? "";

  // PDF: pdf.js PasswordException (code 1=필요, 2=불일치)
  if (isPdf && e?.name === "PasswordException") {
    if (e.code === 2)
      return { message: "비밀번호가 올바르지 않습니다. 다시 확인해 주세요.", needPassword: true };
    return {
      message: "이 파일은 비밀번호로 보호되어 있습니다. 파일 비밀번호를 입력해 주세요.",
      needPassword: true,
    };
  }

  // XLSX(SheetJS): "File is password-protected" / "Password is incorrect" 등
  const looksEncrypted = /password|encrypt/i.test(msg);
  if (/incorrect/i.test(msg))
    return { message: "비밀번호가 올바르지 않습니다. 다시 확인해 주세요.", needPassword: true };
  if (looksEncrypted && !hasPassword)
    return {
      message: "이 파일은 비밀번호로 보호되어 있습니다. 파일 비밀번호를 입력해 주세요.",
      needPassword: true,
    };
  // 비번을 줬는데 열기 실패 → 대개 비번 불일치(복호화 후 깨진 데이터)
  if (hasPassword)
    return {
      message: "비밀번호가 올바르지 않거나 파일을 열 수 없습니다. 비밀번호를 확인해 주세요.",
      needPassword: true,
    };

  return {
    message: isPdf
      ? "PDF 를 읽을 수 없습니다. 파일을 확인하세요."
      : "파일을 읽을 수 없습니다. 형식을 확인하세요.",
    needPassword: false,
  };
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

    // 잠긴 거래내역증명서용 비밀번호(선택). 파싱에만 1회 사용하고
    // 응답·로그·DB 어디에도 남기지 않는다.
    const pwRaw = form.get("password");
    let password = typeof pwRaw === "string" ? pwRaw : "";

    // PDF 는 좌표 기반으로 표를 재구성, 그 외(xlsx/csv)는 SheetJS
    const isPdf = isPdfFile(file);
    const buffer = await file.arrayBuffer();
    let rows: Row[];
    let pdfText = "";
    try {
      if (isPdf) {
        const extracted = await extractRowsFromPdf(buffer, password || undefined);
        rows = extracted.rows;
        pdfText = extracted.text;
      } else {
        // 잠긴 xls/xlsx 는 먼저 복호화한 뒤 SheetJS 로 파싱
        const plain = await decryptIfNeeded(buffer, isCsvFile(file), password);
        rows = readRows(plain);
      }
    } catch (openErr) {
      const fail = classifyOpenError(openErr, isPdf, Boolean(password));
      password = ""; // 사용 후 즉시 폐기
      return NextResponse.json(
        {
          status: "error",
          error: fail.message,
          ...(fail.needPassword ? { needPassword: true } : {}),
        },
        { status: fail.needPassword ? 422 : 400 },
      );
    }
    password = ""; // 파싱 끝 — 비밀번호 변수 폐기

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
