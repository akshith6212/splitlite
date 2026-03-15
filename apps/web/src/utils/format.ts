/**
 * Format cents (integer) as a currency string.
 * e.g. formatCurrency(1050, 'USD') => '$10.50'
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unknown currency codes
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a date string to a human-readable format.
 * e.g. '2024-01-15T10:30:00Z' => 'Jan 15, 2024'
 */
export function formatDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

/**
 * Format a date string as a relative time string.
 * e.g. '2024-01-15T10:30:00Z' => '2 days ago'
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    if (diffWeek < 4) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
    if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
    return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
  } catch {
    return dateString;
  }
}

/**
 * Convert a dollar string (e.g. "10.50") to cents integer (1050).
 */
export function dollarsToCents(dollars: string | number): number {
  const value = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Convert cents to a dollar string for display in inputs.
 * e.g. 1050 => '10.50'
 */
export function centsToDisplayDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Get currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency: string): string {
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(0);
    // Extract symbol from formatted string
    return formatted.replace(/[\d,.\s]/g, '').trim();
  } catch {
    return currency;
  }
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
