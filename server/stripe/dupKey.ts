/** True only for a MySQL unique-constraint violation (also when wrapped by drizzle's `cause`). */
export function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; message?: string; cause?: { code?: string; errno?: number; message?: string } } | null | undefined;
  return (
    e?.code === 'ER_DUP_ENTRY' ||
    e?.errno === 1062 ||
    e?.cause?.code === 'ER_DUP_ENTRY' ||
    e?.cause?.errno === 1062 ||
    /Duplicate entry/i.test(`${e?.message ?? ''} ${e?.cause?.message ?? ''}`)
  );
}
