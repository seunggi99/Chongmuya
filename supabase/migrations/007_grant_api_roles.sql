-- ============================================================
-- 총무야 — API 역할(anon/authenticated/service_role) 테이블 권한 부여
--
-- 증상: 모든 쿼리가 42501 "permission denied for table ..." 로 거부.
--       (RLS 정책은 있으나 테이블 GRANT 가 없어 발생)
-- 원인: Supabase 기본 default privileges 가 적용되지 않은 프로젝트에서
--       마이그레이션으로 만든 테이블에 역할 GRANT 가 누락됨.
-- 효과: service_role(서버), anon/authenticated(클라이언트) 가 public 스키마
--       테이블/시퀀스에 접근 가능. 행 단위 접근은 기존 RLS 정책이 계속 통제.
-- 여러 번 실행해도 안전(idempotent).
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- 기존 테이블/시퀀스 권한
grant all on all tables in schema public
  to anon, authenticated, service_role;
grant all on all sequences in schema public
  to anon, authenticated, service_role;

-- 앞으로 생성될 테이블/시퀀스에도 자동 부여
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
