"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  renameCategory,
  deleteCategory,
  reactivateCategory,
  reorderCategories,
  getCategoriesByKind,
  updateClubSettings,
} from "@/lib/categories";
import type { Category, CategoryKind, ClubSettings } from "@/types";
import { type ActionResult, fail } from "@/lib/action-result";

/** 설정 편집 화면용 목록은 비활성 분류도 포함해서 반환 */
function editorList(kind: CategoryKind) {
  return getCategoriesByKind(kind, { includeInactive: true });
}

/** 분류 추가 → 해당 kind 의 최신 목록 반환 */
export async function addCategoryAction(
  kind: CategoryKind,
  name: string,
): Promise<ActionResult<Category[]>> {
  try {
    await createCategory(kind, name);
    const list = await editorList(kind);
    revalidatePath("/settings");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

/** 분류 이름 변경 → 해당 kind 의 최신 목록 반환 */
export async function renameCategoryAction(
  id: string,
  kind: CategoryKind,
  name: string,
): Promise<ActionResult<Category[]>> {
  try {
    await renameCategory(id, name);
    const list = await editorList(kind);
    revalidatePath("/settings");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 분류 삭제 → 최신 목록 + 소프트 삭제 안내.
 * 사용 중이면 비활성 처리되며 notice 메시지를 함께 반환.
 */
export async function deleteCategoryAction(
  id: string,
  kind: CategoryKind,
): Promise<ActionResult<{ list: Category[]; notice: string | null }>> {
  try {
    const result = await deleteCategory(id);
    const list = await editorList(kind);
    revalidatePath("/settings");
    const notice =
      result.mode === "soft"
        ? `이 분류를 쓰는 일지 ${result.count}건이 있어 비활성 처리됐습니다.`
        : null;
    return { ok: true, data: { list, notice } };
  } catch (e) {
    return fail(e);
  }
}

/** 비활성 분류 복구 → 해당 kind 의 최신 목록 반환 */
export async function reactivateCategoryAction(
  id: string,
  kind: CategoryKind,
): Promise<ActionResult<Category[]>> {
  try {
    await reactivateCategory(id);
    const list = await editorList(kind);
    revalidatePath("/settings");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

/** 분류 정렬 변경 → 해당 kind 의 최신 목록 반환 */
export async function reorderCategoriesAction(
  kind: CategoryKind,
  orderedIds: string[],
): Promise<ActionResult<Category[]>> {
  try {
    await reorderCategories(orderedIds);
    const list = await editorList(kind);
    revalidatePath("/settings");
    return { ok: true, data: list };
  } catch (e) {
    return fail(e);
  }
}

/** 모임 기본정보 저장 */
export async function saveClubInfoAction(input: {
  club_name: string;
  default_chairperson: string | null;
  default_treasurer: string | null;
}): Promise<ActionResult<ClubSettings>> {
  try {
    const settings = await updateClubSettings(input);
    revalidatePath("/settings");
    return { ok: true, data: settings };
  } catch (e) {
    return fail(e);
  }
}
