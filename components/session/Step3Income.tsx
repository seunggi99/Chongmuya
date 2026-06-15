"use client";

import EntryStep from "@/components/session/EntryStep";
import GoodsDonation from "@/components/entry/GoodsDonation";
import type { StepProps } from "@/components/session/SessionForm";

export default function Step3Income(props: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">수입</h2>

      <EntryStep {...props} kind="income" allowReceipts={false} />

      {/* 물품 찬조 (금액 없음) */}
      <div className="border-t border-gray-100 pt-5">
        <GoodsDonation
          items={props.draft.goods_donations}
          members={props.members}
          onChange={(goods) => props.dispatch({ type: "setGoods", goods })}
        />
      </div>
    </div>
  );
}
