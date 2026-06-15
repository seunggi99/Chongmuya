-- ============================================================
-- 총무야 — categories 소프트 삭제 지원
-- 사용 중인 분류는 하드 삭제 대신 is_active=false 로 비활성 처리.
-- ============================================================

alter table public.categories
  add column if not exists is_active boolean not null default true;

-- 입력용 활성 분류 조회 최적화
create index if not exists idx_categories_active
  on public.categories(kind, is_active, sort_order);
