import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  CalendarRange,
  Clock3,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { AdminSidebar, getSectionTitle, type AdminSection } from "@/components/admin/admin-sidebar";
import {
  AnnouncementsPanel,
  BillingOverviewPanel,
  EditablePlanSettingsPanel,
  FaqSettingsPanel,
  PaymentHistoryPanel,
  SocialAccountsPanel,
  UserPlanOverviewPanel,
} from "@/components/admin/admin-settings-panels";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  adminDashboardQueryOptions,
  apiRequest,
  getQueryFn,
  invalidateAdminDashboardQueries,
  queryClient,
} from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  ADMIN_DATE_RANGE_OPTIONS,
  type AdminDateRangePreset,
} from "@shared/adminDateRange";

type AuthUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin?: boolean;
};

type AdminSummary = {
  users: {
    total: number;
    admins: number;
    suspended: number;
    active: number;
  };
  projects: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    successRate: number;
  };
  profit: {
    totalRevenueCents: number;
    totalCostCents: number;
    totalProfitCents: number;
    profitMargin: number;
    trendChangePercent: number;
    billingRevenueCents?: number;
    demoPaymentCount?: number;
    paymentCount?: number;
    tokenOperatingCostCents?: number;
    planAdoptionOperatingCostCents?: number;
    planAdoptionOperating?: {
      totalCreditsGranted: number;
      operatingCostCents: number;
      blockCount: number;
      creditsPerBlock: number;
      costPerBlockCents: number;
    };
    daily: {
      date: string;
      revenueCents: number;
      costCents: number;
      profitCents: number;
    }[];
  };
  billing?: {
    totalRevenueCents: number;
    paymentCount: number;
    recentPayments: AdminPayment[];
  };
  dateRange?: {
    preset: AdminDateRangePreset;
    label: string;
    start: string;
    end: string;
    dayCount: number;
  };
  planPurchases?: {
    packageId: string;
    packageName: string;
    purchaseCount: number;
    customerCount: number;
    revenueCents: number;
    creditsGranted: number;
    operatingCostCents: number;
  }[];
  currentPlans?: {
    planId: string;
    userCount: number;
  }[];
};

type AdminPayment = {
  id: string;
  userId: string;
  userEmail?: string | null;
  packageId: string;
  packageName: string;
  amountCents: number;
  creditsGranted: number;
  status: string;
  cardLast4: string;
  cardholderName: string;
  paymentReference: string;
  createdAt: string;
};

type AdminUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: "admin" | "moderator" | "user";
  status: "active" | "suspended";
  isAdmin: boolean;
  createdAt?: string | null;
};

type AuditLog = {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
};

