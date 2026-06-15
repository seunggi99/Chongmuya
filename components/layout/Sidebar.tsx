"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, activeHref } from "./nav";

export default function Sidebar() {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <aside className="hidden md:flex md:w-72 md:flex-col md:shrink-0 border-r border-gray-100 bg-white">
      <div className="sticky top-0 flex h-screen flex-col">
        {/* 워드마크 */}
        <div className="px-5 py-6">
          <Link href="/" aria-label="총무야 홈">
            <Image
              src="/logo/wordmark.svg"
              alt="총무야"
              width={230}
              height={55}
              priority
              unoptimized
            />
          </Link>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-light text-primary font-semibold"
                    : "text-gray-600 hover:bg-gray-50",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-xs text-gray-300">© 총무야</div>
      </div>
    </aside>
  );
}
