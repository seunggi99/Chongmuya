import "server-only";
import { getDocumentProxy } from "unpdf";
import type { Row } from "@/lib/bankParsers";

/**
 * 은행 거래내역증명서 PDF → 2차원 표(Row[]) 로 재구성.
 *
 * PDF 텍스트는 표 구조를 보존하지 않으므로, 각 텍스트 조각의 좌표(x,y)를 이용해
 *  1) y 로 줄을 묶고
 *  2) 헤더 줄(거래일자+입금/출금/금액 키워드)의 x 위치로 컬럼 경계를 잡고
 *  3) 날짜로 시작하는 줄을 거래 블록의 시작으로 보고 후속 줄을 합쳐
 *  4) 각 조각을 가장 가까운 컬럼에 배치해 한 거래 = 한 Row 로 만든다.
 *
 * 결과는 [헤더Row, ...거래Row] 형태라 기존 bankParsers(findHeaderRow/buildTransactions)
 * 와 그대로 호환된다. (케이뱅크 증명서 구조 우선 대응, 그 외 양식도 헤더만 잡히면 동작)
 */

interface PdfItem {
  x: number;
  y: number;
  str: string;
}
interface PdfLine {
  y: number;
  items: PdfItem[];
}

const DATE_RE = /\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/;
const DATE_KW = ["거래일자", "거래일시", "거래년월일", "일자", "날짜"];
const AMT_KW = ["입금", "출금", "금액", "맡기신", "찾으신", "잔액"];
// 합계/안내/페이지번호 등 표가 아닌 줄
const FOOTER_RE =
  /(출력\s*당일|발급일자|발급번호|고객센터|홈페이지|페이지|^\s*\d+\s*\/\s*\d+\s*$)/;

const lineText = (l: PdfLine) => l.items.map((i) => i.str).join("");

function isHeaderLine(l: PdfLine): boolean {
  const t = lineText(l);
  return DATE_KW.some((k) => t.includes(k)) && AMT_KW.some((k) => t.includes(k));
}

/** x 가 어느 컬럼(경계 배열 기준)에 속하는지 — 경계보다 작거나 같은 개수 */
const colOf = (x: number, bounds: number[]) =>
  bounds.filter((v) => v <= x).length;

/** 헤더 앵커 x 들 사이의 중간값을 컬럼 경계로 */
function midBoundaries(xs: number[]): number[] {
  return xs.slice(0, -1).map((x, i) => (x + xs[i + 1]) / 2);
}

/** pdfjs TextItem(좌표 있는 텍스트 조각) 판별 */
function isTextItem(
  it: unknown,
): it is { str: string; transform: number[] } {
  if (typeof it !== "object" || it === null) return false;
  const o = it as { str?: unknown; transform?: unknown };
  return typeof o.str === "string" && Array.isArray(o.transform);
}

/** y 가 비슷한 조각을 한 줄로 묶음 (y 내림차순 — PDF 는 아래가 작은 y) */
function groupLines(items: readonly unknown[]): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const it of items) {
    if (!isTextItem(it) || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let line = lines.find((l) => Math.abs(l.y - y) <= 2.5);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push({ x, y, str: it.str });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

/** 한 거래 블록의 조각들을 컬럼별로 배치해 Row 생성 */
function buildRow(items: PdfItem[], ncols: number, bounds: number[]): Row {
  const cols: PdfItem[][] = Array.from({ length: ncols }, () => []);
  for (const it of items) {
    const c = Math.min(colOf(it.x, bounds), ncols - 1);
    cols[c].push(it);
  }
  return cols.map((cell) =>
    cell
      .sort((a, z) => z.y - a.y || a.x - z.x)
      .map((i) => i.str.trim())
      .filter(Boolean)
      .join(" ")
      .trim(),
  );
}

export interface PdfExtractResult {
  rows: Row[];
  /** 은행명 토큰 탐지용 전체 텍스트 */
  text: string;
}

export async function extractRowsFromPdf(
  buffer: ArrayBuffer,
  password?: string,
): Promise<PdfExtractResult> {
  // 잠긴 PDF 면 password 로 복호화. 비번 없음/틀림이면 pdf.js 가
  // PasswordException(code 1=필요, 2=불일치) 을 던지며, 라우트에서 분류한다.
  const pdf = await getDocumentProxy(
    new Uint8Array(buffer),
    password ? { password } : {},
  );
  const rows: Row[] = [];
  const textParts: string[] = [];
  let header: { label: string; x: number }[] | null = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items) {
      if ("str" in it && typeof it.str === "string") textParts.push(it.str);
    }
    const lines = groupLines(content.items);

    const hIdx = lines.findIndex(isHeaderLine);
    if (hIdx >= 0) {
      header = lines[hIdx].items
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((i) => ({ label: i.str.trim(), x: i.x }))
        .filter((h) => h.label);
      if (rows.length === 0 && header.length > 0) {
        rows.push(header.map((h) => h.label));
      }
    }
    if (!header) continue;

    const bounds = midBoundaries(header.map((h) => h.x));
    const ncols = header.length;
    const dataLines = lines
      .slice(hIdx + 1)
      .filter((l) => !FOOTER_RE.test(lineText(l)) && !isHeaderLine(l));

    // 날짜로 시작하는 줄을 거래 블록 시작으로 보고 묶는다
    let cur: PdfItem[] = [];
    let started = false;
    for (const line of dataLines) {
      const startsBlock = line.items.some(
        (it) => colOf(it.x, bounds) === 0 && DATE_RE.test(it.str),
      );
      if (startsBlock) {
        if (cur.length > 0) rows.push(buildRow(cur, ncols, bounds));
        cur = [...line.items];
        started = true;
      } else if (started) {
        cur.push(...line.items);
      }
    }
    if (cur.length > 0) rows.push(buildRow(cur, ncols, bounds));
  }

  return { rows, text: textParts.join(" ") };
}