const chartConfig = {
  profit: {
    label: "Net Profit",
    color: "hsl(var(--chart-1))",
  },
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

function defaultCustomStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function AdminDateRangeControls({
  dateRangePreset,
  customStartDate,
  customEndDate,
  onPresetChange,
  onStartChange,
  onEndChange,
}: {
  dateRangePreset: AdminDateRangePreset;
  customStartDate: string;
  customEndDate: string;
  onPresetChange: (value: AdminDateRangePreset) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Period
        </p>
        <Select
          value={dateRangePreset}
          onValueChange={(value) => onPresetChange(value as AdminDateRangePreset)}
        >
          <SelectTrigger className="w-[200px]">
            <CalendarRange className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADMIN_DATE_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {dateRangePreset === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From
            </p>
            <Input
              type="date"
              value={customStartDate}
              max={customEndDate}
              onChange={(event) => onStartChange(event.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              To
            </p>
            <Input
              type="date"
              value={customEndDate}
              min={customStartDate}
              max={todayDateInput()}
              onChange={(event) => onEndChange(event.target.value)}
              className="w-[160px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(date),
  );
}

function getInitials(user: AdminUser | null | undefined) {
  if (!user) return "?";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (user.email?.[0] || "?").toUpperCase();
}

function displayName(user: AdminUser | null | undefined) {
  if (!user) return "Unknown user";
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.email || "Unknown user";
}

function formatAction(action: string) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AccessDenied() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6 md:p-8">
      <Card className="w-full max-w-md border-destructive/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription>
            This area is limited to administrator accounts. Contact an existing admin if you
            believe you should have access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <a href="/dashboard">Return to Dashboard</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [userSearch, setUserSearch] = useState("");
  const [pendingStatusChange, setPendingStatusChange] = useState<AdminUser | null>(null);
  const [dateRangePreset, setDateRangePreset] = useState<AdminDateRangePreset>("14d");
  const [customStartDate, setCustomStartDate] = useState(defaultCustomStartDate);
  const [customEndDate, setCustomEndDate] = useState(todayDateInput);

  const { data: currentUser, isLoading: authLoading, isFetched: authFetched } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
  });

  const isAdmin = Boolean(currentUser?.isAdmin);

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isFetching: summaryFetching,
    isError: summaryError,
  } = useQuery<AdminSummary>({
    queryKey: ["/api/admin/summary", dateRangePreset, customStartDate, customEndDate],
    enabled: authFetched && isAdmin,
    ...adminDashboardQueryOptions,
    queryFn: async () => {
      const params = new URLSearchParams({ range: dateRangePreset });
      if (dateRangePreset === "custom") {
        params.set("start", customStartDate);
        params.set("end", customEndDate);
      }
      const res = await fetch(`/api/admin/summary?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
  });

  const { data: adminUsers, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: authFetched && isAdmin,
    ...adminDashboardQueryOptions,
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    enabled: authFetched && isAdmin,
    ...adminDashboardQueryOptions,
  });

  const { data: systemConfig } = useQuery<{
    creditPackages: { id: string; name: string; credits: number; priceLabel: string; description: string; popular?: boolean }[];
  }>({
    queryKey: ["/api/admin/system-config"],
    enabled: authFetched && isAdmin,
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: { role?: "admin" | "moderator" | "user"; status?: "active" | "suspended" };
    }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      void invalidateAdminDashboardQueries();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Changes saved",
        description: "User account has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error?.message || "Could not update this user.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return adminUsers || [];
    return (adminUsers || []).filter((user) => {
      const name = displayName(user).toLowerCase();
      const email = (user.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [adminUsers, userSearch]);

  const profitTrendData =
    summary?.profit.daily.map((day) => ({
      date: formatDateLabel(day.date),
      profit: day.profitCents / 100,
      revenue: day.revenueCents / 100,
      cost: day.costCents / 100,
    })) || [];

  const profitTrend = summary?.profit.trendChangePercent ?? 0;
  const profitPositive = (summary?.profit.totalProfitCents ?? 0) >= 0;
  const rangeLabel = summary?.dateRange?.label ?? "Last 14 days";
  const checkoutCount =
    summary?.profit.paymentCount ?? summary?.profit.demoPaymentCount ?? 0;

  const planAdoptionRows = useMemo(() => {
    const purchases = summary?.planPurchases ?? [];
    const currentByPlan = new Map(
      (summary?.currentPlans ?? []).map((row) => [row.planId, row.userCount]),
    );
    const packageNames = new Map(
      (systemConfig?.creditPackages ?? []).map((pkg) => [pkg.id, pkg.name]),
    );

    const planIds = new Set<string>([
      ...purchases.map((row) => row.packageId),
      ...(summary?.currentPlans ?? []).map((row) => row.planId),
      ...(systemConfig?.creditPackages ?? []).map((pkg) => pkg.id),
    ]);

    return Array.from(planIds).map((planId) => {
      const purchase = purchases.find((row) => row.packageId === planId);
      return {
        planId,
        planName: purchase?.packageName || packageNames.get(planId) || planId,
        customerCount: purchase?.customerCount ?? 0,
        purchaseCount: purchase?.purchaseCount ?? 0,
        revenueCents: purchase?.revenueCents ?? 0,
        creditsGranted: purchase?.creditsGranted ?? 0,
        operatingCostCents: purchase?.operatingCostCents ?? 0,
        currentUsers: currentByPlan.get(planId) ?? 0,
      };
    }).sort((a, b) => b.purchaseCount - a.purchaseCount || b.currentUsers - a.currentUsers);
  }, [summary?.planPurchases, summary?.currentPlans, systemConfig?.creditPackages]);

  if (authLoading || (authFetched && isAdmin && summaryLoading && !summary)) {
    return <PageLoading />;
  }
  if (authFetched && !isAdmin) return <AccessDenied />;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full" data-testid="admin-page">
      <AdminSidebar active={activeSection} onNavigate={setActiveSection} />

      <div className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {getSectionTitle(activeSection)}
                </h1>
                {activeSection === "dashboard" && (
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Operational
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {activeSection === "dashboard"
                  ? "Platform metrics, user management, and audit activity"
                  : `Manage ${getSectionTitle(activeSection).toLowerCase()} for ReelForge AI`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void invalidateAdminDashboardQueries().then(() => refetchSummary());
              }}
              disabled={summaryFetching}
              className="shrink-0"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", summaryFetching && "animate-spin")} />
              Refresh data
            </Button>
          </div>

      {summaryError && (activeSection === "dashboard" || activeSection === "payments") && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">
              Failed to load dashboard metrics. Try refreshing.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {activeSection === "dashboard" && (
        <>
      {/* KPI metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <AdminMetricCard
              title="Total Users"
              value={(summary?.users.total ?? 0).toLocaleString()}
              subtitle={`${summary?.users.active ?? 0} active · ${summary?.users.suspended ?? 0} suspended`}
              icon={Users}
            />
            <AdminMetricCard
              title="Videos Processed"
              value={(summary?.projects.total ?? 0).toLocaleString()}
              subtitle={`${summary?.projects.completed ?? 0} completed · ${summary?.projects.inProgress ?? 0} in progress`}
              icon={Video}
              tone="success"
            />
            <AdminMetricCard
              title="Success Rate"
              value={`${summary?.projects.successRate ?? 0}%`}
              subtitle={`${summary?.projects.failed ?? 0} failed jobs`}
              icon={Activity}
              tone={
                (summary?.projects.successRate ?? 0) >= 90
                  ? "success"
                  : (summary?.projects.successRate ?? 0) >= 70
                    ? "warning"
                    : "danger"
              }
            />
            <AdminMetricCard
              title="Net Profit"
              value={formatCurrency(summary?.profit.totalProfitCents ?? 0)}
              subtitle={`${checkoutCount} payments (${rangeLabel.toLowerCase()}) · ${profitTrend >= 0 ? "+" : ""}${profitTrend}% trend`}
              icon={DollarSign}
              tone={profitPositive ? "success" : "warning"}
            />
          </>
        )}
      </section>

      {/* Analytics row */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Revenue & Profit</CardTitle>
                <CardDescription>{rangeLabel} performance overview</CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                {profitTrend >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                )}
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    profitTrend >= 0 ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {profitTrend >= 0 ? "+" : ""}
                  {profitTrend}%
                </span>
              </div>
            </div>
            <AdminDateRangeControls
              dateRangePreset={dateRangePreset}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onPresetChange={setDateRangePreset}
              onStartChange={setCustomStartDate}
              onEndChange={setCustomEndDate}
            />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={profitTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminProfitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-profit)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-profit)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [
                          formatCurrency(Math.round(Number(value) * 100)),
                          name === "profit"
                            ? "Net Profit"
                            : name === "revenue"
                              ? "Revenue"
                              : String(name),
                        ]}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="var(--color-profit)"
                    fill="url(#adminProfitFill)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Financial Summary</CardTitle>
            <CardDescription>Platform economics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summaryLoading ? (
              <>
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Gross Revenue
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums">
                      {formatCurrency(summary?.profit.totalRevenueCents ?? 0)}
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Operating Cost
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums">
                      {formatCurrency(summary?.profit.totalCostCents ?? 0)}
                    </p>
                    {(summary?.profit.planAdoptionOperating?.totalCreditsGranted ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {summary.profit.planAdoptionOperating!.blockCount} block
                        {summary.profit.planAdoptionOperating!.blockCount === 1 ? "" : "s"} ·{" "}
                        {summary.profit.planAdoptionOperating!.totalCreditsGranted.toLocaleString()}{" "}
                        credits sold @ {formatCurrency(summary.profit.planAdoptionOperating!.costPerBlockCents)}{" "}
                        per {summary.profit.planAdoptionOperating!.creditsPerBlock.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Activity className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <Separator />
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Profit Margin
                  </p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-primary">
                    {summary?.profit.profitMargin ?? 0}%
                  </p>
                </div>
                {(summary?.profit.billingRevenueCents ?? 0) > 0 && (
                  <div className="rounded-lg border px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Payments ({rangeLabel.toLowerCase()})
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-600">
                      {formatCurrency(summary?.profit.billingRevenueCents ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {checkoutCount} checkout(s) · live sync
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                  <span>{summary?.users.admins ?? 0} admin accounts configured</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base font-semibold">Plan Adoption</CardTitle>
                <CardDescription>
                  Purchases in {rangeLabel.toLowerCase()} and current active plans · operating cost
                  updates from credits sold
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : planAdoptionRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No plan activity in this period yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Op. cost</TableHead>
                    <TableHead className="text-right">Active now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planAdoptionRows.map((row) => (
                    <TableRow key={row.planId}>
                      <TableCell className="font-medium">{row.planName}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.customerCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.purchaseCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.revenueCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.creditsGranted.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-amber-700 dark:text-amber-400">
                        {formatCurrency(row.operatingCostCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.currentUsers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
        </>
      )}

      {activeSection === "user-plan" && (
        <UserPlanOverviewPanel
          totalUsers={summary?.users.total ?? 0}
          activeUsers={summary?.users.active ?? 0}
          packages={systemConfig?.creditPackages}
        />
      )}

      {activeSection === "plan-settings" && <EditablePlanSettingsPanel />}

      {activeSection === "announcements" && <AnnouncementsPanel />}
      {activeSection === "faq-settings" && <FaqSettingsPanel />}

      {activeSection === "social-accounts" && <SocialAccountsPanel />}

      {activeSection === "billing" && <BillingOverviewPanel />}

      {activeSection === "payment-history" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Revenue Summary</CardTitle>
              <CardDescription>Metrics for {rangeLabel.toLowerCase()}</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminDateRangeControls
                dateRangePreset={dateRangePreset}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onPresetChange={setDateRangePreset}
                onStartChange={setCustomStartDate}
                onEndChange={setCustomEndDate}
              />
            </CardContent>
          </Card>
          <PaymentHistoryPanel
            revenueCents={summary?.profit.totalRevenueCents ?? 0}
            costCents={summary?.profit.totalCostCents ?? 0}
            margin={summary?.profit.profitMargin ?? 0}
            billingRevenueCents={summary?.profit.billingRevenueCents ?? 0}
            paymentCount={checkoutCount}
            periodLabel={rangeLabel}
          />
        </div>
      )}

      {/* Management sections */}
      {activeSection === "users" && (
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">User Management</CardTitle>
                  <CardDescription>
                    Manage roles and account status across the platform
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex items-center gap-2 p-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No users match your search</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6">User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Joined</TableHead>
                          <TableHead className="pr-6 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                    {getInitials(user)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{displayName(user)}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {user.email || "—"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.role}
                                onValueChange={(value: "admin" | "moderator" | "user") =>
                                  updateUserMutation.mutate({
                                    userId: user.id,
                                    payload: { role: value },
                                  })
                                }
                                disabled={updateUserMutation.isPending}
                              >
                                <SelectTrigger
                                  className="h-8 w-[130px]"
                                  data-testid={`admin-role-${user.id}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="moderator">Moderator</SelectItem>
                                  <SelectItem value="user">User</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  user.status === "suspended"
                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                }
                              >
                                {user.status === "active" ? (
                                  <UserCheck className="mr-1 h-3 w-3" />
                                ) : (
                                  <Ban className="mr-1 h-3 w-3" />
                                )}
                                {user.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                              {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <Button
                                variant={user.status === "active" ? "outline" : "default"}
                                size="sm"
                                onClick={() => setPendingStatusChange(user)}
                                disabled={updateUserMutation.isPending}
                                data-testid={`admin-status-toggle-${user.id}`}
                              >
                                {user.status === "active" ? "Suspend" : "Reactivate"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
      )}

      {activeSection === "audit" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Audit Log</CardTitle>
                <CardDescription>
                  Recent administrative actions and security events
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {auditLoading ? (
                  <div className="flex items-center gap-2 p-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading audit log...
                  </div>
                ) : !auditLogs?.length ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No audit events recorded yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6">Actor</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead className="pr-6 text-right">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="pl-6 font-medium">
                              {entry.actorEmail || entry.actorId || "System"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal">
                                {formatAction(entry.action)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {entry.resourceType}
                              {entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ""}
                            </TableCell>
                            <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                              {new Date(entry.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
      )}

      {activeSection === "payments" && (
            <Card>
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Live Payments
                  </CardTitle>
                  <CardDescription>
                    Checkout events from Settings → Billing · {rangeLabel.toLowerCase()}
                  </CardDescription>
                </div>
                <AdminDateRangeControls
                  dateRangePreset={dateRangePreset}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                  onPresetChange={setDateRangePreset}
                  onStartChange={setCustomStartDate}
                  onEndChange={setCustomEndDate}
                />
              </CardHeader>
              <CardContent className="p-0">
                {!summary?.billing?.recentPayments?.length ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <CreditCard className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No payments in {rangeLabel.toLowerCase()} yet
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Complete a checkout in Settings → Billing to see live revenue here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6">Reference</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead className="pr-6 text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.billing.recentPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="pl-6 font-mono text-xs">
                              {payment.paymentReference}
                            </TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {payment.userEmail || payment.userId.slice(0, 8)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  •••• {payment.cardLast4}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{payment.packageName}</TableCell>
                            <TableCell className="font-medium tabular-nums text-emerald-600">
                              {formatCurrency(payment.amountCents)}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              +{payment.creditsGranted}
                            </TableCell>
                            <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                              {new Date(payment.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
      )}

      {activeSection === "health" && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Service Load</CardTitle>
                  <CardDescription>Current resource utilization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {[
                    { label: "API Gateway", value: 72 },
                    { label: "Database", value: 61 },
                    { label: "Worker Pool", value: 84 },
                  ].map((service) => (
                    <div key={service.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{service.label}</span>
                        <span
                          className={cn(
                            "tabular-nums",
                            service.value >= 80
                              ? "text-amber-600"
                              : "text-muted-foreground",
                          )}
                        >
                          {service.value}%
                        </span>
                      </div>
                      <Progress
                        value={service.value}
                        className={cn(service.value >= 80 && "[&>div]:bg-amber-500")}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Active Alerts
                  </CardTitle>
                  <CardDescription>Issues requiring attention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      title: "Worker pool utilization high",
                      severity: "medium" as const,
                      time: "15m ago",
                    },
                    {
                      title: "Storage approaching threshold",
                      severity: "high" as const,
                      time: "1h ago",
                    },
                  ].map((alert) => (
                    <div
                      key={alert.title}
                      className="flex items-start justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {alert.time}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          alert.severity === "high"
                            ? "shrink-0 border-destructive/30 bg-destructive/10 text-destructive"
                            : "shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1">
                    Monitoring data is illustrative until live telemetry is connected.
                  </p>
                </CardContent>
              </Card>
            </div>
      )}

        </div>
      </div>

      <AlertDialog
        open={!!pendingStatusChange}
        onOpenChange={(open) => !open && setPendingStatusChange(null)}
      >
        {pendingStatusChange && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingStatusChange.status === "active"
                  ? "Suspend this account?"
                  : "Reactivate this account?"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <span>
                  <span className="font-medium text-foreground">
                    {displayName(pendingStatusChange)}
                  </span>{" "}
                  {pendingStatusChange.status === "active"
                    ? "will lose access to the platform until reactivated."
                    : "will regain full platform access."}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={
                  pendingStatusChange.status === "active"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={() => {
                  updateUserMutation.mutate({
                    userId: pendingStatusChange.id,
                    payload: {
                      status:
                        pendingStatusChange.status === "active" ? "suspended" : "active",
                    },
                  });
                  setPendingStatusChange(null);
                }}
              >
                {pendingStatusChange.status === "active"
                  ? "Suspend account"
                  : "Reactivate account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
