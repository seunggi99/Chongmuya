"use server";

import { getNextSessionNumber } from "@/lib/sessions";

/** 선택한 유형 기준 다음 회차번호 제안 (폼에서 유형 변경 시 호출) */
export async function getNextNumberAction(typeCode: string): Promise<number> {
  return getNextSessionNumber(typeCode);
}
