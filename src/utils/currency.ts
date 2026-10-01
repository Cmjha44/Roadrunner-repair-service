/**
 * Nepali Currency (NPR) Formatting Utilities
 */

export function formatNpr(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  return `NPR ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNprCompact(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  if (num >= 1000000) {
    return `NPR ${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `NPR ${(num / 1000).toFixed(1)}k`;
  }
  return `NPR ${num.toFixed(0)}`;
}

export const CURRENCY_LABEL = "NPR";
