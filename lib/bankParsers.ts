/**
 * 은행 거래내역 파서 (순수 모듈 — DB·프레임워크 비의존).
 *
 * 입력: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) 형태의
 *       2차원 배열(Row[]). 상단 제목/계좌정보 행 + 헤더 행 + 데이터 행으로 구성됨.
 * 출력: ParsedTransaction[]  (amount: 입금 양수 / 출금 음수)
 *
 * - detectBank(rows): 은행명 토큰 + 헤더 키워드로 은행 자동 인식. 실패 시 null.
 * - parseBank(bankId, rows): 인식된 은행 파서.
 * - parseWithMapping(rows, mapping): 사용자가 지정한 컬럼으로 파싱.
 * - getColumnCandidates(rows): 매핑 UI 용 헤더 후보 + 미리보기.
 */

export type BankId = "kbank" | "kookmin" | "shinhan" | "woori" | "nh";

export type Cell = string | number | boolean | null | undefined;
export type Row = Cell[];

export interface ParsedTransaction {
  tx_date: string; // YYYY-MM-DD
  description: string;
  amount: number; // 입금 +, 출금 -
  bank: string; // BankId | 'custom'
  raw: Record<string, unknown>;
}

export interface ColumnMapping {
  /** 헤더 행 index (데이터는 그다음 행부터). 미지정 시 자동탐지 또는 0 */
  headerRow?: number;
  dateCol: number;
  /** 적요/내용 컬럼 (여러 개면 공백으로 합침) */
  descCol: number | number[];
  /** 단일 금액 컬럼형 */
  amountCol?: number;
  /** 입출금 분리형 */
  depositCol?: number;
  withdrawCol?: number;
  /** 입출금 구분 컬럼('입금'/'출금') — amountCol 과 함께 사용 */
  typeCol?: number;
}

export interface BankProfile {
  id: BankId;
  label: string;
  /** 셀 어디든 등장하면 해당 은행으로 강하게 추정 */
  nameTokens: string[];
  /** 헤더 행에 모두 존재하면 해당 은행으로 추정(은행명 없을 때 보조) */
  signature: string[];
}

export const BANK_PROFILES: BankProfile[] = [
  {
    id: "kbank",
    label: "케이뱅크",
    nameTokens: ["케이뱅크", "케이뱅", "kbank"],
    signature: ["거래일시", "적요", "거래후잔액"],
  },
  {
    id: "kookmin",
    label: "국민은행",
    nameTokens: ["국민은행", "kb국민", "kookmin", "국민"],
    signature: ["찾으신금액", "맡기신금액"],
  },
  {
    id: "shinhan",
    label: "신한은행",
    nameTokens: ["신한은행", "신한", "shinhan"],
    signature: ["거래일자", "내용", "잔액"],
  },
  {
    id: "woori",
    label: "우리은행",
    nameTokens: ["우리은행", "woori", "우리"],
    signature: ["기재내용"],
  },
  {
    id: "nh",
    label: "농협",
    nameTokens: ["농협", "nh", "nonghyup"],
    signature: ["거래기록사항"],
  },
];

// ─── 컬럼 역할 키워드 ────────────────────────────────────────
type Role =
  | "date"
  | "desc"
  | "deposit"
  | "withdraw"
  | "amount"
  | "type"
  | "balance";

const ROLE_KEYWORDS: Record<Role, string[]> = {
  // balance/deposit/withdraw 를 amount/date 보다 먼저 검사한다(부분일치 우선순위)
  balance: ["거래후잔액", "잔액"],
  deposit: ["맡기신금액", "입금액", "입금금액", "입금", "받으신금액"],
  withdraw: ["찾으신금액", "출금액", "출금금액", "출금", "보내신금액", "지급"],
  type: ["입출금구분", "입출구분", "거래구분", "구분", "대변구분"],
  amount: ["거래금액", "금액"],
  date: ["거래일시", "거래일자", "거래년월일", "거래일", "일자", "날짜"],
  desc: [
    "적요",
    "거래내용",
    "거래기록사항",
    "기재내용",
    "받는분",
    "보낸분",
    "받으신분",
    "보내신분",
    "의뢰인",
    "수취인",
    "상대계좌예금주",
    "내용",
    "메모",
    "비고",
  ],
};

const ROLE_ORDER: Role[] = [
  "balance",
  "deposit",
  "withdraw",
  "type",
  "amount",
  "date",
  "desc",
];

/** 헤더 셀 정규화 (공백·괄호·원화기호 제거, 소문자) */
function normHeader(cell: Cell): string {
  return String(cell ?? "")
    .replace(/\s+/g, "")
    .replace(/[()[\]]/g, "")
    .replace(/[₩원]/g, "")
    .toLowerCase();
}

/** 셀 하나가 어떤 역할인지 (없으면 null) */
function roleOf(cell: Cell): Role | null {
  const h = normHeader(cell);
  if (!h) return null;
  for (const role of ROLE_ORDER) {
    for (const kw of ROLE_KEYWORDS[role]) {
      if (h.includes(kw.toLowerCase())) return role;
    }
  }
  return null;
}

