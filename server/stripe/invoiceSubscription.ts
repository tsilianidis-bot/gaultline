/**
 * Extract the subscription ID from a Stripe Invoice payload, across API versions.
 *
 * - Pre-`2025-03-31.basil`: `invoice.subscription` (string, or an expanded object).
 * - `2025-03-31.basil` and later (incl. the pinned `2026-04-22.dahlia`):
 *   `invoice.subscription` was removed. The subscription lives at
 *   `invoice.parent.subscription_details.subscription`, and each line item carries
 *   `line.parent.subscription_item_details.subscription`.
 *
 * Webhook payloads follow the API version of the webhook *endpoint*, not the
 * client's pinned version, so both shapes must be accepted.
 * Returns null when the invoice is not tied to a subscription (e.g. one-off invoice).
 */
type IdOrObject = string | { id?: unknown } | null | undefined;

function asId(value: IdOrObject): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (value && typeof value === 'object' && typeof value.id === 'string' && value.id.length > 0) return value.id;
  return null;
}

export function getInvoiceSubscriptionId(invoice: any): string | null {
  if (!invoice || typeof invoice !== 'object') return null;

  // Current shape (basil and later)
  const fromParent = asId(invoice.parent?.subscription_details?.subscription);
  if (fromParent) return fromParent;

  // Current shape, line-item level
  const lines: any[] = Array.isArray(invoice.lines?.data) ? invoice.lines.data : [];
  for (const line of lines) {
    const fromLine = asId(line?.parent?.subscription_item_details?.subscription);
    if (fromLine) return fromLine;
  }

  // Legacy shape (pre-basil)
  const legacy = asId(invoice.subscription);
  if (legacy) return legacy;

  // Very old line shape
  for (const line of lines) {
    const fromLegacyLine = asId(line?.subscription);
    if (fromLegacyLine) return fromLegacyLine;
  }

  return null;
}
