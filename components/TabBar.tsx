"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BOOSTER_OPENED } from "@/components/game/VutHeaderLink";

const TABS = [
  { href: "/accueil", label: "Accueil", icon: "M3 11 12 4l9 7v9h-6v-6H9v6H3z" },
  { href: "/entrainements", label: "Entraîn.", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9.5c5 0 8 3 8.5 11M20.5 9.5c-5 0-8 3-8.5 11M7 4.5c3 2 5 5.5 5 9.5" },
  { href: "/matchs", label: "Matchs", icon: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" },
  { href: "/stats", label: "Stats", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  // VUT (jeu de cartes) : les événements restent sur l'accueil.
  { href: "/jeu", label: "VUT", icon: "M7 3h10v18H7zM10 7h4M12 11l1.5 2.5L12 16l-1.5-2.5z" },
];
const BUREAU_TAB = { href: "/bureau", label: "Bureau", icon: "M4 8h16v12H4zM9 8V5h6v3M4 13h16" };

export function TabBar({ isBoard, boosters = 0 }: { isBoard: boolean; boosters?: number }) {
  const pathname = usePathname();
  // Pastille des boosters à ouvrir, mise à jour à chaque ouverture sans rechargement.
  const [badge, setBadge] = useState(boosters);
  useEffect(() => setBadge(boosters), [boosters]);
  useEffect(() => {
    const onOpened = () => setBadge((n) => Math.max(0, n - 1));
    window.addEventListener(BOOSTER_OPENED, onOpened);
    return () => window.removeEventListener(BOOSTER_OPENED, onOpened);
  }, []);
  const tabs = isBoard ? [...TABS, BUREAU_TAB] : TABS;

  return (
    <nav className="tab-bar" aria-label="Navigation principale">
      {tabs.map((tab) => {
        // Les fiches équipes (/equipes) dépendent de l'onglet Stats.
        const path = pathname.startsWith("/equipes") ? "/stats" : pathname;
        const active = path === tab.href || path.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href === "/jeu" && badge ? "/jeu?vue=boosters" : tab.href}
            className={active ? "tab active" : "tab"}
            aria-current={active ? "page" : undefined}
            aria-label={tab.href === "/jeu" && badge ? `VUT, ${badge} booster${badge > 1 ? "s" : ""} à ouvrir` : undefined}
            style={{ position: "relative" }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={tab.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span>{tab.label}</span>
            {tab.href === "/jeu" && badge > 0 && <span className="chat-badge">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
