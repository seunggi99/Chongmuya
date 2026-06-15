import {
  Home,
  CalendarDays,
  ScrollText,
  FilePlus2,
  Calculator,
  Users,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 모바일 하단 탭바에 노출할지 여부 */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home, mobile: true },
  { href: "/events", label: "행사 일정", icon: CalendarDays, mobile: true },
  { href: "/sessions", label: "회차목록", icon: ScrollText },
  { href: "/sessions/new", label: "새 일지", icon: FilePlus2, mobile: true },
  { href: "/settlement", label: "연간결산", icon: Calculator, mobile: true },
  { href: "/members", label: "회원관리", icon: Users },
  { href: "/dues", label: "연회비현황", icon: Wallet },
  { href: "/settings", label: "설정", icon: Settings, mobile: true },
];

/** 주어진 href 가 pathname 의 prefix 로 매칭되는지 */
function matches(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * 현재 pathname 에 대해 active 로 표시할 메뉴 href 를 반환.
 * 여러 메뉴가 매칭되면 가장 구체적인(긴) href 를 우선한다.
 * 예) /sessions/new 에서는 "/sessions"(회차목록)가 아니라 "/sessions/new"(새 일지)가 active.
 */
export function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of NAV_ITEMS) {
    if (matches(item.href, pathname) && (!best || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

