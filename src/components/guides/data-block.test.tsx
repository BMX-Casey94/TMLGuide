import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { belgiumData } from "@/data/belgium";
import { brasilData } from "@/data/brasil";
import { winterData } from "@/data/winter";
import {
  DataBlock,
  buildDataTable,
  confidenceMarker,
  dataRowCount,
  isUnsupportedCollection,
  shortAnswer,
  shuttleDirection,
} from "./data-block";

afterEach(cleanup);

describe("data table construction", () => {
  it("renders the real Belgium ticket records", () => {
    const table = buildDataTable({ edition: "belgium", collection: "tickets" });

    expect(table.rows.length).toBe(belgiumData.tickets.length);
    expect(table.empty).toBe(false);
    expect(table.columns[1]).toBe("Price (2027)");
  });

  it("labels the price column with the edition year rather than a bare figure", () => {
    render(<DataBlock edition="belgium" collection="tickets" caption="All Belgium tickets" />);

    expect(screen.getByRole("columnheader", { name: "Price (2027)" })).toBeInTheDocument();
  });

  it("filters by id prefix", () => {
    const filtered = buildDataTable({
      edition: "belgium",
      collection: "tickets",
      idPrefix: "belgium-2027-day-pass",
    });
    const all = buildDataTable({ edition: "belgium", collection: "tickets" });

    expect(filtered.rows.length).toBeGreaterThan(0);
    expect(filtered.rows.length).toBeLessThan(all.rows.length);
    for (const row of filtered.rows) expect(row.id.startsWith("belgium-2027-day-pass")).toBe(true);
  });

  it("reports an empty result for a prefix that matches nothing", () => {
    const table = buildDataTable({
      edition: "winter",
      collection: "tickets",
      idPrefix: "no-such-record",
    });

    expect(table.empty).toBe(true);
    expect(table.rows).toEqual([]);
    expect(dataRowCount({ edition: "winter", collection: "tickets", idPrefix: "no-such-record" })).toBe(0);
  });

  it("renders a plain notice, not an empty table, when the prefix matches nothing", () => {
    const { container } = render(
      <DataBlock edition="winter" collection="tickets" idPrefix="no-such-record" caption="Nothing" />,
    );

    expect(container.querySelector("table")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("No checked records for this section yet");
    expect(screen.getByText("no-such-record")).toBeInTheDocument();
  });

  it("formats Brasil prices in reais and never in euros", () => {
    render(<DataBlock edition="brasil" collection="tickets" caption="Brasil festival passes" />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("R$ 3.160,00")).toBeInTheDocument();
    expect(within(table).queryByText(/€/)).toBeNull();
    expect(table.textContent).not.toMatch(/€/);
  });

  it("renders every Brasil ticket record with its variant and availability", () => {
    render(<DataBlock edition="brasil" collection="tickets" caption="Brasil festival passes" />);

    const body = screen.getByRole("table").querySelector("tbody");
    expect(body?.querySelectorAll("tr")).toHaveLength(brasilData.tickets.length);
  });

  it("renders Brasil DreamVille packages for the accommodation collection", () => {
    render(
      <DataBlock edition="brasil" collection="accommodation" caption="Brasil DreamVille packages" />,
    );

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("rowheader", { name: "Easy Tent 2P" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("R$ 7.609,00")).toBeInTheDocument();
  });

  it("shows sale windows in the zone the record uses and in UK time", () => {
    render(<DataBlock edition="belgium" collection="sale-windows" caption="Belgium sale dates" />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Opens (festival time)" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Opens (UK time)" })).toBeInTheDocument();
    // 30 January 2027 at 17:00 CET is 16:00 GMT.
    expect(within(table).getByText("Sat 30 Jan 2027, 17:00 CET")).toBeInTheDocument();
    expect(within(table).getByText("30 Jan 2027, 16:00 GMT")).toBeInTheDocument();
  });

  it("reads Brasil sale windows in São Paulo time", () => {
    render(<DataBlock edition="brasil" collection="sale-windows" caption="Brasil sale dates" />);

    const table = screen.getByRole("table");
    expect(table.textContent).toContain("GMT-3");
    // 24 September 2026 at 10:00 BRT, which is the same clock time in UK BST.
    expect(within(table).getByText("Thu 24 Sep 2026, 10:00 GMT-3")).toBeInTheDocument();
    expect(within(table).getAllByText(/24 Sep 2026/).length).toBeGreaterThan(0);
  });

  it("shows a status for each sale window without claiming the page's own clock", () => {
    render(<DataBlock edition="winter" collection="sale-windows" caption="Winter sale dates" />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Still to come")).toBeInTheDocument();
    expect(within(table).queryByText("Past")).toBeNull();
  });

  it("renders the Belgium add-ons that carry a published price", () => {
    render(<DataBlock edition="belgium" collection="add-ons" caption="Belgium add-ons" />);

    const table = screen.getByRole("table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(belgiumData.addOns.length);
    expect(within(table).getByRole("columnheader", { name: "Price (2027)" })).toBeInTheDocument();
  });

  it("renders the Winter add-ons and their categories", () => {
    render(<DataBlock edition="winter" collection="add-ons" caption="Winter add-ons" />);

    const table = screen.getByRole("table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(winterData.addOns.length);
    const categories = winterData.addOns.map((record) => record.category);
    for (const category of new Set(categories)) {
      expect(within(table).getAllByText(category).length).toBeGreaterThan(0);
    }
  });

  it("renders FAQ questions with a short answer, stripping Markdown", () => {
    render(<DataBlock edition="belgium" collection="faqs" caption="Belgium questions" />);

    const table = screen.getByRole("table");
    const firstRow = table.querySelector("tbody tr");
    expect(firstRow?.textContent).not.toMatch(/\*\*/);
    expect(firstRow?.textContent).not.toMatch(/\n/);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(belgiumData.faqs.length);
  });

  it("shows the source link and the check date under every table", () => {
    render(<DataBlock edition="belgium" collection="tickets" caption="All Belgium tickets" />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByText(/All records checked/)).toBeInTheDocument();
    expect(screen.getByText("18 Nov 2026")).toHaveAttribute("datetime", "2026-11-18");
  });

  it("names each row's source link with the row, not with an internal record id", () => {
    render(<DataBlock edition="belgium" collection="tickets" caption="All Belgium tickets" />);

    const first = belgiumData.tickets[0];
    if (first === undefined) throw new Error("no Belgium tickets in the fixture data");

    const link = screen.getByRole("link", { name: `Source for ${first.name}: ${first.source.title}` });
    expect(link).toHaveAttribute("href", first.source.url);
    // The visible text stays short enough for a narrow column.
    expect(link.textContent).toBe(new URL(first.source.url).hostname);
  });

  it("uses the oldest check date in the set, because the table is only as fresh as its stalest row", () => {
    const table = buildDataTable({ edition: "belgium", collection: "tickets" });
    const oldest = table.rows.map((row) => row.checkedOn).sort()[0];

    const { container } = render(
      <DataBlock edition="belgium" collection="tickets" caption="All Belgium tickets" />,
    );
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(oldest);
  });

  it("gives the table a real caption element", () => {
    const { container } = render(
      <DataBlock edition="winter" collection="tickets" caption="Winter 2027 festival ticket" />,
    );

    const caption = container.querySelector("caption");
    expect(caption).toHaveTextContent("Winter 2027 festival ticket");
    expect(caption).toHaveClass("tml-guide-table__caption");
  });

  it("does not put a price in a table when the edition publishes none", () => {
    render(<DataBlock edition="winter" collection="accommodation" caption="Winter accommodation" />);

    // Winter publishes no accommodation price, so the block shows the honest notice.
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("the stage collection", () => {
  it("renders every stage the winter records hold, with its kind and description", () => {
    render(<DataBlock edition="winter" collection="stages" caption="Winter 2027 stages" />);

    const table = screen.getByRole("table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(winterData.stages.length);
    for (const stage of winterData.stages) {
      expect(
        within(table).getByRole("rowheader", { name: stage.name }),
        `stage ${stage.id}`,
      ).toBeInTheDocument();
      expect(
        within(table).getByText(stage.description),
        `description for ${stage.id}`,
      ).toBeInTheDocument();
    }
    expect(within(table).getByText("Main stage", { selector: "td" })).toBeInTheDocument();
  });

  it("links each stage row to the page the record was read from, with its check date", () => {
    render(<DataBlock edition="winter" collection="stages" caption="Winter 2027 stages" />);

    const first = winterData.stages[0];
    if (first === undefined) throw new Error("no winter stages in the data");

    const link = screen.getByRole("link", { name: `Source for ${first.name}: ${first.source.title}` });
    expect(link).toHaveAttribute("href", first.source.url);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/All records checked/)).toBeInTheDocument();
  });

  it("filters stages by id prefix", () => {
    const all = buildDataTable({ edition: "winter", collection: "stages" });
    const filtered = buildDataTable({ edition: "winter", collection: "stages", idPrefix: "mainstage" });

    expect(filtered.rows.length).toBeLessThan(all.rows.length);
    expect(filtered.rows.length).toBeGreaterThan(0);
    for (const row of filtered.rows) expect(row.id.startsWith("mainstage")).toBe(true);
  });

  it("says plainly that Belgium publishes no 2027 stage records", () => {
    const table = buildDataTable({ edition: "belgium", collection: "stages" });

    expect(table.rows).toEqual([]);
    expect(table.empty).toBe(true);
    expect(table.collectionEmpty).toBe(true);
    expect(table.unsupported).toBe(false);
  });

  it("shows the empty-collection notice for Belgium stages rather than an empty table", () => {
    const { container } = render(<DataBlock edition="belgium" collection="stages" caption="Belgium stages" />);

    expect(container.querySelector("table")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("No checked stage records for this edition");
  });
});

describe("the shuttle collection", () => {
  const ALTIBUS = winterData.shuttles.find((record) => record.id === "altibus-geneva-return");

  it("renders route, operator, direction and the fare for every winter shuttle", () => {
    render(<DataBlock edition="winter" collection="shuttles" caption="Winter coach fares" />);

    const table = screen.getByRole("table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(winterData.shuttles.length);
    for (const column of ["Route", "Operator", "Direction", "Price (2026–27 season)"]) {
      expect(within(table).getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
    for (const record of winterData.shuttles) {
      expect(within(table).getByText(record.route)).toBeInTheDocument();
      expect(within(table).getAllByText(record.operator).length).toBeGreaterThan(0);
    }
  });
  it("always shows the Altibus note inside the same cell as the Altibus price", () => {
    if (ALTIBUS === undefined) throw new Error("the Altibus Geneva record is missing");

    render(<DataBlock edition="winter" collection="shuttles" caption="Winter coach fares" />);

    // The price and the operator's statement must land in one cell, so neither
    // can be read without the other.
    const priceCell = screen.getByText("€80.00").closest("td");
    expect(priceCell).not.toBeNull();
    expect(priceCell).toHaveTextContent(ALTIBUS.notes);
    expect(priceCell).toHaveTextContent("ne circulera pas pendant la saison d'hiver 2025/2026");
    expect(priceCell).toHaveTextContent("did not run that winter");
  });

  it("shows the Altibus note even when the block is filtered to that one record", () => {
    if (ALTIBUS === undefined) throw new Error("the Altibus Geneva record is missing");

    render(
      <DataBlock
        edition="winter"
        collection="shuttles"
        idPrefix="altibus-geneva-"
        caption="The Altibus Geneva fare"
      />,
    );

    const table = screen.getByRole("table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
    const cell = within(table).getByText("€80.00").closest("td");
    expect(cell).toHaveTextContent(ALTIBUS.notes);
    expect(within(table).getByText(ALTIBUS.notes)).toBeVisible();
  });

  it("filters shuttles by id prefix", () => {
    const filtered = buildDataTable({
      edition: "winter",
      collection: "shuttles",
      idPrefix: "bens-bus-",
    });

    expect(filtered.rows.length).toBeGreaterThan(0);
    expect(filtered.rows.length).toBeLessThan(winterData.shuttles.length);
    for (const row of filtered.rows) expect(row.id.startsWith("bens-bus-")).toBe(true);
  });

  it("renders every shuttle note, not only the Altibus one", () => {
    render(<DataBlock edition="winter" collection="shuttles" caption="Winter coach fares" />);

    for (const record of winterData.shuttles) {
      expect(screen.getByText(record.notes), `notes for ${record.id}`).toBeInTheDocument();
    }
    expect(screen.getByText(/Notes are the operator's own wording/)).toBeInTheDocument();
  });

  it("shows the empty-collection notice for Belgium shuttles, which the data leaves empty", () => {
    const table = buildDataTable({ edition: "belgium", collection: "shuttles" });
    expect(table.empty).toBe(true);
    expect(table.collectionEmpty).toBe(true);
    expect(belgiumData.shuttles).toEqual([]);

    const { container } = render(
      <DataBlock edition="belgium" collection="shuttles" caption="Belgium shuttles" />,
    );

    expect(container.querySelector("table")).toBeNull();
    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent("No checked shuttle records for this edition");
    // The notice must not imply a prefix was at fault when none was supplied.
    expect(notice).not.toHaveTextContent("(all records)");
  });
});

describe("a record's confidence, so an unverified record cannot read as confirmed", () => {
  it("marks nothing as official, because official is the norm", () => {
    expect(confidenceMarker("official")).toBeNull();
  });

  it("names the weaker confidence levels in words", () => {
    expect(confidenceMarker("community")).toBe("community-sourced");
    expect(confidenceMarker("unverified")).toBe("unverified");
  });

  it("fails safe on a value it does not recognise", () => {
    // A new enum member should show as unverified rather than as confirmed.
    expect(confidenceMarker("something-new")).toBe("unverified");
  });

  it("leaves every real stage and shuttle row unmarked, because all are official", () => {
    const stages = buildDataTable({ edition: "winter", collection: "stages" });
    const shuttles = buildDataTable({ edition: "winter", collection: "shuttles" });

    for (const row of [...stages.rows, ...shuttles.rows]) {
      expect(row.cells[0], row.id).not.toMatch(/\((?:unverified|community-sourced)\)/);
    }
  });
});

describe("shuttleDirection", () => {
  it("reads the direction from the record name", () => {
    expect(shuttleDirection({ id: "x", name: "A coach to the resort (single)" })).toBe("Single");
    expect(shuttleDirection({ id: "x", name: "A coach to the resort (return)" })).toBe("Return");
  });

  it("falls back to the id suffix when the name is silent", () => {
    expect(shuttleDirection({ id: "a-b-single", name: "A coach" })).toBe("Single");
    expect(shuttleDirection({ id: "a-b-return", name: "A coach" })).toBe("Return");
  });

  it("says so plainly rather than guessing", () => {
    expect(shuttleDirection({ id: "a-b", name: "A coach" })).toBe("Not stated");
  });

  it("agrees with every winter record", () => {
    for (const record of winterData.shuttles) {
      expect(shuttleDirection(record), record.id).not.toBe("Not stated");
    }
  });
});

describe("collections Brasil keeps in its own types", () => {
  it("reports the two catalogue collections as unsupported for Brasil", () => {
    expect(isUnsupportedCollection("brasil", "stages")).toBe(true);
    expect(isUnsupportedCollection("brasil", "shuttles")).toBe(true);
    expect(isUnsupportedCollection("belgium", "stages")).toBe(false);
    expect(isUnsupportedCollection("winter", "shuttles")).toBe(false);
  });

  it("never throws when a Brasil chapter asks for one", () => {
    expect(() => buildDataTable({ edition: "brasil", collection: "stages" })).not.toThrow();
    expect(() => buildDataTable({ edition: "brasil", collection: "shuttles" })).not.toThrow();
    expect(dataRowCount({ edition: "brasil", collection: "shuttles" })).toBe(0);
  });

  it("renders a plain notice naming the edition and collection instead of a table", () => {
    const { container } = render(
      <DataBlock edition="brasil" collection="shuttles" caption="Brasil shuttles" />,
    );

    expect(container.querySelector("table")).toBeNull();
    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent("Not available as a table");
    expect(notice).toHaveTextContent(
      "Brasil does not publish its shuttles in that form, so no shuttles table is shown for the Brasil edition",
    );
  });

  it("does not mistake a Brasil ticket block for an unsupported one", () => {
    expect(() => buildDataTable({ edition: "brasil", collection: "tickets" })).not.toThrow();
    expect(buildDataTable({ edition: "brasil", collection: "tickets" }).rows.length).toBeGreaterThan(0);
  });
});

describe("the table's columns line up", () => {
  it.each([
    ["winter", "stages"],
    ["winter", "shuttles"],
    ["winter", "tickets"],
    ["belgium", "accommodation"],
  ] as const)("has a header cell for every body cell (%s, %s)", (edition, collection) => {
    const { container } = render(
      <DataBlock edition={edition} collection={collection} caption="A column check" />,
    );

    const head = container.querySelectorAll("thead th").length;
    const body = container.querySelector("tbody tr")?.children.length;
    expect(body).toBe(head);
  });

  it("labels the source column the body rows fill", () => {
    render(<DataBlock edition="winter" collection="shuttles" caption="Winter coach fares" />);

    const headers = screen.getAllByRole("columnheader");
    expect(headers[headers.length - 1]).toHaveTextContent("Source");
  });
});

describe("telling an empty collection apart from an unmatched prefix", () => {
  it("blames the prefix when the collection does hold records", () => {
    const table = buildDataTable({
      edition: "winter",
      collection: "shuttles",
      idPrefix: "no-such-operator-",
    });

    expect(table.empty).toBe(true);
    expect(table.collectionEmpty).toBe(false);
    expect(table.unsupported).toBe(false);
  });

  it("shows the prefix in the notice, because that is what matched nothing", () => {
    render(
      <DataBlock
        edition="winter"
        collection="stages"
        idPrefix="no-such-stage"
        caption="A stage that does not exist"
      />,
    );

    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent("No checked records for this section yet");
    expect(notice).toHaveTextContent("no-such-stage");
    expect(notice).not.toHaveTextContent("holds no");
  });

  it("names the collection, not the prefix, when the edition holds no records at all", () => {
    render(<DataBlock edition="belgium" collection="shuttles" caption="Belgium shuttles" />);

    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent("The Belgium data holds no shuttles records");
    expect(notice).not.toHaveTextContent("(all records)");
  });
});

describe("shortAnswer", () => {
  it("cuts at the first sentence", () => {
    expect(shortAnswer("First sentence here. Second sentence follows.")).toBe("First sentence here.");
  });

  it("removes emphasis and link syntax", () => {
    expect(shortAnswer("A **bold** claim with [a link](/guides). Another.")).toBe(
      "A bold claim with a link.",
    );
  });

  it("flattens line breaks into spaces", () => {
    expect(shortAnswer("One line.\n\nAnother line.")).toBe("One line.");
  });

  it("truncates a single long sentence with an ellipsis", () => {
    const long = `${"word ".repeat(80)}end`;
    const answer = shortAnswer(long);
    expect(answer.length).toBeLessThanOrEqual(220);
    expect(answer.endsWith("…")).toBe(true);
  });

  it("returns the whole text when there is no sentence end", () => {
    expect(shortAnswer("No full stop here")).toBe("No full stop here");
  });
});