interface HeaderSpec {
  dateCol: number;
  descCols: number[];
  depositCol: number;
  withdrawCol: number;
  amountCol: number;
  typeCol: number;
}

const EMPTY_SPEC: HeaderSpec = {
  dateCol: -1,
  descCols: [],
  depositCol: -1,
  withdrawCol: -1,
  amountCol: -1,
  typeCol: -1,
};

/** 한 행을 헤더로 보고 컬럼 역할을 매핑 */
function mapHeaderRow(row: Row): HeaderSpec {
  const spec: HeaderSpec = { ...EMPTY_SPEC, descCols: [] };
  row.forEach((cell, i) => {
    switch (roleOf(cell)) {
      case "date":
        if (spec.dateCol === -1) spec.dateCol = i;
        break;
      case "desc":
        spec.descCols.push(i);
        break;
      case "deposit":
        if (spec.depositCol === -1) spec.depositCol = i;
        break;
      case "withdraw":
        if (spec.withdrawCol === -1) spec.withdrawCol = i;
        break;
      case "amount":
        if (spec.amountCol === -1) spec.amountCol = i;
        break;
      case "type":
        if (spec.typeCol === -1) spec.typeCol = i;
        break;
      default:
        break;
    }
  });
  return spec;
}

/** 헤더로 유효한지: 날짜 + (입출금 분리 or 단일 금액) */
function isUsableSpec(spec: HeaderSpec): boolean {
  const hasDate = spec.dateCol !== -1;
  const hasAmount =
    spec.amountCol !== -1 ||
    spec.depositCol !== -1 ||
    spec.withdrawCol !== -1;
  return hasDate && hasAmount;
}

