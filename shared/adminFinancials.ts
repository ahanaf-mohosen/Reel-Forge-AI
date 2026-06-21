export type ProfitTrendPoint = {
  date: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
};

export type MergedFinancialSummary = {
  grossRevenueCents: number;
  operatingCostCents: number;
  netProfitCents: number;
  profitMargin: number;
  trendChangePercent: number;
  billingRevenueCents: number;
  projectRevenueCents: number;
  planAdoptionOperatingCostCents: number;
  daily: ProfitTrendPoint[];
};

export function mergeAdminFinancialSummary(
  projectDaily: ProfitTrendPoint[],
  projectTotals: {
    totalRevenueCents: number;
    totalCostCents: number;
  },
  billingDaily: { date: string; revenueCents: number }[],
  billingRevenueCents: number,
  planAdoptionOperatingCostCents: number,
  planAdoptionDaily: { date: string; operatingCostCents: number }[] = [],
): MergedFinancialSummary {
  const billingByDate = new Map(billingDaily.map((day) => [day.date, day.revenueCents]));
  const projectByDate = new Map(projectDaily.map((day) => [day.date, day]));
  const planCostByDate = new Map(
    planAdoptionDaily.map((day) => [day.date, day.operatingCostCents]),
  );

  const allDates = Array.from(
    new Set([
      ...projectDaily.map((day) => day.date),
      ...billingDaily.map((day) => day.date),
      ...planAdoptionDaily.map((day) => day.date),
    ]),
  ).sort();

  const daily = allDates.map((date) => {
    const project = projectByDate.get(date);
    const billingRevenue = billingByDate.get(date) ?? 0;
    const revenueCents = (project?.revenueCents ?? 0) + billingRevenue;
    const costCents = (project?.costCents ?? 0) + (planCostByDate.get(date) ?? 0);
    return {
      date,
      revenueCents,
      costCents,
      profitCents: revenueCents - costCents,
    };
  });

  const grossRevenueCents = projectTotals.totalRevenueCents + billingRevenueCents;
  const operatingCostCents = projectTotals.totalCostCents + planAdoptionOperatingCostCents;
  const netProfitCents = grossRevenueCents - operatingCostCents;
  const profitMargin =
    grossRevenueCents > 0 ? (netProfitCents / grossRevenueCents) * 100 : 0;

  const midpoint = Math.max(1, Math.floor(daily.length / 2));
  const recentProfit = daily.slice(midpoint).reduce((sum, day) => sum + day.profitCents, 0);
  const previousProfit = daily.slice(0, midpoint).reduce((sum, day) => sum + day.profitCents, 0);
  const trendChangePercent =
    previousProfit > 0
      ? ((recentProfit - previousProfit) / previousProfit) * 100
      : recentProfit > 0
        ? 100
        : 0;

  return {
    grossRevenueCents,
    operatingCostCents,
    netProfitCents,
    profitMargin,
    trendChangePercent,
    billingRevenueCents,
    projectRevenueCents: projectTotals.totalRevenueCents,
    planAdoptionOperatingCostCents,
    daily,
  };
}
