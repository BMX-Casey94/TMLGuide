import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SALE_BANNER, parseSaleBannerRecord, type SaleBannerRecord } from "@/content/operations/sale-banner";
import { SALE_DISMISS_LABEL, SALE_REGION_LABEL, SaleBanner, saleBannerDismissKey } from "./sale-banner";

afterEach(cleanup);

/**
 * A working session store for these tests.
 *
 * The vitest environment installs an inert `localStorage` stub (see `test-storage.ts`), so the same
 * risk applies to `sessionStorage`: a store whose methods are missing would make the "stays visible"
 * fallback the only path under test. This replaces the property with a real in-memory Storage, and
 * `beforeEach` puts a clean one in place for every test.
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

function installSessionStorage(): Storage {
  const storage = new MemoryStorage();
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
  return storage;
}

/**
 * An "on" record built here, in the test, so the shipped data can stay switched off. The date is the
 * one the content files use for their checks; no sale date, price or live claim is invented.
 */
function liveRecord(overrides: Partial<SaleBannerRecord> = {}): SaleBannerRecord {
  return {
    enabled: true,
    message: "Worldwide ticket sales for Tomorrowland Belgium are open on the official site.",
    href: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/",
    linkLabel: "Open the official ticket page",
    lastVerified: "2026-11-18",
    ...overrides,
  };
}

let storage: Storage;

beforeEach(() => {
  storage = installSessionStorage();
});

describe("the shipped record", () => {
  it("ships switched off", () => {
    expect(SALE_BANNER.enabled).toBe(false);
  });

  it("points at the official ticket page the content files cite", () => {
    expect(SALE_BANNER.href).toBe("https://belgium.tomorrowland.com/en/tickets/festival-tickets/");
  });

  it("claims no year, price or live sale in its dormant message", () => {
    expect(SALE_BANNER.message).not.toMatch(/\d{4}/);
    expect(SALE_BANNER.message).not.toMatch(/€|\$|£|R\$/);
    expect(SALE_BANNER.message).not.toMatch(/now live|sales are live/i);
  });

  it("names only the edition whose ticket page it links to", () => {
    // The destination is the Belgium ticket page, so the template says Belgium and nothing broader.
    expect(SALE_BANNER.message).toContain("Belgium");
    expect(SALE_BANNER.href).toContain("belgium.tomorrowland.com");
  });

  it("uses the repository's ISO check date", () => {
    expect(SALE_BANNER.lastVerified).toBe("2026-11-18");
  });
});

describe("record validation", () => {
  it("refuses a non-https destination", () => {
    expect(() => parseSaleBannerRecord({ ...liveRecord(), href: "http://belgium.tomorrowland.com/" })).toThrow(
      /href: must use https/,
    );
  });

  it("refuses a scheme that only looks like a link", () => {
    expect(() =>
      parseSaleBannerRecord({ ...liveRecord(), href: "javascript:alert(document.cookie)" }),
    ).toThrow(/href/);
  });

  it("refuses a host that merely contains the official domain", () => {
    expect(() =>
      parseSaleBannerRecord({ ...liveRecord(), href: "https://tomorrowland.com.example.net/tickets/" }),
    ).toThrow(/href: must be on tomorrowland\.com/);
  });

  it("refuses credentials in the URL", () => {
    expect(() =>
      parseSaleBannerRecord({
        ...liveRecord(),
        href: "https://user:secret@belgium.tomorrowland.com/en/tickets/",
      }),
    ).toThrow(/href: must not carry credentials/);
  });

  it("refuses a date that is not on the calendar", () => {
    expect(() => parseSaleBannerRecord({ ...liveRecord(), lastVerified: "2026-02-30" })).toThrow(
      /lastVerified: must be a real calendar date/,
    );
  });

  it("refuses a non-boolean flag", () => {
    expect(() => parseSaleBannerRecord({ ...liveRecord(), enabled: "yes" })).toThrow(
      /enabled: must be true or false/,
    );
  });

  it("trims the strings it accepts", () => {
    const record = parseSaleBannerRecord({ ...liveRecord(), message: "  Spaced out notice.  " });
    expect(record.message).toBe("Spaced out notice.");
  });

  it("refuses an unknown field, so a misspelt key cannot sit in the file doing nothing", () => {
    expect(() => parseSaleBannerRecord({ ...liveRecord(), linkLable: "Typo" })).toThrow(
      /linkLable: is not a field of the record/,
    );
  });

  it("refuses a message that would break the single-line layout", () => {
    expect(() => parseSaleBannerRecord({ ...liveRecord(), message: "Two\nlines of notice" })).toThrow(
      /message: must not contain control characters/,
    );
  });
});

