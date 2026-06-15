"use client";

import { Plus, X, Gift } from "lucide-react";
import { emptyGoods } from "@/lib/sessionDraft";
import type { GoodsDonationDraft, Member } from "@/types";

const INPUT_CLS =
  "rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary";

// 회원 선택 드롭다운에서 "직접 입력"을 뜻하는 값
const MANUAL = "__manual__";

/**
 * 물품 찬조 입력 (금액 없음). 품목 + 찬조자.
 * 찬조자는 회원 선택(member_id) 또는 직접 입력(donor 텍스트) 둘 다 지원.
 * 전체 배열을 onChange 로 돌려준다.
 */
export default function GoodsDonation({
  items,
  members,
  onChange,
}: {
  items: GoodsDonationDraft[];
  members: Member[];
  onChange: (items: GoodsDonationDraft[]) => void;
}) {
  function add() {
    onChange([...items, emptyGoods()]);
  }
  function remove(uid: string) {
    onChange(items.filter((g) => g.uid !== uid));
  }
  function set(uid: string, patch: Partial<GoodsDonationDraft>) {
    onChange(items.map((g) => (g.uid === uid ? { ...g, ...patch } : g)));
  }

  function selectDonor(uid: string, value: string) {
    if (value === MANUAL || value === "") {
      // 직접 입력 모드 — 회원 연결 해제 (donor 텍스트 유지)
      set(uid, { member_id: null });
    } else {
      // 회원 선택 — donor 텍스트 비움
      set(uid, { member_id: value, donor: null });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <Gift className="h-4 w-4 text-cross" />
        물품 찬조
        <span className="text-xs font-normal text-gray-400">
          (금액 없이 비고로 표시)
        </span>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((g) => {
            const manual = !g.member_id;
            return (
              <li key={g.uid} className="flex items-center gap-2">
                <input
                  value={g.item}
                  onChange={(e) => set(g.uid, { item: e.target.value })}
                  placeholder="품목 (예: 텀블러 20개)"
                  className={`${INPUT_CLS} flex-1`}
                />

                {/* 찬조자: 회원 선택 or 직접 입력 */}
                <select
                  value={g.member_id ?? MANUAL}
                  onChange={(e) => selectDonor(g.uid, e.target.value)}
                  className={`${INPUT_CLS} w-32 bg-white`}
                  aria-label="찬조자 선택"
                >
                  <option value={MANUAL}>직접 입력</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {manual && (
                  <input
                    value={g.donor ?? ""}
                    onChange={(e) =>
                      set(g.uid, { donor: e.target.value || null })
                    }
                    placeholder="찬조자(외부)"
                    className={`${INPUT_CLS} w-28`}
                  />
                )}

                <button
                  type="button"
                  onClick={() => remove(g.uid)}
                  aria-label="물품찬조 삭제"
                  className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-expense"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-cross hover:text-cross"
      >
        <Plus className="h-3 w-3" />
        물품 찬조 추가
      </button>
    </div>
  );
}
