/**
 * jsdom gaps the palette tests have to fill, applied once per test file.
 *
 * Two matter here, and both are environment defects rather than anything the
 * component could avoid:
 *
 * 1. This jsdom build ships a method-less `localStorage` stub (Node's web
 *    storage flag wins over jsdom's `Storage`), so `setItem` does not persist and
 *    `clear` does not exist. A spec-shaped in-memory `Storage` is installed
 *    instead. Same approach as `src/components/radio/radio.test.tsx`.
 *
 * 2. jsdom implements `HTMLDialogElement` with only an `open` property: no
 *    `showModal()` and no `close()`. The shim below reproduces the observable
 *    behaviour the palette relies on — `open` reflection, focusing the first
 *    focusable child on show, and dispatching `close` on close — without
 *    pretending to do anything the real element does not. It deliberately does
 *    not emulate the top layer, which jsdom has no concept of.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

/** Installs a fresh, empty in-memory `localStorage`. */
export function installStorage(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
}

/** Adds `showModal` and `close` to jsdom's `HTMLDialogElement`, if missing. */
export function installDialog(): void {
  const proto = window.HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  if (typeof proto.showModal !== "function") {
    Object.defineProperty(proto, "showModal", {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
        const focusable = this.querySelector<HTMLElement>(
          "input:not([disabled]), button:not([disabled]), a[href], select, textarea",
        );
        focusable?.focus();
      },
    });
  }

  if (typeof proto.close !== "function") {
    Object.defineProperty(proto, "close", {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement) {
        if (!this.hasAttribute("open")) return;
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    });
  }
}

/** Both fixes, for a test file that needs the dialog and persisted state. */
export function installBrowserGaps(): void {
  installStorage();
  installDialog();
}
