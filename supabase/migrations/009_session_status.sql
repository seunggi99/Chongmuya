-- ============================================================
-- 총무야 — 행사/일지 상태 + 행사명 + 회차번호 nullable
--
-- 설계: 행사를 별도 테이블로 두지 않고 sessions 의 "초기 상태"로 둔다.
--   - status='planned'  : 행사만 등록(기본정보만, 수입/지출 없음)
--   - status='completed': 일지까지 작성 완료
-- 이렇게 하면 미래 행사가 sessions 에 미리 존재 → cross_session_id 로
-- 선입금/선지급(교차) 연결이 자연스러워진다.
--
-- 기존 행은 모두 completed 로 본다(default 'completed').
-- 회차번호는 행사 등록 시 미정일 수 있으므로 nullable 로 변경(일지 작성 시 확정).
-- ============================================================

alter table public.sessions
  add column if not exists status text not null default 'completed'
    check (status in ('planned', 'completed'));

alter table public.sessions
  add column if not exists name text; -- 행사명 (없으면 유형 라벨로 대체 표시)

-- 회차번호 nullable (unique 제약은 유지 — Postgres 는 NULL 을 서로 구별)
alter table public.sessions
  alter column number drop not null;

create index if not exists idx_sessions_status on public.sessions(status);
create index if not exists idx_sessions_date_start on public.sessions(date_start);
