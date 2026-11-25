/**
 * Labels the admin console prints for stored states.
 *
 * Kept out of the component files so a label can be asserted once and used by both
 * the table and the editor, and so a status added to the enum is a type error here
 * rather than a blank cell in the console.
 */

import type { NewsStatus } from "@/lib/community/news-schema";

export const NEWS_STATUS_LABELS: Readonly<Record<NewsStatus, string>> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

/** The statuses in the order the select offers them: the usual path, then the exception. */
export const NEWS_STATUS_ORDER: readonly NewsStatus[] = ["draft", "published", "archived"];
