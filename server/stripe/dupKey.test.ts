import { describe, it, expect } from 'vitest';
import { isDuplicateKeyError } from './dupKey';

describe('isDuplicateKeyError', () => {
  it('detects MySQL duplicate-key errors, including drizzle-wrapped causes', () => {
    expect(isDuplicateKeyError(Object.assign(new Error('x'), { code: 'ER_DUP_ENTRY' }))).toBe(true);
    expect(isDuplicateKeyError(Object.assign(new Error('x'), { errno: 1062 }))).toBe(true);
    expect(isDuplicateKeyError(Object.assign(new Error('Failed query'), { cause: { code: 'ER_DUP_ENTRY', errno: 1062 } }))).toBe(true);
    expect(isDuplicateKeyError(new Error("Duplicate entry 'evt_1' for key 'stripeWebhookEvents_eventId_uniq'"))).toBe(true);
  });
  it('does not treat other DB errors as duplicates', () => {
    expect(isDuplicateKeyError(new Error('ECONNRESET'))).toBe(false);
    expect(isDuplicateKeyError(Object.assign(new Error('x'), { code: 'PROTOCOL_CONNECTION_LOST' }))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
  });
});
