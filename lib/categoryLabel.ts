/**
 * 특수 분류(special) 의 표시명 조회 (클라이언트/서버 공용).
 * 분류는 설정에서 이름을 바꿀 수 있으므로, 하드코딩 대신 categories 에서 찾는다.
 * 없으면 fallback.
 */
import type { CategorySpecial } from "@/types";

interface SpecialCat {
  name: string;
  special: CategorySpecial;
}

export function specialCategoryName(
  categories: SpecialCat[],
  special: Exclude<CategorySpecial, null>,
  fallback: string,
): string {
  return categories.find((c) => c.special === special)?.name ?? fallback;
}
