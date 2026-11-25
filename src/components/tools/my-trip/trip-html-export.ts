import { EDITION_LABEL, type ToolEdition } from "../editions";
import {
  formatDateRange,
  priceLabel,
  priceYearLabel,
  selectedPackage,
  selectedSlot,
  selectedTicket,
  type EditionTripData,
} from "./trip-logic";
import {
  FREE_TEXT_MAX,
  buildTripExport,
  type TripState,
} from "./trip-state";

/**
 * Self-contained, human-readable HTML export for My Trip.
 *
 * Most people do not know what to do with a raw `.json` file. Exporting a
 * styled HTML sheet lets them open their trip in any browser, tick off stages
 * as they prepare, jot down notes, print or save as PDF, and click "Save
 * updated copy" to keep their progress — while embedding the validated JSON
 * payload in a `<script type="application/json">` block so the same file can
 * be re-imported into TMLGuide My Trip later.
 */

export const TRIP_HTML_DATA_SCRIPT_ID = "tmlguide-trip-data";

const EDITION_ACCENT: Readonly<Record<ToolEdition, string>> = {
  belgium: "#FFC83D",
  winter: "#8EDBFF",
  brasil: "#FF8A5C",
};

/** Download filename for the interactive HTML trip sheet. */
export function tripHtmlExportFilename(state: TripState): string {
  return `tmlguide-my-trip-${state.edition}.html`;
}

/** Escapes text for safe insertion into HTML content and attributes. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Escapes a JSON string so it can never close a `<script>` tag or inject HTML
 * when embedded inside `<script type="application/json">`.
 */
export function escapeJsonForScriptTag(json: string): string {
  return json
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function safeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function formatExportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatSaleDate(iso: string, timeZone: string): string {
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
      timeZone,
    }).format(new Date(epoch));
  } catch {
    return iso;
  }
}

interface ChecklistRow {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly checked: boolean;
}

function buildPreparationChecklist(
  state: TripState,
  editionData: EditionTripData,
): readonly ChecklistRow[] {
  const slot = selectedSlot(state, editionData);
  const ticket = selectedTicket(state, editionData);
  const pkg = selectedPackage(state, editionData);

  return [
    {
      id: "step-dates",
      label: "Confirm your festival dates",
      detail: slot
        ? `${slot.name} (${formatDateRange(slot.startsOn, slot.endsOn)})`
        : "Still to decide which weekend or week you are aiming for.",
      checked: slot !== undefined,
    },
    {
      id: "step-prereg",
      label: "Pre-register in your Tomorrowland Account",
      detail: "Required before entering any official sale moment.",
      checked: false,
    },
    {
      id: "step-ticket",
      label: "Secure your festival ticket or pass",
      detail: ticket
        ? `${ticket.name} — ${priceLabel(ticket, editionData.currency)} (${priceYearLabel(ticket.priceYear)})`
        : "Still to choose or buy your festival pass.",
      checked: false,
    },
    {
      id: "step-accommodation",
      label: "Arrange accommodation",
      detail: pkg
        ? `${pkg.name} — ${priceLabel(pkg, editionData.currency)} (${pkg.capacity} ${pkg.capacity === 1 ? "person" : "people"})`
        : state.accommodationNote.trim() !== ""
          ? state.accommodationNote.trim()
          : "Still to pick DreamVille, Montagoe, hotel or off-site stay.",
      checked: false,
    },
    {
      id: "step-travel",
      label: "Book transport, flights, trains or shuttles",
      detail:
        state.travelNote.trim() !== ""
          ? state.travelNote.trim()
          : "Check airport transfers, rail links and first/last shuttle times.",
      checked: false,
    },
    {
      id: "step-personalise",
      label: "Personalise tickets and check Treasure Case shipping",
      detail: "Confirm every attendee's name matches their photo ID before the deadline.",
      checked: false,
    },
    {
      id: "step-packing",
      label: "Finalise packing list and cashless Pearls budget",
      detail: "Passport/ID, festival bracelet, portable battery, weather layers and earplugs.",
      checked: false,
    },
  ];
}

