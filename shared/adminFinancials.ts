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
): MergedFinancialSummary {
  const billingByDate = new Map(billingDaily.map((day) => [day.date, day.revenueCents]));

  const daily = projectDaily.map((day) => {
    const billingRevenue = billingByDate.get(day.date) ?? 0;
    const revenueCents = day.revenueCents + billingRevenue;
    const costCents = day.costCents;
    return {
      date: day.date,
      revenueCents,
      costCents,
      profitCents: revenueCents - costCents,
    };
  });

  const grossRevenueCents = daily.reduce((sum, day) => sum + day.revenueCents, 0);
  const operatingCostCents = daily.reduce((sum, day) => sum + day.costCents, 0);
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
    daily,
  };
}
