-- ============================================================
-- 총무야 — 행사 유형(session_types) 커스텀화
--
-- 유형을 코드 고정 대신 DB 테이블로 빼서 설정에서 추가/삭제/이름·색상 변경.
-- sessions.type 은 session_types.code 와 매칭(텍스트). 소프트삭제/이름변경
-- 유연성을 위해 FK 는 걸지 않고 code 텍스트로 느슨하게 연결한다.
--
-- uses_number=true 인 유형만 회차번호를 부여한다(산행 등). 회차번호 자동제안은
-- "같은 유형 중 최대 number + 1"로 일반화 — uses_number 유형이 여러 개여도 각각 카운트.
-- ============================================================

create table if not exists public.session_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- sessions.type 와 매칭되는 식별자
  name        text not null,                   -- 표시 유형명
  uses_number boolean not null default false,  -- 회차번호 부여 여부
  badge_color text not null default 'gray',    -- 목록 배지색 (blue|purple|gray|green|amber|red ...)
  is_system   boolean not null default false,  -- true 면 삭제 불가(이름·색상은 변경 가능)
  is_active   boolean not null default true,   -- 소프트 삭제 시 false
  sort_order  integer not null default 0
);
create index if not exists idx_session_types_active on public.session_types(is_active);

-- 시드(기본 유형). 산행만 uses_number=true
insert into public.session_types (code, name, uses_number, badge_color, is_system, sort_order) values
  ('hike',            '산행',     true,  'blue',   true, 10),
  ('general_meeting', '정기총회', false, 'purple', true, 20),
  ('regular_meeting', '정기모임', false, 'gray',   true, 30),
  ('sansanje',        '시산제',   false, 'green',  true, 40),
  ('travel',          '여행',     false, 'amber',  true, 50),
  ('flash',           '번개',     false, 'red',    true, 60)
on conflict (code) do nothing;

-- sessions.type 의 고정 CHECK 제거 (커스텀 code 허용)
alter table public.sessions drop constraint if exists sessions_type_check;

-- RLS + 권한 (001/007 정책과 동일)
alter table public.session_types enable row level security;
drop policy if exists session_types_auth_all on public.session_types;
create policy session_types_auth_all on public.session_types
  for all to authenticated using (true) with check (true);
grant all on public.session_types to anon, authenticated, service_role;
