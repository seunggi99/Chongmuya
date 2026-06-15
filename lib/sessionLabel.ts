/**
 * 회차/행사 표시 라벨 (클라이언트/서버 공용, server-only 아님).
 *
 * 규칙: **산행(hike)만 회차번호**를 부여한다(740→741→…).
 *  - 산행 + number 있음 → "제740차 산행" / 짧게 "740차"
 *  - 그 외(정기총회·정기모임·시산제·여행·번개) 또는 번호 없는 산행
 *    → "YYMM 유형" (원본 엑셀 시트명 방식). 예) 2025.6 정기총회 → "2506 정기총회"
 */
import { SESSION_TYPE_LABEL } from "@/types";
import type { SessionType } from "@/types";

interface LabelInput {
  number: number | null;
  name: string | null;
  type: SessionType;
  date_start: string; // YYYY-MM-DD
}

/** 행사명(없으면 유형 라벨) */
function baseName(s: LabelInput): string {
  return s.name?.trim() || SESSION_TYPE_LABEL[s.type];
}

/** "2025-06-06" → "2506" (YY + MM) */
function yymm(dateStart: string): string {
  return `${dateStart.slice(2, 4)}${dateStart.slice(5, 7)}`;
}

/** 산행이면서 회차번호가 있는지 */
function isHikeNumbered(s: LabelInput): boolean {
  return s.type === "hike" && s.number != null;
}

/** 제목용. 예) "제740차 산행" / "2506 정기총회" */
export function sessionTitle(s: LabelInput): string {
  return isHikeNumbered(s)
    ? `제${s.number}차 ${baseName(s)}`
    : `${yymm(s.date_start)} ${baseName(s)}`;
}

/** 짧은 라벨 — 교차표기 등. 예) "740차" / "2509 정기모임" */
export function sessionShortLabel(s: LabelInput): string {
  return isHikeNumbered(s) ? `${s.number}차` : `${yymm(s.date_start)} ${baseName(s)}`;
}

/** 선택 목록용 라벨(장소 포함). 예) "740차 · 설악산" / "2509 정기모임 · 강릉" */
export function sessionPickerLabel(s: LabelInput & { location: string }): string {
  return `${sessionShortLabel(s)} · ${s.location}`;
}

/** 내보내기 파일명 베이스. 예) "일지_740차_20250606" / "일지_2509정기모임_20250906" */
export function sessionFileBase(s: LabelInput): string {
  const label = sessionShortLabel(s).replace(/\s+/g, "");
  return `일지_${label}_${s.date_start.replace(/-/g, "")}`;
}
