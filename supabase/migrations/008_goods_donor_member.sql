-- ============================================================
-- 총무야 — 물품찬조 찬조자 회원 연결
-- donor(text)는 외부인/비회원 폴백용으로 유지하고,
-- 회원이 찬조자면 member_id 로 연결한다. (둘 다 지원, member_id 우선)
-- ============================================================

alter table public.goods_donations
  add column if not exists member_id uuid
    references public.members(id) on delete set null;

create index if not exists idx_goods_member on public.goods_donations(member_id);
      