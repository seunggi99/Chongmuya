"use server";

import { revalidatePath } from "next/cache";
import { createEventSession, getCalendarSessions } from "@/lib/sessions";
import { type ActionResult, fail } from "@/lib/action-result";
import type { Session, SessionType } from "@/types";

/** 행사 등록 (status='planned' session 생성) → 갱신된 달력 목록 반환 */
export async function createEventAction(input: {
  name: string | null;
  type: SessionType;
  location: string;
  date_start: string;
  date_end: string | null;
  number: number | null;
}): Promise<ActionResult<Session[]>> {
  try {
    await createEventSession(input);
    const list = await getCalendarSessions();
    revalidatePath("/events");
    revalidatePath("/");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}
