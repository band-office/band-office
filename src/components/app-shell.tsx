"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  ArchiveRestore,
  ClipboardCheck,
  ClipboardPlus,
  FileBarChart,
  Gauge,
  PackageOpen,
  Settings,
  FileUp,
  Users,
  UsersRound,
  Wrench,
  LogOut,
  WalletCards,
  Mail,
  LibraryBig,
  Files,
  CalendarDays,
} from "lucide-react";
import { logoutAction } from "@/app/auth-actions";
import { BrandMark } from "@/components/brand-mark";
import type { Permission } from "@/lib/auth";

const navigation = [
  { href: "/today", label: "Today", icon: Gauge },
  { href: "/roster", label: "People", icon: Users, permissions: ["VIEW_PEOPLE"] as Permission[] },
  { href: "/groups", label: "Groups", icon: UsersRound, permissions: ["VIEW_GROUPS"] as Permission[] },
  { href: "/financials", label: "Financials", icon: WalletCards, permissions: ["VIEW_FINANCIALS"] as Permission[] },
  { href: "/communications", label: "Email", icon: Mail, permissions: ["VIEW_COMMUNICATIONS"] as Permission[] },
  { href: "/library", label: "Library", icon: LibraryBig, permissions: ["VIEW_LIBRARY"] as Permission[] },
  { href: "/forms", label: "Forms", icon: Files, permissions: ["VIEW_FORMS"] as Permission[] },
  { href: "/events", label: "Events", icon: CalendarDays, permissions: ["VIEW_EVENTS"] as Permission[] },
  { href: "/assets", label: "Assets", icon: PackageOpen, permissions: ["VIEW_INVENTORY"] as Permission[] },
  { href: "/checkout", label: "Checkout", icon: ClipboardPlus, permissions: ["MANAGE_ASSIGNMENTS"] as Permission[] },
  { href: "/checkin", label: "Check-in", icon: ClipboardCheck, permissions: ["MANAGE_ASSIGNMENTS"] as Permission[] },
  { href: "/repairs", label: "Repairs", icon: Wrench, permissions: ["VIEW_REPAIRS"] as Permission[] },
  { href: "/reports", label: "Reports", icon: FileBarChart, permissions: ["VIEW_REPORTS"] as Permission[] },
];

const administration = [
  { href: "/import", label: "Import", icon: FileUp, permissions: ["MANAGE_PEOPLE", "MANAGE_INVENTORY"] as Permission[] },
  { href: "/rollover", label: "Rollover", icon: ArchiveRestore, permissions: ["ROLLOVER"] as Permission[] },
  { href: "/settings", label: "Settings", icon: Settings, permissions: ["MANAGE_SETTINGS", "MANAGE_USERS"] as Permission[] },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Gauge }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = linkRef.current;
    if (active && link?.parentElement?.classList.contains("mobile-nav")) link.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
  }, [active]);
  return (
    <Link ref={linkRef} className={active ? "nav-link active" : "nav-link"} href={href} aria-current={active ? "page" : undefined}>
      <Icon size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children, programName, username, role, permissions }: { children: React.ReactNode; programName: string; username: string; role: string; permissions: Permission[] }) {
  const allowedNavigation = navigation.filter((item) => !item.permissions || item.permissions.some((permission) => permissions.includes(permission)));
  const allowedAdministration = administration.filter((item) => item.permissions.some((permission) => permissions.includes(permission)));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><BrandMark size={30} reverse /></span>
          <div><strong>Band Office</strong><small>{programName}</small></div>
        </div>
        <nav aria-label="Primary navigation">
          <div className="nav-group">{allowedNavigation.map((item) => <NavLink key={item.href} {...item} />)}</div>
          <p className="nav-label">Administration</p>
          <div className="nav-group">{allowedAdministration.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </nav>
        <div className="sidebar-footer">
          <span className="connection-dot" />
          <div><strong>{username}</strong><small>{role.replaceAll("_", " ").toLowerCase()}</small></div>
          <form action={logoutAction}><button type="submit" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button></form>
        </div>
      </aside>
      <div className="app-main">
        <header className="mobile-bar">
          <Link href="/today" className="mobile-brand"><BrandMark size={24} reverse /><span>Band Office</span></Link>
          <span className="mobile-program">{programName}</span>
          <form action={logoutAction}><button type="submit" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button></form>
        </header>
        <div className="mobile-nav" aria-label="Mobile navigation">
          {allowedNavigation.map((item) => <NavLink key={item.href} {...item} />)}
        </div>
        {children}
      </div>
    </div>
  );
}