describe("SaleBanner", () => {
  it("renders nothing when the record is switched off", () => {
    const { container } = render(<SaleBanner record={{ ...liveRecord(), enabled: false }} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("region", { name: SALE_REGION_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the message and the official link when it is on", () => {
    const record = liveRecord();
    render(<SaleBanner record={record} />);

    const region = screen.getByRole("region", { name: SALE_REGION_LABEL });
    expect(region).toHaveTextContent(record.message);

    const link = screen.getByRole("link", { name: new RegExp(record.linkLabel) });
    expect(link).toHaveAttribute("href", record.href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // The visible text says where it goes, so the new tab is not a surprise.
    expect(link).toHaveTextContent(/opens the official site in a new tab/i);
  });

  it("gives the dismiss control an accessible name", () => {
    render(<SaleBanner record={liveRecord()} />);

    expect(screen.getByRole("button", { name: SALE_DISMISS_LABEL })).toBeInTheDocument();
  });

  it("removes the notice when dismiss is activated", () => {
    render(<SaleBanner record={liveRecord()} />);

    fireEvent.click(screen.getByRole("button", { name: SALE_DISMISS_LABEL }));

    expect(screen.queryByRole("region", { name: SALE_REGION_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("remembers the dismissal for the rest of the session", () => {
    const record = liveRecord();
    const first = render(<SaleBanner record={record} />);
    fireEvent.click(screen.getByRole("button", { name: SALE_DISMISS_LABEL }));
    first.unmount();

    render(<SaleBanner record={record} />);
    expect(screen.queryByRole("region", { name: SALE_REGION_LABEL })).not.toBeInTheDocument();
  });

  it("honours a dismissal written before this page view, so a reload keeps it hidden", () => {
    const record = liveRecord();

    // Stand in for a reload: a dismissal written earlier, in a document whose in-memory state is gone.
    const earlier = installSessionStorage();
    earlier.setItem(saleBannerDismissKey(record.message), "1");

    render(<SaleBanner record={record} />);

    expect(screen.queryByRole("region", { name: SALE_REGION_LABEL })).not.toBeInTheDocument();
  });

  it("shows a changed message again, even after the old one was dismissed", () => {
    const first = render(<SaleBanner record={liveRecord()} />);
    fireEvent.click(screen.getByRole("button", { name: SALE_DISMISS_LABEL }));
    first.unmount();

    render(<SaleBanner record={liveRecord({ message: "A different notice with new wording." })} />);

    expect(screen.getByRole("region", { name: SALE_REGION_LABEL })).toBeInTheDocument();
    expect(screen.getByText("A different notice with new wording.")).toBeInTheDocument();
  });

  it("keys the dismissal to the message, so two wordings do not share a key", () => {
    expect(saleBannerDismissKey("One notice.")).not.toBe(saleBannerDismissKey("Another notice."));
  });

  it("writes nothing but the message's own key to storage", () => {
    const record = liveRecord();
    render(<SaleBanner record={record} />);
    fireEvent.click(screen.getByRole("button", { name: SALE_DISMISS_LABEL }));

    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe(saleBannerDismissKey(record.message));
    expect(document.cookie).toBe("");
  });

  it("hides the notice when the store is unavailable, so the control is never dead", () => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("site data blocked");
      },
    });

    const record = liveRecord();
    const first = render(<SaleBanner record={record} />);
    // An unreadable store must not hide a notice nobody dismissed.
    expect(screen.getByRole("region", { name: SALE_REGION_LABEL })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: SALE_DISMISS_LABEL }));
    expect(screen.queryByRole("region", { name: SALE_REGION_LABEL })).not.toBeInTheDocument();

    // The page view keeps the dismissal even though nothing could be stored.
    first.unmount();
    render(<SaleBanner record={record} />);
    expect(screen.queryByRole("region", { name: SALE_REGION_LABEL })).not.toBeInTheDocument();
  });

  it("hides the notice when the store refuses the write", () => {
    const refusingStore: Storage = {
      length: 0,
      clear: vi.fn(),
      getItem: () => null,
      key: () => null,
      removeItem: vi.fn(),
      setItem() {
        throw new Error("quota exceeded");
      },
    };
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      writable: true,
      value: refusingStore,
    });

    render(<SaleBanner record={liveRecord()} />);
    fireEvent.click(screen.getByRole("button", { name: SALE_DISMISS_LABEL }));

    expect(screen.queryByRole("region", { name: SALE_REGION_LABEL })).not.toBeInTheDocument();
  });

  it("stays visible when reading storage throws", () => {
    const throwingStore: Storage = {
      get length(): number {
        throw new Error("blocked");
      },
      clear: vi.fn(),
      getItem(): string | null {
        throw new Error("blocked");
      },
      key(): string | null {
        throw new Error("blocked");
      },
      removeItem: vi.fn(),
      setItem(): void {
        throw new Error("blocked");
      },
    };
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      writable: true,
      value: throwingStore,
    });

    render(<SaleBanner record={liveRecord()} />);

    expect(screen.getByRole("region", { name: SALE_REGION_LABEL })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /official ticket page/i })).toBeInTheDocument();
  });
});
