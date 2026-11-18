import { z } from "zod";

import {
  assertUniqueIds,
  partnerSchema,
  resourceSchema,
  type Partner,
  type Resource,
  type WhatsappGroup,
  whatsappGroupSchema,
} from "../schemas";
import { partners } from "./partners";
import { resources } from "./resources";
import { whatsappGroups } from "./whatsapp-groups";

export { partners, resources, whatsappGroups };

/**
 * The three community collections, parsed and checked as one unit.
 *
 * Everything a consumer reads from this module has already been through its
 * schema, so a plain-http invite, a missing citation or a partner without a
 * disclosure fails at import time rather than rendering on the site.
 */
export interface CommunityData {
  readonly whatsappGroups: readonly WhatsappGroup[];
  readonly resources: readonly Resource[];
  readonly partners: readonly Partner[];
}

/**
 * Parses records one at a time and reports the first failure with its index,
 * its id (when it has one) and every issue the schema found.
 *
 * Zod's own messages do not say which record in a hand-written array failed, so
 * the label and index are added here; without them a build error in a file of
 * two dozen records is a hunt.
 */
function parseAll<T>(
  schema: z.ZodType<T>,
  records: readonly unknown[],
  label: string,
): readonly T[] {
  return records.map((record, index) => {
    const result = schema.safeParse(record);
    if (!result.success) {
      const id = (record as { id?: unknown } | null)?.id;
      const where = typeof id === "string" ? `${label}[${index}] (id "${id}")` : `${label}[${index}]`;
      throw new Error(`${where} failed validation:\n${z.prettifyError(result.error)}`);
    }
    return result.data;
  });
}

/**
 * Asserts that a record claiming official provenance is actually citing a
 * tomorrowland.com host.
 *
 * "official" is a promise to the reader that the festival itself said this, so
 * a typo in one record must not let a fan page or a shortener borrow the label.
 */
function assertOfficialConfidenceIsHosted(record: {
  readonly id: string;
  readonly confidence: string;
  readonly source: { readonly url: string };
}): void {
  if (record.confidence !== "official") return;

  const host = new URL(record.source.url).hostname.toLowerCase();
  const isTomorrowlandHost = host === "tomorrowland.com" || host.endsWith(".tomorrowland.com");
  if (!isTomorrowlandHost) {
    throw new Error(
      `community data: "${record.id}" claims official confidence but cites ${host}, which is not a tomorrowland.com host`,
    );
  }
}

/**
 * Parses and cross-checks the community data.
 *
 * The schemas validate one record at a time, so this adds the checks they cannot
 * make: distinct ids across all three collections, and official confidence
 * backed by an official host.
 *
 * @returns the parsed collections.
 * @throws Error naming the offending record and every schema issue it raised.
 */
export function validateCommunityData(): CommunityData {
  const parsedGroups = parseAll(whatsappGroupSchema, whatsappGroups, "whatsappGroups");
  const parsedResources = parseAll(resourceSchema, resources, "resources");
  const parsedPartners = parseAll(partnerSchema, partners, "partners");

  assertUniqueIds(parsedGroups);
  assertUniqueIds(parsedResources);
  assertUniqueIds(parsedPartners);

  // Ids are internal, but three collections rendered on one page should not
  // share one either: a lookup by id would then depend on which array it read.
  assertUniqueIds([...parsedGroups, ...parsedResources, ...parsedPartners]);

  for (const record of [...parsedGroups, ...parsedResources, ...parsedPartners]) {
    assertOfficialConfidenceIsHosted(record);
  }

  return {
    whatsappGroups: parsedGroups,
    resources: parsedResources,
    partners: parsedPartners,
  };
}

export const communityData: CommunityData = validateCommunityData();
