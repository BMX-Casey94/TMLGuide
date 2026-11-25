// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  assertUniqueIds,
  partnerSchema,
  resourceSchema,
  whatsappGroupSchema,
} from "../schemas";
import { communityData, partners, resources, validateCommunityData, whatsappGroups } from "./index";

const INPUT_PATH = fileURLToPath(
  new URL("../../../docs/factcheck/links-input.json", import.meta.url),
);

/**
 * The three resources the 2026-11-25 link run found behind a redirect.
 *
 * `docs/factcheck/links-input.json` records what the old site published, so it
 * still names the redirecting address. Each record here is a measurement: the
 * input URL, the address its chain ended on with a 200, the hops in between, and
 * the date it was followed. The allowlist below is exactly this table, so a
 * fourth published URL the input does not mention cannot slip in unnoticed.
 */
const RESOLVED_REDIRECTS = [
  {
    resourceId: "resource-discord",
    from: "https://discord.gg/tomorrowland",
    to: "https://discord.com/invite/tomorrowland",
    hops: 1,
  },
  {
    resourceId: "resource-radio",
    from: "https://www.tomorrowland.com/home/one-world-radio/",
    to: "https://www.tomorrowland.com/one-world-radio/",
    hops: 2,
  },
  {
    resourceId: "resource-official",
    from: "https://www.tomorrowland.com/home/",
    to: "https://www.tomorrowland.com/",
    hops: 2,
  },
] as const;

/** The date those three chains were followed and their final addresses answered 200. */
const REDIRECTS_CHECKED_ON = "2026-11-25";

interface InputLink {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly url: string;
}

const inputLinks: readonly InputLink[] = JSON.parse(readFileSync(INPUT_PATH, "utf8"));

/**
 * Compares links by what they point at rather than by how they were typed: the
 * old data mixed plain http:// and https:// spellings of the same URL, and the
 * guide is only allowed to publish the https one.
 */
function normalise(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = "https:";
  return parsed.toString();
}

const inputUrls = new Set(inputLinks.map((link) => normalise(link.url)));

const everyRecord: readonly { readonly id: string; readonly url: string }[] = [
  ...communityData.whatsappGroups.map((group) => ({ id: group.id, url: group.inviteUrl })),
  ...communityData.resources.map((resource) => ({ id: resource.id, url: resource.url })),
  ...communityData.partners.map((partner) => ({ id: partner.id, url: partner.url })),
];

