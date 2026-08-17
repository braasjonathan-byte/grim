/**
 * Protects optimistic local edits from being overwritten by a background
 * refetch that was started before (or raced with) the write.
 *
 * Pattern: every local/optimistic state change registers a "mark" with the
 * value the user just produced. When server data arrives we ask the guard
 * whether that row may be replaced:
 *
 *  - no mark (or expired mark)            -> server wins (normal case)
 *  - mark matches the server value        -> write confirmed, mark cleared,
 *                                            server wins (identical anyway)
 *  - mark differs from the server value   -> the response is older than the
 *                                            user's edit, keep the local value
 *
 * The TTL makes the protection self-healing: a write that never lands stops
 * being protected after a few seconds and the backend becomes authoritative
 * again, so the UI can never get permanently stuck on a phantom value.
 */
export class LocalWriteGuard<T> {
  private marks = new Map<string, { at: number; value: T }>();

  constructor(
    private readonly ttlMs = 20000,
    private readonly isEqual: (a: T, b: T) => boolean = (a, b) =>
      JSON.stringify(a) === JSON.stringify(b),
  ) {}

  mark(key: string, value: T) {
    this.marks.set(key, { at: Date.now(), value });
  }

  clear(key: string) {
    this.marks.delete(key);
  }

  /** True when the incoming server value is stale and the local one must stay. */
  shouldKeepLocal(key: string, serverValue: T | undefined): boolean {
    const mark = this.marks.get(key);
    if (!mark) return false;
    if (Date.now() - mark.at > this.ttlMs) {
      this.marks.delete(key);
      return false;
    }
    if (serverValue !== undefined && this.isEqual(mark.value, serverValue)) {
      // Backend confirmed the write.
      this.marks.delete(key);
      return false;
    }
    return true;
  }

  /** True when a still-valid local write exists for this key. */
  hasPending(key: string): boolean {
    const mark = this.marks.get(key);
    if (!mark) return false;
    if (Date.now() - mark.at > this.ttlMs) {
      this.marks.delete(key);
      return false;
    }
    return true;
  }
}

/** Compares only the fields that are actually persisted for a row. */
export function fieldsEqual<T extends Record<string, any>>(fields: (keyof T)[]) {
  return (a: T, b: T) =>
    fields.every((f) => {
      const av = a?.[f];
      const bv = b?.[f];
      if (av && typeof av === "object") return JSON.stringify(av) === JSON.stringify(bv);
      if (bv && typeof bv === "object") return false;
      return (av ?? null) === (bv ?? null);
    });
}
