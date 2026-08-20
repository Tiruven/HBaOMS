// utils/formatCurrency.ts
/**
 * Formats numeric values to Mauritian Rupee (MUR) currency string.
 * Example: 150 -> "MUR 150.00"
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return "MUR 0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "MUR 0.00";
  
  return `MUR ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
