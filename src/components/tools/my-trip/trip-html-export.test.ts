import { describe, expect, it } from "vitest";
import { buildTripData } from "@/app/tools/my-trip/trip-data";
import {
  TRIP_HTML_DATA_SCRIPT_ID,
  buildTripHtmlExport,
  escapeHtml,
  escapeJsonForScriptTag,
  tripHtmlExportFilename,
} from "./trip-html-export";
import { parseTripImport, type TripState } from "./trip-state";

const data = buildTripData();

const sampleState: TripState = {
  version: 1,
  edition: "belgium",
  slotId: data.belgium.slots[0]?.id ?? null,
  ticketId: data.belgium.tickets[0]?.id ?? null,
  packageId: data.belgium.packages[0]?.id ?? null,
  accommodationNote: "Montagoe Astera near the pool",
  travelNote: "Eurostar to Brussels then shuttle",
  partySize: 2,
  notes: "Check passport expiry before April",
};

describe("trip-html-export", () => {
  it("names the file by edition with .html and never includes typed notes", () => {
    const filename = tripHtmlExportFilename({
      ...sampleState,
      notes: "../../evil.exe",
    });
    expect(filename).toBe("tmlguide-my-trip-belgium.html");
  });

  it("renders all four planning stages, interactive checkboxes, and save/print controls", () => {
    const html = buildTripHtmlExport(
      sampleState,
      data.belgium,
      new Date("2026-11-20T18:00:00Z"),
    );

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Stage 1 · Summary");
    expect(html).toContain("Stage 2 · Sale calendar");
    expect(html).toContain("Stage 3 · Checklist");
    expect(html).toContain("Stage 4 · Notes");
    expect(html).toContain("Save updated copy");
    expect(html).toContain("Print / Save PDF");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Check passport expiry before April");
    expect(html).toContain(`id="${TRIP_HTML_DATA_SCRIPT_ID}"`);
  });

  it("round-trips cleanly back through parseTripImport", () => {
    const html = buildTripHtmlExport(
      sampleState,
      data.belgium,
      new Date("2026-11-20T18:00:00Z"),
    );
    const parsed = parseTripImport(html);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state).toEqual(sampleState);
    }
  });

  it("escapes HTML and script-closing sequences in user-entered fields", () => {
    const hostile: TripState = {
      ...sampleState,
      accommodationNote: '<img src=x onerror="alert(1)">',
      travelNote: '</script><script>alert("xss")</script>',
      notes: '<b>bold</b> & </script>',
    };

    const html = buildTripHtmlExport(
      hostile,
      data.belgium,
      new Date("2026-11-20T18:00:00Z"),
    );

    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

    // And the embedded JSON still round-trips the exact original text.
    const parsed = parseTripImport(html);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.travelNote).toBe(hostile.travelNote);
      expect(parsed.state.notes).toBe(hostile.notes);
    }
  });

  it("rejects an HTML file that does not contain a TMLGuide trip sheet", () => {
    const result = parseTripImport("<!doctype html><html><body>Hello</body></html>");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/does not contain a TMLGuide trip sheet/i);
    }
  });

  it("escapes special characters in helper functions", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
    expect(escapeJsonForScriptTag('{"a":"</script>&"}')).toBe('{"a":"\\u003c/script\\u003e\\u0026"}');
  });
});
