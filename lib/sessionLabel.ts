/**
 * 회차/행사 표시 라벨 (클라이언트/서버 공용, server-only 아님).
 * 회차번호(number)가 없는 planned 행사는 행사명·일자로 폴백한다.
 */
import { SESSION_TYPE_LABEL } from "@/types";
import type { SessionType } from "@/types";
import { formatDate } from "@/lib/format";

interface LabelInput {
  number: number | null;
  name: string | null;
  type: SessionType;
  date_start: string;
}

/** 행사명(없으면 유형 라벨) */
function baseName(s: LabelInput): string {
  return s.name?.trim() || SESSION_TYPE_LABEL[s.type];
}

/** 짧은 라벨 — 교차표기 등. 예) "761차" / "괘방산 (2026. 1. 3)" */
export function sessionShortLabel(s: LabelInput): string {
  if (s.number != null) return `${s.number}차`;
  return `${baseName(s)} (${formatDate(s.date_start)})`;
}

/** 선택 목록용 라벨(장소 포함). 예) "761차 · 설악산" / "괘방산 · 2026. 1. 3 · 강릉" */
export function sessionPickerLabel(s: LabelInput & { location: string }): string {
  if (s.number != null) return `${s.number}차 · ${s.location}`;
  return `${baseName(s)} · ${formatDate(s.date_start)} · ${s.location}`;
}
