-- ============================================================
-- 총무야 — 영수증 저장용 Storage 버킷
-- entry_details.receipt_url 이 가리키는 공개 버킷.
-- 업로드는 서버(service_role)에서만 수행하므로 별도 INSERT 정책 불필요.
-- 공개(public=true)라 누구나 URL 로 조회 가능.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;
