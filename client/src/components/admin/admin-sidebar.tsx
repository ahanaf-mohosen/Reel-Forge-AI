import { useState } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  Coins,
  CreditCard,
  FileText,
  Grid2X2,
  HelpCircle,
  LayoutGrid,
  PanelLeftClose,
  PanelLeft,
  Share2,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/logo.png";

export type AdminSection =
  | "dashboard"
  | "user-plan"
  | "users"
  | "payments"
  | "payment-history"
  | "plan-settings"
  | "announcements"
  | "faq-settings"
  | "social-accounts"
  | "billing"
  | "audit"
  | "health";

type NavItem = {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  item?: NavItem;
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    item: { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  },
  {
    id: "social-accounts",
    label: "Social Accounts",
    icon: Share2,
    item: { id: "social-accounts", label: "Social Accounts", icon: Share2 },
  },
  {
    id: "billing",
    label: "Billing",
    icon: Coins,
    item: { id: "billing", label: "Billing", icon: Coins },
  },
  {
    id: "user-plan",
    label: "User Plan",
    icon: UserCircle2,
    children: [
      { id: "user-plan", label: "Plans overview", icon: Grid2X2 },
      { id: "users", label: "User accounts", icon: UserCircle2 },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    icon: Wallet,
    children: [
      { id: "payments", label: "Live payments", icon: CreditCard },
      { id: "payment-history", label: "Revenue summary", icon: Wallet },
    ],
  },
  {
    id: "plan-settings",
    label: "Plan Settings",
    icon: Wallet,
    item: { id: "plan-settings", label: "Plan Settings", icon: Wallet },
  },
  {
    id: "announcements",
    label: "Announcements",
    icon: Bell,
    item: { id: "announcements", label: "Announcements", icon: Bell },
  },
  {
    id: "faq",
    label: "FAQ Settings",
    icon: HelpCircle,
    item: { id: "faq-settings", label: "FAQ Settings", icon: HelpCircle },
  },
  {
    id: "system",
    label: "System",
    icon: Activity,
    children: [
      { id: "audit", label: "Audit log", icon: FileText },
      { id: "health", label: "System health", icon: Activity },
    ],
  },
];

interface AdminSidebarProps {
  active: AdminSection;
  onNavigate: (section: AdminSection) => void;
}

function NavButton({
  item,
  active,
  onNavigate,
  nested,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: (s: AdminSection) => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      data-testid={`admin-nav-${item.id}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        nested && "pl-10",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-violet-400/40"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-600" : "opacity-70")} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export function AdminSidebar({ active, onNavigate }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "user-plan": true,
    payments: true,
    system: false,
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isGroupActive = (group: NavGroup) => {
    if (group.item) return active === group.item.id;
    return group.children?.some((c) => c.id === active);
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-muted/20 transition-all duration-200",
        collapsed ? "w-[72px]" : "w-64 min-w-[16rem]",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoImage} alt="ReelForge" className="h-6 w-auto shrink-0" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_GROUPS.map((group) => {
          if (group.item && !group.children) {
            const isActive = active === group.item.id;
            return collapsed ? (
              <button
                key={group.id}
                type="button"
                title={group.item.label}
                onClick={() => onNavigate(group.item!.id)}
                className={cn(
                  "flex w-full items-center justify-center rounded-xl p-2.5 transition-all",
                  isActive
                    ? "bg-background shadow-sm ring-1 ring-violet-400/40"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <group.icon className={cn("h-4 w-4", isActive && "text-violet-600")} />
              </button>
            ) : (
              <NavButton
                key={group.id}
                item={group.item}
                active={isActive}
                onNavigate={onNavigate}
              />
            );
          }

          const isOpen = openGroups[group.id] ?? false;
          const groupActive = isGroupActive(group);

          if (collapsed) {
            const firstChild = group.children?.[0];
            if (!firstChild) return null;
            return (
              <button
                key={group.id}
                type="button"
                title={group.label}
                onClick={() => onNavigate(firstChild.id)}
                className={cn(
                  "flex w-full items-center justify-center rounded-xl p-2.5 transition-all",
                  groupActive
                    ? "bg-background shadow-sm ring-1 ring-violet-400/40"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <group.icon className={cn("h-4 w-4", groupActive && "text-violet-600")} />
              </button>
            );
          }

          return (
            <div key={group.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  groupActive ? "text-foreground" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <group.icon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="flex-1 truncate text-left">{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 opacity-50 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen &&
                group.children?.map((child) => (
                  <NavButton
                    key={child.id}
                    item={child}
                    active={active === child.id}
                    onNavigate={onNavigate}
                    nested
                  />
                ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export function getSectionTitle(section: AdminSection): string {
  const titles: Record<AdminSection, string> = {
    dashboard: "Dashboard",
    "user-plan": "User Plan",
    users: "User Accounts",
    payments: "Live Payments",
    "payment-history": "Revenue Summary",
    "plan-settings": "Plan Settings",
    announcements: "Announcements",
    "faq-settings": "FAQ Settings",
    "social-accounts": "Social Accounts",
    billing: "Billing",
    audit: "Audit Log",
    health: "System Health",
  };
  return titles[section];
}
