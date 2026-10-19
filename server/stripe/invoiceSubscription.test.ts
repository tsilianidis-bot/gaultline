import { describe, it, expect } from 'vitest';
import { getInvoiceSubscriptionId } from './invoiceSubscription';

describe('getInvoiceSubscriptionId', () => {
  it('reads the current shape: invoice.parent.subscription_details.subscription', () => {
    expect(getInvoiceSubscriptionId({
      id: 'in_1',
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_new' } },
    })).toBe('sub_new');
  });

  it('reads the current line-item shape when the invoice parent is absent', () => {
    expect(getInvoiceSubscriptionId({
      id: 'in_2',
      lines: { data: [{ parent: { type: 'subscription_item_details', subscription_item_details: { subscription: 'sub_line' } } }] },
    })).toBe('sub_line');
  });

  it('still reads the legacy shape: invoice.subscription', () => {
    expect(getInvoiceSubscriptionId({ id: 'in_3', subscription: 'sub_old' })).toBe('sub_old');
  });

  it('accepts an expanded subscription object', () => {
    expect(getInvoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: 'sub_obj' } } } })).toBe('sub_obj');
    expect(getInvoiceSubscriptionId({ subscription: { id: 'sub_obj_legacy' } })).toBe('sub_obj_legacy');
  });

  it('prefers the current shape when both are present', () => {
    expect(getInvoiceSubscriptionId({
      subscription: 'sub_old',
      parent: { subscription_details: { subscription: 'sub_new' } },
    })).toBe('sub_new');
  });

  it('returns null for non-subscription invoices and bad input', () => {
    expect(getInvoiceSubscriptionId({ id: 'in_4', parent: null, lines: { data: [] } })).toBeNull();
    expect(getInvoiceSubscriptionId({ id: 'in_5', parent: { subscription_details: null } })).toBeNull();
    expect(getInvoiceSubscriptionId({ subscription: '' })).toBeNull();
    expect(getInvoiceSubscriptionId(null)).toBeNull();
    expect(getInvoiceSubscriptionId(undefined)).toBeNull();
  });
});
