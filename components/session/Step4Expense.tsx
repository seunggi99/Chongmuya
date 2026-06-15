"use client";

import EntryStep from "@/components/session/EntryStep";
import type { StepProps } from "@/components/session/SessionForm";

export default function Step4Expense(props: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">지출</h2>
      <EntryStep {...props} kind="expense" allowReceipts />
    </div>
  );
}
