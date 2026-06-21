/** Tokens consumed per operating-cost billing block. */
export const TOKENS_PER_OPERATING_COST_BLOCK = Number(
  process.env.TOKENS_PER_OPERATING_BLOCK ?? 50_000,
);

/** Operating cost charged per block (USD cents). Default: $199.99 */
export const OPERATING_COST_PER_BLOCK_CENTS = Number(
  process.env.OPERATING_COST_PER_BLOCK_CENTS ?? 19_999,
);

/**
 * Every 50,000 credits/tokens incurs one operating-cost charge.
 * Plan purchases grant credits; each block costs $199.99 until the next block starts.
 */
export function calculateTokenBlockOperatingCostCents(tokenCount: number): number {
  if (tokenCount <= 0) return 0;
  return (
    Math.ceil(tokenCount / TOKENS_PER_OPERATING_COST_BLOCK) *
    OPERATING_COST_PER_BLOCK_CENTS
  );
}

/** Rough token estimate when no API usage metadata is available (~4 chars/token). */
export function estimateTokensFromText(text: string): number {
  const chars = text.replace(/\s+/g, " ").trim().length;
  if (chars === 0) return 0;
  return Math.max(1, Math.ceil(chars / 4));
}
