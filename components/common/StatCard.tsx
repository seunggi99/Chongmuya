import type { LucideIcon } from "lucide-react";

type Accent = "primary" | "income" | "expense" | "cross" | "balance" | "gray";

const ACCENT_TEXT: Record<Accent, string> = {
  primary: "text-primary",
  income: "text-income",
  expense: "text-expense",
  cross: "text-cross",
  balance: "text-balance",
  gray: "text-gray-900",
};

const ACCENT_BG: Record<Accent, string> = {
  primary: "bg-light text-primary",
  income: "bg-green-50 text-income",
  expense: "bg-red-50 text-expense",
  cross: "bg-amber-50 text-cross",
  balance: "bg-light text-balance",
  gray: "bg-gray-50 text-gray-500",
};

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: Accent;
}

export default function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  accent = "gray",
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        {Icon && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${ACCENT_BG[accent]}`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <p className="mt-3 flex items-baseline gap-1">
        <span className={`tabular text-2xl font-bold ${ACCENT_TEXT[accent]}`}>
          {value}
        </span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
