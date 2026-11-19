import type { GuideChapter } from "../schema";
import { accommodationChapter } from "./accommodation";
import { belgiumChaptersB } from "./index-b";
import { datesAndSalesChapter } from "./dates-and-sales";
import { dreamvilleChapter } from "./dreamville";
import { overviewChapter } from "./overview";
import { ticketsChapter } from "./tickets";

/**
 * Chapters for this edition, owned by the content workstream.
 *
 * Part A (declared here): overview, dates-and-sales, tickets, accommodation,
 * dreamville. Part B (transport, global-journey, add-ons, food-drinks, faq)
 * lives in `./index-b` and is spread in after them, so orders 1–5 and 6–10 stay
 * in reading order without either workstream renumbering the other's chapters.
 */
export const belgiumChapters: readonly GuideChapter[] = [
  overviewChapter,
  datesAndSalesChapter,
  ticketsChapter,
  accommodationChapter,
  dreamvilleChapter,
  ...belgiumChaptersB,
];
