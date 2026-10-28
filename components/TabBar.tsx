"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/accueil", label: "Accueil", icon: "M3 11 12 4l9 7v9h-6v-6H9v6H3z" },
  { href: "/entrainements", label: "Entraîn.", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9.5c5 0 8 3 8.5 11M20.5 9.5c-5 0-8 3-8.5 11M7 4.5c3 2 5 5.5 5 9.5" },
  { href: "/matchs", label: "Matchs", icon: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" },
  { href: "/evenements", label: "Événements", icon: "M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.3l6-.8z" },
];
const BUREAU_TAB = { href: "/bureau", label: "Bureau", icon: "M4 8h16v12H4zM9 8V5h6v3M4 13h16" };

export function TabBar({ isBoard }: { isBoard: boolean }) {
  const pathname = usePathname();
  const tabs = isBoard ? [...TABS, BUREAU_TAB] : TABS;

  return (
    <nav className="tab-bar" aria-label="Navigation principale">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "tab active" : "tab"}
            aria-current={active ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={tab.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
