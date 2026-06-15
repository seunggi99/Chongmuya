"use server";

import { revalidatePath } from "next/cache";
import {
  createMember,
  updateMember,
  changeMemberType,
  deactivateMember,
  reactivateMember,
  getMembers,
} from "@/lib/members";
import { type ActionResult, fail } from "@/lib/action-result";
import type { Member, MemberType } from "@/types";

/** 회원 관리 화면용 목록(비활성 포함, 가나다순) */
function editorMembers() {
  return getMembers({ includeInactive: true });
}

export async function addMemberAction(input: {
  name: string;
  type: MemberType;
  phone?: string | null;
  joinedAt?: string | null;
}): Promise<ActionResult<Member[]>> {
  try {
    await createMember(input);
    const list = await editorMembers();
    revalidatePath("/members");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMemberAction(
  id: string,
  fields: Partial<Pick<Member, "name" | "type" | "phone" | "joined_at">>,
): Promise<ActionResult<Member[]>> {
  try {
    await updateMember(id, fields);
    const list = await editorMembers();
    revalidatePath("/members");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

export async function changeMemberTypeAction(
  id: string,
  type: MemberType,
): Promise<ActionResult<Member[]>> {
  try {
    await changeMemberType(id, type);
    const list = await editorMembers();
    revalidatePath("/members");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

export async function deactivateMemberAction(
  id: string,
): Promise<ActionResult<Member[]>> {
  try {
    await deactivateMember(id);
    const list = await editorMembers();
    revalidatePath("/members");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

export async function reactivateMemberAction(
  id: string,
): Promise<ActionResult<Member[]>> {
  try {
    await reactivateMember(id);
    const list = await editorMembers();
    revalidatePath("/members");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}
