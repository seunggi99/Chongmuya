-- ============================================================
-- 총무야 — 모임 기본정보 (club_settings)
-- 단일 모임 도구이므로 한 행(싱글톤)만 존재한다. id=1 로 고정.
-- ============================================================

create table if not exists public.club_settings (
  id                  smallint primary key default 1 check (id = 1),
  club_name           text not null default '우리 모임',
  default_chairperson text,        -- 일지 작성 시 회장 기본값
  default_treasurer   text,        -- 일지 작성 시 총무 기본값
  updated_at          timestamptz not null default now()
);

-- 싱글톤 행 보장
insert into public.club_settings (id) values (1)
on conflict (id) do nothing;

-- updated_at 자동 갱신 (001 의 touch_updated_at 재사용)
drop trigger if exists trg_club_settings_touch on public.club_settings;
create trigger trg_club_settings_touch
  before update on public.club_settings
  for each row execute function public.touch_updated_at();

-- RLS: 로그인 사용자 전체 허용 (001 과 동일 정책)
alter table public.club_settings enable row level security;
drop policy if exists club_settings_auth_all on public.club_settings;
create policy club_settings_auth_all on public.club_settings
  for all to authenticated using (true) with check (true);
