-- ============================================================
-- 총무야 (chongmuya) 초기 스키마
-- 금액은 모두 정수(원) — bigint. 표시할 때만 포맷.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── members (회원) ─────────────────────────────────────────
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('member','general')),
  phone       text,
  joined_at   date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── categories (분류 — 커스텀 가능) ────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('income','expense')),
  is_system   boolean not null default false,
  special     text check (special in ('daily_fee','donation','annual_dues')),
  sort_order  integer not null default 0
);

-- ─── sessions (회차) ────────────────────────────────────────
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  number      integer not null unique,
  type        text not null check (type in
                ('hike','general_meeting','regular_meeting','sansanje','travel','flash')),
  location    text not null,
  date_start  date not null,
  date_end    date,
  fee_per_person integer not null default 0,
  note        text,
  chairperson text,
  treasurer   text,
  carry_over  bigint not null default 0,
  is_manual_carry_over boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_sessions_number on public.sessions(number);

-- ─── bank_transactions (업로드된 은행 거래) ─────────────────
-- entries 가 참조하므로 먼저 생성
create table if not exists public.bank_transactions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references public.sessions(id) on delete set null,
  tx_date     date not null,
  description text not null,
  amount      bigint not null,                 -- 입금 양수, 출금 음수
  bank        text,
  is_used     boolean not null default false,
  raw         jsonb
);
create index if not exists idx_bank_tx_session on public.bank_transactions(session_id);

-- ─── session_attendees (참석자) ─────────────────────────────
create table if not exists public.session_attendees (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  member_type_snapshot text not null check (member_type_snapshot in ('member','general'))
);
create index if not exists idx_attendees_session on public.session_attendees(session_id);

-- ─── entries (수입·지출 항목 — 분류 단위) ───────────────────
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  kind        text not null check (kind in ('income','expense')),
  category_id uuid references public.categories(id) on delete set null,
  amount      bigint not null,                 -- entry_details 합과 일치
  cross_session_id uuid references public.sessions(id) on delete set null,
  bank_tx_id  uuid references public.bank_transactions(id) on delete set null,
  sort_order  integer not null default 0
);
create index if not exists idx_entries_session on public.entries(session_id);
create index if not exists idx_entries_cross on public.entries(cross_session_id);

-- ─── entry_details (상세항목) ───────────────────────────────
create table if not exists public.entry_details (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries(id) on delete cascade,
  label       text not null,
  amount      bigint not null,
  receipt_url text,
  sort_order  integer not null default 0
);
create index if not exists idx_details_entry on public.entry_details(entry_id);

-- ─── entry_members (분류-회원 연결: 당일회비/찬조/연회비) ───
create table if not exists public.entry_members (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade
);
create index if not exists idx_entry_members_entry on public.entry_members(entry_id);

-- ─── goods_donations (물품 찬조 — 금액 없음) ────────────────
create table if not exists public.goods_donations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  item        text not null,
  donor       text
);
create index if not exists idx_goods_session on public.goods_donations(session_id);

-- ─── annual_dues (연회비 납부) ──────────────────────────────
create table if not exists public.annual_dues (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  session_id  uuid references public.sessions(id) on delete set null,
  year_label  text not null,                   -- '25~26'
  amount      bigint not null default 100000,
  paid_at     date not null,
  note        text
);
create index if not exists idx_dues_member on public.annual_dues(member_id);
create index if not exists idx_dues_year on public.annual_dues(year_label);

-- ─── updated_at 자동 갱신 트리거 ────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_sessions_touch on public.sessions;
create trigger trg_sessions_touch
  before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- 단일 모임 내부 도구이므로, 로그인한 사용자(authenticated)는
-- 모든 데이터에 읽기/쓰기가 가능하도록 한다.
-- (멀티 테넌트가 필요해지면 org_id 컬럼 + 정책으로 확장)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'members','categories','sessions','session_attendees',
    'entries','entry_details','entry_members','goods_donations',
    'annual_dues','bank_transactions'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_auth_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_auth_all', t
    );
  end loop;
end $$;

-- ============================================================
-- 시드: 기본 분류
-- ============================================================
-- 지출 분류
insert into public.categories (name, kind, is_system, special, sort_order) values
  ('버스/교통', 'expense', false, null, 10),
  ('식비',      'expense', false, null, 20),
  ('숙박',      'expense', false, null, 30),
  ('입장료',    'expense', false, null, 40),
  ('커피/간식', 'expense', false, null, 50),
  ('선물',      'expense', false, null, 60),
  ('경조사비',  'expense', false, null, 70),
  ('2차모임',   'expense', false, null, 80),
  ('기타',      'expense', false, null, 90)
on conflict do nothing;

-- 수입 분류 (당일회비/찬조/연회비는 system + special)
insert into public.categories (name, kind, is_system, special, sort_order) values
  ('당일회비', 'income', true,  'daily_fee',   10),
  ('찬조',     'income', true,  'donation',    20),
  ('연회비',   'income', true,  'annual_dues', 30),
  ('은행이자', 'income', false, null,          40),
  ('기타',     'income', false, null,          50)
on conflict do nothing;
