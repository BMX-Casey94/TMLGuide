/**
 * Test-only helpers for the shell test suites.
 *
 * The repository's vitest environment currently runs with Node's `--localstorage-file` flag set
 * without a path, which installs an inert `localStorage` stub over jsdom's real implementation
 * (`setItem` and `getItem` are missing, and a warning is printed at startup). Components guard
 * every storage call, so nothing crashes at runtime, but tests that assert persistence need a
 * working Storage. {@link installMemoryStorage} provides one for the duration of a test file.
 *
 * Nothing in this module is imported by application code.
 */

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.entries.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

/** Replace `window.localStorage` with a fresh in-memory implementation. */
export function installMemoryStorage(): Storage {
  const storage = new MemoryStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
  return storage;
}

/** Remove the edition attribute and any stored choice, then install clean storage. */
export function resetEditionState(): Storage {
  const storage = installMemoryStorage();
  delete document.body.dataset.ed;
  return storage;
}
