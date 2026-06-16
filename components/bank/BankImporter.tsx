"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Lock,
  RotateCcw,
} from "lucide-react";
import SetupNotice from "@/components/common/SetupNotice";
import type { BankTransaction } from "@/types";
import type { ColumnCandidate, ColumnMapping } from "@/lib/bankParsers";

const SELECT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

type AmountMode = "single" | "split";

interface MappingHint {
  headerRowIndex: number;
  columns: ColumnCandidate[];
  preview: string[][];
  detectedBank?: string;
}

type ImportResponse =
  | { status: "saved"; bank: string | null; count: number; transactions: BankTransaction[] }
  | ({ status: "need_mapping" } & MappingHint)
  | { status: "error"; error: string; needPassword?: boolean };

/** 라벨 키워드로 컬럼 자동 추측 */
function guessCol(columns: ColumnCandidate[], keywords: string[]): number {
  const found = columns.find((c) =>
    keywords.some((k) => c.label.replace(/\s/g, "").includes(k)),
  );
  return found ? found.index : -1;
}

export default function BankImporter({
  onImported,
  configured = true,
}: {
  onImported: (transactions: BankTransaction[]) => void;
  configured?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hint, setHint] = useState<MappingHint | null>(null);
  const [dragging, setDragging] = useState(false);
  // 잠긴 파일용 비밀번호 — 파싱 요청에만 쓰고 저장하지 않음(컴포넌트 상태)
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);

  // 매핑 폼 상태
  const [dateCol, setDateCol] = useState(-1);
  const [descCol, setDescCol] = useState(-1);
  const [amountMode, setAmountMode] = useState<AmountMode>("split");
  const [amountCol, setAmountCol] = useState(-1);
  const [depositCol, setDepositCol] = useState(-1);
  const [withdrawCol, setWithdrawCol] = useState(-1);

  if (!configured) {
    return <SetupNotice message="은행 거래내역 가져오기는 Supabase 연결 후 사용할 수 있습니다." />;
  }

  async function upload(theFile: File, mapping: ColumnMapping | null) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append("file", theFile);
      if (mapping) fd.append("mapping", JSON.stringify(mapping));
      if (password) fd.append("password", password);

      const res = await fetch("/api/bank-import", { method: "POST", body: fd });
      const data = (await res.json()) as ImportResponse;

      if (data.status === "saved") {
        setHint(null);
        setFile(null);
        setNeedPassword(false);
        setPassword(""); // 사용 후 폐기
        setSuccess(`${data.count}건의 거래를 가져왔습니다.`);
        onImported(data.transactions);
      } else if (data.status === "need_mapping") {
        setHint(data);
        // 자동 추측
        setDateCol(guessCol(data.columns, ["거래일", "일자", "날짜"]));
        setDescCol(guessCol(data.columns, ["적요", "내용", "보낸", "받는", "기재"]));
        const dep = guessCol(data.columns, ["입금", "맡기신"]);
        const wd = guessCol(data.columns, ["출금", "찾으신"]);
        if (dep !== -1 || wd !== -1) {
          setAmountMode("split");
          setDepositCol(dep);
          setWithdrawCol(wd);
        } else {
          setAmountMode("single");
          setAmountCol(guessCol(data.columns, ["거래금액", "금액"]));
        }
      } else {
        setError(data.error);
        if (data.needPassword) {
          setNeedPassword(true);
          // 비밀번호 입력으로 유도
          setTimeout(() => pwRef.current?.focus(), 0);
        }
      }
    } catch {
      setError("업로드 중 오류가 발생했습니다. 네트워크를 확인하세요.");
    } finally {
      setLoading(false);
    }
  }

  function handleFile(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
    upload(f, null);
  }

  function confirmMapping() {
    if (!file || !hint) return;
    if (dateCol < 0) {
      setError("날짜 열을 선택하세요.");
      return;
    }
    if (amountMode === "single" && amountCol < 0) {
      setError("금액 열을 선택하세요.");
      return;
    }
    if (amountMode === "split" && depositCol < 0 && withdrawCol < 0) {
      setError("입금 또는 출금 열을 1개 이상 선택하세요.");
      return;
    }
    const mapping: ColumnMapping = {
      headerRow: hint.headerRowIndex,
      dateCol,
      descCol: descCol >= 0 ? descCol : [],
      ...(amountMode === "single"
        ? { amountCol }
        : { depositCol: depositCol >= 0 ? depositCol : undefined, withdrawCol: withdrawCol >= 0 ? withdrawCol : undefined }),
    };
    upload(file, mapping);
  }

  return (
    <div className="space-y-4">
      {/* 업로드 존 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={[
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-primary bg-light" : "border-gray-200",
        ].join(" ")}
      >
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : (
          <Upload className="h-7 w-7 text-gray-300" strokeWidth={1.5} />
        )}
        <p className="mt-3 text-sm text-gray-600">
          은행 거래내역 파일을 끌어다 놓거나
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          <FileSpreadsheet className="h-4 w-4" />
          파일 선택
        </button>
        <p className="mt-2 text-xs text-gray-400">
          .xlsx · .xls · .csv · .pdf (거래내역증명서)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* 파일 비밀번호 (선택) — 잠긴 거래내역증명서용 */}
      <div
        className={[
          "rounded-xl border p-4",
          needPassword ? "border-amber-300 bg-amber-50/50" : "border-gray-100",
        ].join(" ")}
      >
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Lock className="h-3.5 w-3.5 text-gray-400" />
          파일 비밀번호 <span className="text-gray-400">(선택)</span>
        </label>
        <p className="mt-0.5 text-xs text-gray-400">
          은행 거래내역증명서가 비밀번호(보통 생년월일)로 잠겨 있으면 입력하세요.
          가져오기에만 1회 쓰이며 저장되지 않습니다.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            ref={pwRef}
            type="password"
            value={password}
            autoComplete="off"
            placeholder="잠긴 파일이 아니면 비워 두세요"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && file && !loading) upload(file, null);
            }}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {needPassword && file && (
            <button
              type="button"
              onClick={() => upload(file, null)}
              disabled={loading || !password}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              다시 시도
            </button>
          )}
        </div>
      </div>

      {success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-income">
          {success}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-expense">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* 컬럼 매핑 (자동 인식 실패 시) */}
      {hint && (
        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              은행 양식을 자동 인식하지 못했습니다
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              날짜·적요·금액 열을 직접 지정해 주세요.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="날짜 열">
              <select
                value={dateCol}
                onChange={(e) => setDateCol(Number(e.target.value))}
                className={SELECT_CLS}
              >
                <ColOptions columns={hint.columns} />
              </select>
            </Labeled>
            <Labeled label="적요 열">
              <select
                value={descCol}
                onChange={(e) => setDescCol(Number(e.target.value))}
                className={SELECT_CLS}
              >
                <ColOptions columns={hint.columns} allowNone />
              </select>
            </Labeled>
          </div>

          {/* 금액 형식 */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">
              금액 형식
            </span>
            <div className="mb-2 flex gap-2 text-sm">
              <ModeButton
                active={amountMode === "split"}
                onClick={() => setAmountMode("split")}
              >
                입금·출금 분리
              </ModeButton>
              <ModeButton
                active={amountMode === "single"}
                onClick={() => setAmountMode("single")}
              >
                단일 금액
              </ModeButton>
            </div>
            {amountMode === "single" ? (
              <Labeled label="금액 열">
                <select
                  value={amountCol}
                  onChange={(e) => setAmountCol(Number(e.target.value))}
                  className={SELECT_CLS}
                >
                  <ColOptions columns={hint.columns} />
                </select>
              </Labeled>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="입금 열">
                  <select
                    value={depositCol}
                    onChange={(e) => setDepositCol(Number(e.target.value))}
                    className={SELECT_CLS}
                  >
                    <ColOptions columns={hint.columns} allowNone />
                  </select>
                </Labeled>
                <Labeled label="출금 열">
                  <select
                    value={withdrawCol}
                    onChange={(e) => setWithdrawCol(Number(e.target.value))}
                    className={SELECT_CLS}
                  >
                    <ColOptions columns={hint.columns} allowNone />
                  </select>
                </Labeled>
              </div>
            )}
          </div>

          {/* 미리보기 */}
          {hint.preview.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-400">
                    {hint.columns.map((c) => (
                      <th key={c.index} className="px-2 py-1.5 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hint.preview.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-b border-gray-50">
                      {hint.columns.map((c) => (
                        <td key={c.index} className="whitespace-nowrap px-2 py-1.5 text-gray-600">
                          {row[c.index] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            onClick={confirmMapping}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            이 설정으로 가져오기
          </button>
        </div>
      )}
    </div>
  );
}

function ColOptions({
  columns,
  allowNone,
}: {
  columns: ColumnCandidate[];
  allowNone?: boolean;
}) {
  return (
    <>
      <option value={-1}>{allowNone ? "선택 안 함" : "열 선택"}</option>
      {columns.map((c) => (
        <option key={c.index} value={c.index}>
          {c.label}
        </option>
      ))}
    </>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-1.5 transition-colors",
        active
          ? "border-primary bg-light font-semibold text-primary"
          : "border-gray-200 text-gray-600 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