describe("community data", () => {
  it("parses every record with its schema", () => {
    expect(() => validateCommunityData()).not.toThrow();
  });

  it("validates each collection record by record", () => {
    for (const group of whatsappGroups) {
      expect(whatsappGroupSchema.safeParse(group).success).toBe(true);
    }
    for (const resource of resources) {
      expect(resourceSchema.safeParse(resource).success).toBe(true);
    }
    for (const partner of partners) {
      expect(partnerSchema.safeParse(partner).success).toBe(true);
    }
  });

  // A tripwire rather than a specification: the counts reconcile against the
  // fact-check input, so a record silently dropped or duplicated in a later edit
  // fails here instead of quietly shrinking the page.
  it("publishes the measured counts", () => {
    expect(communityData.whatsappGroups).toHaveLength(24);
    expect(communityData.resources).toHaveLength(19);
    expect(communityData.partners).toHaveLength(6);
  });

  it("has unique ids within each collection", () => {
    expect(() => assertUniqueIds(communityData.whatsappGroups)).not.toThrow();
    expect(() => assertUniqueIds(communityData.resources)).not.toThrow();
    expect(() => assertUniqueIds(communityData.partners)).not.toThrow();
  });

  it("has unique ids across all three collections", () => {
    const ids = [
      ...communityData.whatsappGroups.map((group) => group.id),
      ...communityData.resources.map((resource) => resource.id),
      ...communityData.partners.map((partner) => partner.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses https for every URL, including the citation", () => {
    for (const record of everyRecord) {
      expect(record.url.startsWith("https://")).toBe(true);
    }

    const citedUrls = [
      ...communityData.whatsappGroups.map((group) => group.source.url),
      ...communityData.resources.map((resource) => resource.source.url),
      ...communityData.partners.map((partner) => partner.source.url),
    ];
    for (const url of citedUrls) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  it("cites each record's own URL as its source", () => {
    for (const group of communityData.whatsappGroups) {
      expect(group.source.url).toBe(group.inviteUrl);
    }
    for (const resource of communityData.resources) {
      expect(resource.source.url).toBe(resource.url);
    }
    for (const partner of communityData.partners) {
      expect(partner.source.url).toBe(partner.url);
    }
  });

  it("does not publish the revoked Festival Outfits invite", () => {
    const ids = everyRecord.map((record) => record.id);
    expect(ids).not.toContain("wa-24");

    const urls = everyRecord.map((record) => record.url);
    expect(urls).not.toContain("https://chat.whatsapp.com/K4PsxsSsqVPBkmJM3FoVfO");
  });

  it("does not publish the closed W2 general chat", () => {
    const ids = everyRecord.map((record) => record.id);
    expect(ids).not.toContain("wa-4");

    const urls = everyRecord.map((record) => record.url);
    expect(urls).not.toContain("https://chat.whatsapp.com/DmeA53dRZpW3x2afZKRgHS");
  });

  it("links only to URLs that appear in the factcheck input, or to a measured final address", () => {
    /*
      Three records legitimately publish an address the input does not contain:
      the input recorded a URL that only redirects, and the site stores the
      address a reader actually lands on. That is allowed only for an entry in
      RESOLVED_REDIRECTS, so a URL nobody measured still fails here.
    */
    const resolvedTargets = new Set(RESOLVED_REDIRECTS.map((redirect) => normalise(redirect.to)));
    const unknown = everyRecord.filter(
      (record) => !inputUrls.has(normalise(record.url)) && !resolvedTargets.has(normalise(record.url)),
    );
    expect(unknown).toEqual([]);
  });

  it("moves a redirecting URL only where the fact check measured the destination", () => {
    for (const redirect of RESOLVED_REDIRECTS) {
      // The address it replaces is one the fact check actually read.
      expect(inputUrls.has(normalise(redirect.from)), redirect.from).toBe(true);

      // It moves an existing record to that destination, and the hop is gone.
      const record = resources.find((resource) => resource.id === redirect.resourceId);
      expect(normalise(record?.url ?? ""), redirect.resourceId).toBe(normalise(redirect.to));

      const stillPublished = everyRecord.filter(
        (entry) => normalise(entry.url) === normalise(redirect.from),
      );
      expect(stillPublished, redirect.from).toEqual([]);

      // A hop count below one would mean this is not a redirect at all.
      expect(redirect.hops, redirect.resourceId).toBeGreaterThan(0);
    }
  });

  it("dates each moved resource on the day its final address was measured", () => {
    for (const redirect of RESOLVED_REDIRECTS) {
      const record = communityData.resources.find((resource) => resource.id === redirect.resourceId);
      expect(record?.lastVerified, redirect.resourceId).toBe(REDIRECTS_CHECKED_ON);
      expect(record?.source.retrievedOn, redirect.resourceId).toBe(REDIRECTS_CHECKED_ON);
    }
  });

  it("does not date any other resource as freshly as the redirect run", () => {
    // A record whose URL nobody re-opened must not borrow the newer date: the
    // card prints `lastVerified`, so a wrong date claims a check that did not
    // happen. Only the three measured records may carry the later date.
    const moved = new Set<string>(RESOLVED_REDIRECTS.map((redirect) => redirect.resourceId));
    for (const record of communityData.resources) {
      if (moved.has(record.id)) continue;
      expect(record.lastVerified, record.id).toBe("2026-11-18");
    }
  });

  it("gives every partner a disclosure of at least 20 characters", () => {
    for (const partner of communityData.partners) {
      expect(partner.disclosure.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("never gives an official label to a non-tomorrowland source", () => {
    const allRecords = [
      ...communityData.whatsappGroups,
      ...communityData.resources,
      ...communityData.partners,
    ];
    for (const record of allRecords) {
      if (record.confidence !== "official") continue;

      const host = new URL(record.source.url).hostname.toLowerCase();
      expect(host === "tomorrowland.com" || host.endsWith(".tomorrowland.com")).toBe(true);
    }
  });

  it("uses only ok or unchecked link statuses", () => {
    for (const group of communityData.whatsappGroups) {
      expect(["ok", "unchecked"]).toContain(group.linkStatus);
    }
  });

  it("records the link check date on every group it publishes as ok", () => {
    for (const group of communityData.whatsappGroups) {
      if (group.linkStatus !== "ok") continue;
      expect(group.lastLinkCheck).toBe("2026-11-18");
    }
  });

  it("marks the third-party resources as unofficial in their descriptions", () => {
    const thirdParty = communityData.resources.filter((resource) =>
      resource.url.includes("festivalviewer.com"),
    );
    expect(thirdParty.length).toBeGreaterThan(0);
    for (const resource of thirdParty) {
      expect(resource.description.toLowerCase()).toContain("third-party");
    }
  });
});
