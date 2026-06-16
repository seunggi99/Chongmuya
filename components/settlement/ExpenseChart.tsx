"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatKRW, formatWon } from "@/lib/format";
import type { SettlementCategoryRow } from "@/types";

export default function ExpenseChart({
  data,
}: {
  data: SettlementCategoryRow[];
}) {
  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
        지출 내역이 없습니다.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
      >
        <XAxis type="number" tickFormatter={(v) => formatKRW(Number(v))} hide />
        <YAxis
          type="category"
          dataKey="name"
          width={84}
          tick={{ fontSize: 12, fill: "#374151" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v) => formatWon(Number(v))}
          cursor={{ fill: "#f9fafb" }}
        />
        <Bar dataKey="amount" fill="#DC2626" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
