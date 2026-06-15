import type { ReactNode } from "react";

export type BadgeColor =
  | "blue"
  | "green"
  | "gray"
  | "amber"
  | "red"
  | "purple";

const COLOR_CLS: Record<BadgeColor, string> = {
  blue: "bg-light text-primary",
  green: "bg-green-50 text-income",
  gray: "bg-gray-100 text-gray-500",
  amber: "bg-amber-50 text-cross",
  red: "bg-red-50 text-expense",
  purple: "bg-purple-50 text-purple-600",
};

export default function Badge({
  color = "gray",
  children,
  className = "",
}: {
  color?: BadgeColor;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${COLOR_CLS[color]} ${className}`}
    >
      {children}
    </span>
  );
}
