import {
  Activity,
  Briefcase,
  Building2,
  CalendarCheck,
  ChartColumn,
  FileText,
  FileUser,
  Inbox,
  LayoutGrid,
  Mail,
  NotebookPen,
  Settings2,
  SquareKanban,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";

export type NavItem = { title: string; href: Route; icon: LucideIcon; shortcut?: string };

export const NAV: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { title: "Dashboard", href: "/", icon: LayoutGrid },
      { title: "Pipeline", href: "/pipeline", icon: SquareKanban },
      { title: "Applications", href: "/opportunities", icon: Briefcase },
      { title: "Emails", href: "/emails", icon: Mail },
      { title: "Follow-ups", href: "/follow-ups", icon: Inbox },
    ],
  },
  {
    label: "Records",
    items: [
      { title: "Companies", href: "/companies", icon: Building2 },
      { title: "Contacts", href: "/contacts", icon: UsersRound },
      { title: "Activities", href: "/activities", icon: Activity },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", href: "/analytics", icon: ChartColumn },
      { title: "Weekly review", href: "/review", icon: CalendarCheck },
      { title: "Templates", href: "/templates", icon: FileText },
      { title: "Notes", href: "/notes", icon: NotebookPen },
      { title: "Documents", href: "/documents", icon: FileUser },
    ],
  },
];

export const SETTINGS_NAV: NavItem = { title: "Settings", href: "/settings", icon: Settings2 };

export const ALL_NAV = [...NAV.flatMap((g) => g.items), SETTINGS_NAV];

export function titleForPath(pathname: string) {
  const match = ALL_NAV.filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match?.title ?? "Hunt";
}
