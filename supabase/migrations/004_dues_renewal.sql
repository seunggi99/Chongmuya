-- ============================================================
-- 총무야 — 연회비 갱신월 / 기본금액 설정
-- year_label 계산 기준이 되는 갱신월과, 납부 등록 기본 금액.
-- ============================================================

alter table public.club_settings
  add column if not exists dues_renewal_month integer not null default 3
    check (dues_renewal_month between 1 and 12);

alter table public.club_settings
  add column if not exists default_due_amount bigint not null default 100000;