/** 데이터의 헤더 행 index 탐지 (상단 20행 내). 없으면 -1 */
export function findHeaderRow(rows: Row[]): number {
  const limit = Math.min(rows.length, 20);
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < limit; i++) {
    const spec = mapHeaderRow(rows[i]);
    if (!isUsableSpec(spec)) continue;
    const score =
      (spec.dateCol !== -1 ? 1 : 0) +
      spec.descCols.length +
      (spec.depositCol !== -1 ? 1 : 0) +
      (spec.withdrawCol !== -1 ? 1 : 0) +
      (spec.amountCol !== -1 ? 1 : 0) +
      (spec.typeCol !== -1 ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

// ─── 값 파싱 ────────────────────────────────────────────────

/** 다양한 날짜 형식 → YYYY-MM-DD ('' 면 파싱 실패) */
export function parseDate(value: Cell): string {
  if (value == null || value === "") return "";

  // Excel 직렬 날짜(숫자) 대응
  if (typeof value === "number" && value > 25_000 && value < 80_000) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + Math.round(value) * 86_400_000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  const str = String(value).trim();
  // 시간 부분(HH:MM[:SS]) 이후 제거 — 날짜 내부 공백(YYYY년 M월 D일)은 보존
  const datePart = str.replace(/\d{1,2}:\d{2}(:\d{2})?.*$/, "").trim();

  const m = datePart.match(
    /(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/,
  );
  if (m) {
    return toISO(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  const m8 = datePart.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m8) {
    return toISO(Number(m8[1]), Number(m8[2]), Number(m8[3]));
  }
  return "";
}

function toISO(y: number, mo: number, d: number): string {
  const year = y < 100 ? 2000 + y : y;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${year}-${pad2(mo)}-${pad2(d)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "1,234,000원" / "(1,000)" / "-50000" → 정수(원). 빈값 0 */
export function parseAmount(value: Cell): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Math.round(value);

  const str = String(value).trim();
  if (!str) return 0;
  const negative = str.includes("-") || /^\(.*\)$/.test(str);
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;
  return Math.round(num) * (negative ? -1 : 1);
}

// ─── 트랜잭션 빌드 ──────────────────────────────────────────

function isBlankRow(row: Row): boolean {
  return row.every((c) => c == null || String(c).trim() === "");
}

function buildTransactions(
  rows: Row[],
  headerIdx: number,
  spec: HeaderSpec,
  bank: string,
): ParsedTransaction[] {
  const header = rows[headerIdx] ?? [];
  const labels = header.map((c, i) => String(c ?? "").trim() || `열${i + 1}`);
  const out: ParsedTransaction[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || isBlankRow(row)) continue;

    const tx_date = parseDate(row[spec.dateCol]);
    if (!tx_date) continue; // 합계행/안내행 등 날짜 없는 행 제외

    // 적요 합치기
    const description = spec.descCols
      .map((c) => String(row[c] ?? "").trim())
      .filter((s, i, arr) => s && arr.indexOf(s) === i)
      .join(" ")
      .trim();

    // 금액
    let amount: number;
    if (spec.depositCol !== -1 || spec.withdrawCol !== -1) {
      const dep = spec.depositCol !== -1 ? Math.abs(parseAmount(row[spec.depositCol])) : 0;
      const wd = spec.withdrawCol !== -1 ? Math.abs(parseAmount(row[spec.withdrawCol])) : 0;
      if (dep === 0 && wd === 0) continue;
      amount = dep - wd;
    } else if (spec.amountCol !== -1) {
      const val = parseAmount(row[spec.amountCol]);
      if (spec.typeCol !== -1) {
        const t = String(row[spec.typeCol] ?? "");
        if (/출금|출|지급|차변/.test(t)) amount = -Math.abs(val);
        else if (/입금|입|대변/.test(t)) amount = Math.abs(val);
        else amount = val;
      } else {
        amount = val;
      }
      if (amount === 0) continue;
    } else {
      continue;
    }

    const raw: Record<string, unknown> = {};
    labels.forEach((label, i) => {
      raw[label] = row[i] ?? "";
    });

    out.push({ tx_date, description, amount, bank, raw });
  }

  return out;
}

// ─── 공개 API ───────────────────────────────────────────────

/** 은행 자동 인식 (은행명 토큰 우선, 없으면 헤더 시그니처). 실패 시 null */
export function detectBank(rows: Row[]): BankId | null {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) return null;

  // 상단 영역 전체 텍스트 (은행명 토큰 탐색)
  const topText = rows
    .slice(0, Math.min(rows.length, headerIdx + 3))
    .flat()
    .map((c) => normHeader(c))
    .join("|");

  for (const p of BANK_PROFILES) {
    if (p.nameTokens.some((t) => topText.includes(t.toLowerCase()))) {
      return p.id;
    }
  }

  // 보조: 헤더 시그니처
  const headerNorm = rows[headerIdx].map((c) => normHeader(c));
  for (const p of BANK_PROFILES) {
    if (
      p.signature.every((sig) =>
        headerNorm.some((h) => h.includes(sig.toLowerCase())),
      )
    ) {
      return p.id;
    }
  }
  return null;
}

/**
 * 헤더 자동 탐지 + 파싱 (bank 라벨은 저장용 표시값).
 * PDF 재구성 표처럼 은행 시그니처가 안 맞아도 헤더만 잡히면 동작.
 */
export function parseRows(rows: Row[], bankLabel: string): ParsedTransaction[] {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) return [];
  const spec = mapHeaderRow(rows[headerIdx]);
  return buildTransactions(rows, headerIdx, spec, bankLabel);
}

/** 인식된 은행으로 파싱 */
export function parseBank(bank: BankId, rows: Row[]): ParsedTransaction[] {
  return parseRows(rows, bank);
}

/** 전체 텍스트(PDF 등)에서 은행명 토큰으로 은행 인식. 실패 시 null */
export function detectBankByText(text: string): BankId | null {
  const norm = text.replace(/\s+/g, "").toLowerCase();
  for (const p of BANK_PROFILES) {
    if (p.nameTokens.some((t) => norm.includes(t.toLowerCase()))) return p.id;
  }
  return null;
}

/** 사용자가 지정한 컬럼 매핑으로 파싱 */
export function parseWithMapping(
  rows: Row[],
  mapping: ColumnMapping,
): ParsedTransaction[] {
  const headerIdx =
    mapping.headerRow ?? (findHeaderRow(rows) === -1 ? 0 : findHeaderRow(rows));
  const descCols = Array.isArray(mapping.descCol)
    ? mapping.descCol
    : [mapping.descCol];
  const spec: HeaderSpec = {
    dateCol: mapping.dateCol,
    descCols: descCols.filter((c) => c >= 0),
    depositCol: mapping.depositCol ?? -1,
    withdrawCol: mapping.withdrawCol ?? -1,
    amountCol: mapping.amountCol ?? -1,
    typeCol: mapping.typeCol ?? -1,
  };
  return buildTransactions(rows, headerIdx, spec, "custom");
}

export interface ColumnCandidate {
  index: number;
  label: string;
}

export interface MappingHint {
  headerRowIndex: number;
  columns: ColumnCandidate[];
  preview: string[][];
}

/** 매핑 UI 용: 헤더 후보 컬럼 + 미리보기 행(최대 8) */
export function getColumnCandidates(rows: Row[]): MappingHint {
  const detected = findHeaderRow(rows);
  const headerRowIndex = detected === -1 ? 0 : detected;
  const header = rows[headerRowIndex] ?? [];
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);

  const columns: ColumnCandidate[] = [];
  for (let i = 0; i < colCount; i++) {
    const label = String(header[i] ?? "").trim() || `열 ${i + 1}`;
    columns.push({ index: i, label });
  }

  const preview = rows
    .slice(headerRowIndex + 1, headerRowIndex + 9)
    .filter((r) => !isBlankRow(r))
    .map((r) => {
      const arr: string[] = [];
      for (let i = 0; i < colCount; i++) arr.push(String(r[i] ?? ""));
      return arr;
    });

  return { headerRowIndex, columns, preview };
}