function renderSourceLink(url: string, title: string): string {
  const safeUrl = safeExternalUrl(url);
  if (safeUrl === null) return escapeHtml(title);
  return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`;
}

/**
 * Builds the complete, standalone HTML trip sheet for download.
 */
export function buildTripHtmlExport(
  state: TripState,
  editionData: EditionTripData,
  exportedAt: Date,
): string {
  const editionName = EDITION_LABEL[state.edition];
  const accent = EDITION_ACCENT[state.edition];
  const slot = selectedSlot(state, editionData);
  const ticket = selectedTicket(state, editionData);
  const pkg = selectedPackage(state, editionData);
  const checklist = buildPreparationChecklist(state, editionData);
  const exportPayload = buildTripExport(state, exportedAt);
  const safeJson = escapeJsonForScriptTag(JSON.stringify(exportPayload, null, 2));
  const filename = tripHtmlExportFilename(state);

  const saleRowsHtml =
    editionData.saleWindows.length === 0
      ? `<p class="empty">No 2027 sale dates are published for ${escapeHtml(editionName)} yet. Check the official Tomorrowland site for updates.</p>`
      : editionData.saleWindows
          .map((win, index) => {
            const id = `sale-${index + 1}`;
            const when = formatSaleDate(win.opensAtIso, win.timeZone);
            const notesLine = win.notes ? `<span class="meta">${escapeHtml(win.notes)}</span>` : "";
            return `
            <label class="check-row" for="${id}">
              <input type="checkbox" id="${id}" data-track="true" />
              <span class="check-body">
                <span class="check-title">${escapeHtml(win.name)}</span>
                <span class="meta">${escapeHtml(when)} · ${escapeHtml(win.audience)}</span>
                ${notesLine}
                <span class="source">Source: ${renderSourceLink(win.sourceUrl, win.sourceTitle)}</span>
              </span>
            </label>`;
          })
          .join("");

  const checklistHtml = checklist
    .map(
      (item) => `
      <label class="check-row" for="${escapeHtml(item.id)}">
        <input type="checkbox" id="${escapeHtml(item.id)}" data-track="true"${item.checked ? " checked" : ""} />
        <span class="check-body">
          <span class="check-title">${escapeHtml(item.label)}</span>
          <span class="meta">${escapeHtml(item.detail)}</span>
        </span>
      </label>`,
    )
    .join("");

  const ticketValue = ticket
    ? `${escapeHtml(ticket.name)}<div class="meta">${escapeHtml(priceLabel(ticket, editionData.currency))} · ${escapeHtml(priceYearLabel(ticket.priceYear))}</div><div class="source">Source: ${renderSourceLink(ticket.sourceUrl, ticket.sourceTitle)}</div>`
    : `<span class="muted">Not chosen yet</span>`;

  const packageValue = pkg
    ? `${escapeHtml(pkg.name)}<div class="meta">${escapeHtml(priceLabel(pkg, editionData.currency))} · ${pkg.capacity} ${pkg.capacity === 1 ? "person" : "people"} · ${escapeHtml(priceYearLabel(pkg.priceYear))}</div><div class="source">Source: ${renderSourceLink(pkg.sourceUrl, pkg.sourceTitle)}</div>`
    : `<span class="muted">Not chosen yet</span>`;

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TMLGuide Trip Sheet — ${escapeHtml(editionName)}</title>
  <style>
    :root {
      --ground: #0e0b0a;
      --surface: #171210;
      --surface-2: #211a16;
      --cream: #f4ece0;
      --cream-mute: #b7aba0;
      --hair: rgba(244, 236, 224, 0.14);
      --accent: ${accent};
      --on-accent: #130f0d;
      --radius: 14px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--ground);
      color: var(--cream);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.55;
      padding: 2rem 1.25rem 4rem;
    }
    .wrap {
      max-width: 820px;
      margin: 0 auto;
    }
    header {
      border-bottom: 1px solid var(--hair);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .kicker {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.72rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      margin: 0 0 0.5rem;
    }
    h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 500;
      font-size: clamp(1.85rem, 4vw, 2.5rem);
      line-height: 1.1;
      margin: 0 0 0.5rem;
    }
    .subtitle {
      margin: 0;
      color: var(--cream-mute);
      font-size: 0.95rem;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
    .btn {
      appearance: none;
      border: 1px solid var(--hair);
      background: var(--surface-2);
      color: var(--cream);
      border-radius: 999px;
      padding: 0.65rem 1.15rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn--primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--on-accent);
    }
    .btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }
    .progress {
      margin-left: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.78rem;
      color: var(--cream-mute);
    }
    .status {
      margin: 0.85rem 0 0;
      font-size: 0.85rem;
      color: var(--accent);
      min-height: 1.3em;
    }
    section.stage {
      background: var(--surface);
      border: 1px solid var(--hair);
      border-radius: var(--radius);
      padding: 1.35rem 1.4rem;
      margin-bottom: 1.25rem;
    }
    .stage-label {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.68rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
      margin: 0 0 0.25rem;
    }
    h2 {
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 500;
      font-size: 1.3rem;
      margin: 0 0 1rem;
    }
    dl.summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem 1.25rem;
      margin: 0;
    }
    .summary-item {
      border-top: 1px solid var(--hair);
      padding-top: 0.65rem;
    }
    dt {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.68rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--cream-mute);
      margin-bottom: 0.25rem;
    }
    dd {
      margin: 0;
      font-size: 0.95rem;
    }
    .muted { color: var(--cream-mute); }
    .meta {
      display: block;
      color: var(--cream-mute);
      font-size: 0.84rem;
      margin-top: 0.2rem;
    }
    .source {
      display: block;
      font-size: 0.78rem;
      color: var(--cream-mute);
      margin-top: 0.2rem;
    }
    a { color: var(--accent); }
    .check-row {
      display: flex;
      align-items: flex-start;
      gap: 0.8rem;
      padding: 0.75rem 0;
      border-top: 1px solid var(--hair);
      cursor: pointer;
    }
    .check-row:first-of-type { border-top: 0; padding-top: 0.25rem; }
    .check-row input[type="checkbox"] {
      width: 1.15rem;
      height: 1.15rem;
      margin-top: 0.2rem;
      accent-color: var(--accent);
      flex: 0 0 auto;
    }
    .check-body { flex: 1; min-width: 0; }
    .check-title {
      display: block;
      font-weight: 600;
      font-size: 0.96rem;
    }
    .check-row input:checked + .check-body .check-title {
      text-decoration: line-through;
      color: var(--cream-mute);
    }
    textarea.notes-box {
      width: 100%;
      min-height: 7rem;
      padding: 0.8rem 0.9rem;
      border-radius: 10px;
      border: 1px solid var(--hair);
      background: var(--surface-2);
      color: var(--cream);
      font: inherit;
      resize: vertical;
    }
    .empty { color: var(--cream-mute); margin: 0; font-size: 0.92rem; }
    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--hair);
      color: var(--cream-mute);
      font-size: 0.82rem;
    }
    @media print {
      body { background: #fff; color: #111; padding: 0; }
      section.stage { background: #fff; border-color: #ccc; break-inside: avoid; }
      .toolbar, .status { display: none; }
      .kicker, .stage-label, a { color: #222; }
      .muted, .meta, .source, footer { color: #444; }
      textarea.notes-box { background: #fff; color: #111; border-color: #ccc; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="kicker">TMLGuide · My Trip Sheet</p>
      <h1>${escapeHtml(editionName)}</h1>
      <p class="subtitle">Exported on ${escapeHtml(formatExportDate(exportedAt))}. Tick items off as you plan, then save an updated copy — or re-import this file back into TMLGuide My Trip at any time.</p>
      <div class="toolbar">
        <button type="button" class="btn btn--primary" id="save-copy-btn">Save updated copy</button>
        <button type="button" class="btn" id="print-btn">Print / Save PDF</button>
        <span class="progress" id="progress-label" aria-live="polite"></span>
      </div>
      <p class="status" id="save-status" role="status" aria-live="polite"></p>
    </header>

    <section class="stage" aria-labelledby="stage-1">
      <p class="stage-label">Stage 1 · Summary</p>
      <h2 id="stage-1">Your trip plan</h2>
      <dl class="summary">
        <div class="summary-item">
          <dt>Weekend / dates</dt>
          <dd>${slot ? `${escapeHtml(slot.name)}<span class="meta">${escapeHtml(formatDateRange(slot.startsOn, slot.endsOn))}</span>` : '<span class="muted">Not decided yet</span>'}</dd>
        </div>
        <div class="summary-item">
          <dt>Party size</dt>
          <dd>${state.partySize} ${state.partySize === 1 ? "person" : "people"}</dd>
        </div>
        <div class="summary-item">
          <dt>Festival ticket</dt>
          <dd>${ticketValue}</dd>
        </div>
        <div class="summary-item">
          <dt>Accommodation package</dt>
          <dd>${packageValue}</dd>
        </div>
        <div class="summary-item">
          <dt>Accommodation note</dt>
          <dd>${state.accommodationNote.trim() !== "" ? escapeHtml(state.accommodationNote.trim()) : '<span class="muted">None added</span>'}</dd>
        </div>
        <div class="summary-item">
          <dt>Travel note</dt>
          <dd>${state.travelNote.trim() !== "" ? escapeHtml(state.travelNote.trim()) : '<span class="muted">None added</span>'}</dd>
        </div>
      </dl>
    </section>

    <section class="stage" aria-labelledby="stage-2">
      <p class="stage-label">Stage 2 · Sale calendar</p>
      <h2 id="stage-2">Key sale dates</h2>
      ${saleRowsHtml}
    </section>

    <section class="stage" aria-labelledby="stage-3">
      <p class="stage-label">Stage 3 · Checklist</p>
      <h2 id="stage-3">Preparation steps</h2>
      ${checklistHtml}
    </section>

    <section class="stage" aria-labelledby="stage-4">
      <p class="stage-label">Stage 4 · Notes</p>
      <h2 id="stage-4">Personal notes &amp; reminders</h2>
      <p class="meta" style="margin-bottom: 0.65rem;">Edit your notes below (first ${FREE_TEXT_MAX} characters sync back if you re-import this file into TMLGuide).</p>
      <textarea id="trip-notes" class="notes-box" aria-label="Personal notes">${escapeHtml(state.notes)}</textarea>
    </section>

    <footer>
      TMLGuide is an independent fan guide. It is not affiliated with, endorsed by or sponsored by Tomorrowland or WeAreOne.World B.V. Always confirm prices and dates on the official Tomorrowland website before booking.
    </footer>
  </div>

  <script type="application/json" id="${TRIP_HTML_DATA_SCRIPT_ID}">
${safeJson}
  </script>
  <script>
    (function () {
      var boxes = Array.prototype.slice.call(document.querySelectorAll('input[type="checkbox"][data-track="true"]'));
      var progress = document.getElementById("progress-label");
      var status = document.getElementById("save-status");
      var notes = document.getElementById("trip-notes");
      var dataEl = document.getElementById("${TRIP_HTML_DATA_SCRIPT_ID}");
      var filename = ${JSON.stringify(filename)};
      var freeTextMax = ${FREE_TEXT_MAX};

      function updateProgress() {
        var done = boxes.filter(function (b) { return b.checked; }).length;
        if (progress) progress.textContent = done + " of " + boxes.length + " steps ticked";
      }

      boxes.forEach(function (box) {
        box.addEventListener("change", function () {
          if (box.checked) box.setAttribute("checked", "");
          else box.removeAttribute("checked");
          updateProgress();
        });
      });

      function syncDocumentForSave() {
        boxes.forEach(function (box) {
          if (box.checked) box.setAttribute("checked", "");
          else box.removeAttribute("checked");
        });
        if (notes) {
          notes.textContent = notes.value;
          if (dataEl && dataEl.textContent) {
            try {
              var payload = JSON.parse(dataEl.textContent);
              if (payload && payload.trip && typeof payload.trip === "object") {
                payload.trip.notes = String(notes.value || "").slice(0, freeTextMax);
                payload.exportedAt = new Date().toISOString();
                dataEl.textContent = "\\n" + JSON.stringify(payload, null, 2).replace(/</g, "\\\\u003c").replace(/>/g, "\\\\u003e").replace(/&/g, "\\\\u0026") + "\\n";
              }
            } catch (e) {}
          }
        }
        return "<!doctype html>\\n" + document.documentElement.outerHTML;
      }

      var saveBtn = document.getElementById("save-copy-btn");
      if (saveBtn) {
        saveBtn.addEventListener("click", async function () {
          var html = syncDocumentForSave();
          if (typeof window.showSaveFilePicker === "function") {
            try {
              var handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: "TMLGuide Trip Sheet (HTML)", accept: { "text/html": [".html"] } }]
              });
              var writable = await handle.createWritable();
              await writable.write(html);
              await writable.close();
              if (status) status.textContent = "Updated trip sheet saved.";
              return;
            } catch (err) {
              if (err && err.name === "AbortError") return;
            }
          }
          var blob = new Blob([html], { type: "text/html;charset=utf-8" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          if (status) status.textContent = "Updated copy downloaded as " + filename + ".";
        });
      }

      var printBtn = document.getElementById("print-btn");
      if (printBtn) {
        printBtn.addEventListener("click", function () { window.print(); });
      }

      updateProgress();
    })();
  </script>
</body>
</html>
`;
}
