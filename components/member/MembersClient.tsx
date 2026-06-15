"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Search,
  UserPlus,
  Check,
  RotateCcw,
  UserMinus,
  Loader2,
} from "lucide-react";
import Badge from "@/components/common/Badge";
import AddMemberModal from "@/components/member/AddMemberModal";
import { formatDate } from "@/lib/format";
import {
  changeMemberTypeAction,
  deactivateMemberAction,
  reactivateMemberAction,
} from "@/app/members/actions";
import type { Member, MemberType } from "@/types";

export default function MembersClient({
  initialMembers,
  paidMemberIds,
  yearLabel,
}: {
  initialMembers: Member[];
  paidMemberIds: string[];
  yearLabel: string;
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const paidSet = useMemo(() => new Set(paidMemberIds), [paidMemberIds]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return members;
    return members.filter((m) => m.name.includes(q));
  }, [members, search]);

  const activeCount = members.filter((m) => m.is_active).length;

  function run(id: string, action: () => Promise<{ ok: boolean; data?: Member[]; error?: string }>) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await action();
      if (res.ok && res.data) setMembers(res.data);
      else if (!res.ok) setError(res.error ?? "오류가 발생했습니다.");
      setPendingId(null);
    });
  }

  function handleTypeChange(m: Member, type: MemberType) {
    if (type === m.type) return;
    run(m.id, () => changeMemberTypeAction(m.id, type));
  }

  function handleDeactivate(m: Member) {
    if (!confirm(`'${m.name}' 회원을 비활성 처리할까요?`)) return;
    run(m.id, () => deactivateMemberAction(m.id));
  }

  function handleReactivate(m: Member) {
    run(m.id, () => reactivateMemberAction(m.id));
  }

  return (
    <div className="space-y-4">
      {/* 검색 + 추가 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 검색"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          신규 추가
        </button>
      </div>

      <p className="text-sm text-gray-500">
        활성 {activeCount}명 · 전체 {members.length}명 · 연회비 기준 {yearLabel}
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-expense">
          {error}
        </p>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">등급</th>
              <th className="px-4 py-3 font-medium">전화</th>
              <th className="px-4 py-3 font-medium">가입일</th>
              <th className="px-4 py-3 font-medium">연회비 {yearLabel}</th>
              <th className="px-4 py-3 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((m) => {
              const dim = !m.is_active;
              const paid = paidSet.has(m.id);
              const rowBusy = pending && pendingId === m.id;
              return (
                <tr
                  key={m.id}
                  className={dim ? "opacity-50" : ""}
                >
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={m.type}
                      disabled={rowBusy}
                      onChange={(e) =>
                        handleTypeChange(m, e.target.value as MemberType)
                      }
                      className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="member">회원</option>
                      <option value="general">일반회원</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.joined_at ? formatDate(m.joined_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {paid ? (
                      <Badge color="green">
                        <Check className="h-3 w-3" />
                        완납
                      </Badge>
                    ) : (
                      <Badge color="gray">미납</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {rowBusy && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
                      )}
                      {m.is_active ? (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(m)}
                          disabled={rowBusy}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:border-expense hover:text-expense disabled:opacity-50"
                        >
                          <UserMinus className="h-3 w-3" />
                          비활성
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(m)}
                          disabled={rowBusy}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" />
                          복구
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  {search
                    ? "검색 결과가 없습니다."
                    : "등록된 회원이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddMemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={setMembers}
      />
    </div>
  );
}
