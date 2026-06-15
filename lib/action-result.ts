/** 서버 액션 공통 반환 타입 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** 예외를 ActionResult 실패로 변환 */
export function fail(e: unknown): { ok: false; error: string } {
  return {
    ok: false,
    error: e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.",
  };
}
