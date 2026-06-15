"use server";

import { revalidatePath } from "next/cache";
import {
  recordDue,
  deleteDue,
  getDuesStatus,
  getDuesRate,
} from "@/lib/dues";
import { type ActionResult, fail } from "@/lib/action-result";
import type { DuesRate, DuesStatusRow } from "@/types";

export interface DuesYearData {
  status: DuesStatusRow[];
  rate: DuesRate;
}

async function yearData(yearLabel: string): Promise<DuesYearData> {
  const [status, rate] = await Promise.all([
    getDuesStatus(yearLabel),
    getDuesRate(yearLabel),
  ]);
  return { status, rate };
}

/** 특정 연도 현황 조회 (탭 전환용) */
export async function getDuesForYearAction(
  yearLabel: string,
): Promise<ActionResult<DuesYearData>> {
  try {
    return { ok: true, data: await yearData(yearLabel) };
  } catch (e) {
    return fail(e);
  }
}

/** 수동 납부 등록 → 해당 연도 최신 현황 반환 */
export async function recordDueAction(input: {
  memberId: string;
  yearLabel: string;
  amount: number;
  paidAt: string;
}): Promise<ActionResult<DuesYearData>> {
  try {
    await recordDue(input.memberId, input.yearLabel, input.amount, input.paidAt);
    const data = await yearData(input.yearLabel);
    revalidatePath("/dues");
    revalidatePath("/members");
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** 납부 취소 → 해당 연도 최신 현황 반환 */
export async function deleteDueAction(
  id: string,
  yearLabel: string,
): Promise<ActionResult<DuesYearData>> {
  try {
    await deleteDue(id);
    const data = await yearData(yearLabel);
    revalidatePath("/dues");
    revalidatePath("/members");
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}
