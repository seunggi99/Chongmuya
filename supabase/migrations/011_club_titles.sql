-- ============================================================
-- 총무야 — 결제란 직책명 커스텀 (모임마다 다를 수 있음)
-- 결제란/폼의 "총무"/"회장" 직책을 설정에서 바꿀 수 있게 한다.
-- (회계/대표 등). 기본값은 총무/회장.
-- ============================================================

alter table public.club_settings
  add column if not exists treasurer_title text not null default '총무';
alter table public.club_settings
  add column if not exists chairperson_title text not null default '회장';
