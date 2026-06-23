// Shared display helpers. Use these everywhere — never format inline (AGENTS.md §6).

// Philippine Pesos: peso sign + comma thousands + no decimals (e.g. ₱1,250,000).
// Shows "Inquire for price" when price is NULL or price_on_application is set.
export function formatPrice(amount: number | null, poa = false): string {
  if (poa || amount == null) return 'Inquire for price';
  return '₱' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

// Human-friendly label for a code-managed enum value (e.g. 'used_heavy_equipment'
// -> 'Used heavy equipment', 'negotiating' -> 'Negotiating').
export function labelForEnum(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Short, single-line preview of a free-text field for cards/lists.
export function snippet(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
}

// Long date for public content (e.g. "20 June 2026"). Used by announcements.
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// Compact date for admin views (e.g. "20 Jun 2026, 14:31").
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
