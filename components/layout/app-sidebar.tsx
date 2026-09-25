"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoMark } from "@/components/brand/logo";
import { NAV, SETTINGS_NAV, type NavItem } from "@/lib/nav";

export type SidebarCounts = { followUps: number };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ counts }: { counts: SidebarCounts }) {
  const pathname = usePathname();
  const badges: Partial<Record<string, number>> = { "/follow-ups": counts.followUps };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 justify-center px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogoMark className="size-[22px] shrink-0" />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            Hunt
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {NAV.map((group, i) => (
          <SidebarGroup key={group.label ?? i} className="py-1.5">
            {group.label && (
              <SidebarGroupLabel className="h-7 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item.href)}
                    badge={badges[item.href]}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="pb-3">
        <SidebarMenu>
          <NavLink item={SETTINGS_NAV} active={isActive(pathname, SETTINGS_NAV.href)} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const { setOpenMobile, isMobile } = useSidebar();
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className="h-8 gap-2.5 text-[13.5px] text-sidebar-foreground data-active:text-sidebar-accent-foreground [&>svg]:text-muted-foreground data-active:[&>svg]:text-brand"
      >
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={() => isMobile && setOpenMobile(false)}
        >
          <Icon strokeWidth={1.85} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge className="tabular rounded-full bg-brand-soft px-1.5 text-[11px] font-medium text-brand peer-data-active/menu-button:text-brand">
          {badge > 99 ? "99+" : badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}
