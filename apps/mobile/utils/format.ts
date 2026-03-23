export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
    JPY: '¥',
    CHF: 'CHF',
  };
  return symbols[currency] ?? currency;
}

/**
 * Format an amount stored as cents into a currency string.
 * e.g. formatCurrency(1050, 'USD') → '$10.50'
 */
export function formatCurrency(cents: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const dollars = cents / 100;
  const formatted = dollars.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${formatted}`;
}

/**
 * Convert a dollar amount (float) to integer cents.
 * e.g. dollarsToCents(10.5) → 1050
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format an ISO date string to a human-readable date.
 * e.g. '2024-03-15T12:00:00Z' → 'Mar 15, 2024'
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Format an ISO date string to a relative time description.
 * e.g. 'just now', '5 minutes ago', '2 hours ago', 'Mar 15'
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}
