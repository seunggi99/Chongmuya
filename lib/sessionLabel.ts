/**
 * 회차/행사 표시 라벨 (클라이언트/서버 공용, server-only 아님).
 *
 * 유형(session_types)은 커스텀 가능하므로, 라벨 계산에 유형 목록(types)을 받아
 * 유형명·uses_number 를 조회한다. (types 미전달/미존재 시 기본 라벨·hike 규칙 폴백)
 *
 * 규칙: uses_number=true 유형만 회차번호를 부여 → "제740차 산행" / "740차".
 *  그 외(또는 번호 없음)는 "YYMM 유형" (원본 시트명 방식). 예) "2506 정기총회".
 */
import { SESSION_TYPE_LABEL } from "@/types";
import type { SessionTypeRow } from "@/types";

interface LabelInput {
  number: number | null;
  name: string | null;
  type: string;
  date_start: string; // YYYY-MM-DD
}

interface ResolvedType {
  name: string;
  usesNumber: boolean;
}

/** 유형 코드 → {유형명, uses_number}. 없으면 기본 라벨·hike 규칙 폴백 */
function resolveType(code: string, types?: SessionTypeRow[]): ResolvedType {
  const t = types?.find((x) => x.code === code);
  if (t) return { name: t.name, usesNumber: t.uses_number };
  return { name: SESSION_TYPE_LABEL[code] ?? code, usesNumber: code === "hike" };
}

/** 행사명(없으면 유형명) */
function baseName(s: LabelInput, types?: SessionTypeRow[]): string {
  return s.name?.trim() || resolveType(s.type, types).name;
}

/** "2025-06-06" → "2506" (YY + MM) */
function yymm(dateStart: string): string {
  return `${dateStart.slice(2, 4)}${dateStart.slice(5, 7)}`;
}

/** 회차번호 부여 유형이면서 번호가 있는지 */
function isNumbered(s: LabelInput, types?: SessionTypeRow[]): boolean {
  return resolveType(s.type, types).usesNumber && s.number != null;
}

/** 제목용. 예) "제740차 산행" / "2506 정기총회" */
export function sessionTitle(s: LabelInput, types?: SessionTypeRow[]): string {
  return isNumbered(s, types)
    ? `제${s.number}차 ${baseName(s, types)}`
    : `${yymm(s.date_start)} ${baseName(s, types)}`;
}

/** 짧은 라벨 — 교차표기 등. 예) "740차" / "2509 정기모임" */
export function sessionShortLabel(
  s: LabelInput,
  types?: SessionTypeRow[],
): string {
  return isNumbered(s, types)
    ? `${s.number}차`
    : `${yymm(s.date_start)} ${baseName(s, types)}`;
}

/** 선택 목록용 라벨(장소 포함). 예) "740차 · 설악산" / "2509 정기모임 · 강릉" */
export function sessionPickerLabel(
  s: LabelInput & { location: string },
  types?: SessionTypeRow[],
): string {
  return `${sessionShortLabel(s, types)} · ${s.location}`;
}

/** 내보내기 파일명 베이스. 예) "일지_740차_20250606" / "일지_2509정기모임_20250906" */
export function sessionFileBase(s: LabelInput, types?: SessionTypeRow[]): string {
  const label = sessionShortLabel(s, types).replace(/\s+/g, "");
  return `일지_${label}_${s.date_start.replace(/-/g, "")}`;
}

/** 유형 코드 → 유형명 (배지/표시용) */
export function typeName(code: string, types?: SessionTypeRow[]): string {
  return resolveType(code, types).name;
}

/** 유형 코드 → uses_number */
export function typeUsesNumberLocal(
  code: string,
  types?: SessionTypeRow[],
): boolean {
  return resolveType(code, types).usesNumber;
}
