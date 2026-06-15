"use server";

import { revalidatePath } from "next/cache";
import { deleteSessionById } from "@/lib/sessionsSave";
import { type ActionResult, fail } from "@/lib/action-result";

/** 일지 삭제 (성공 시 목록·대시보드 갱신) */
export async function deleteSessionAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await deleteSessionById(id);
    revalidatePath("/sessions");
    revalidatePath("/");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
