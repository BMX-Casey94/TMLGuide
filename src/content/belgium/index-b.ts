import type { GuideChapter } from "../schema";
import { addOnsChapter } from "./add-ons";
import { faqChapter } from "./faq";
import { foodDrinksChapter } from "./food-drinks";
import { globalJourneyChapter } from "./global-journey";
import { transportChapter } from "./transport";

/**
 * Part B of the Belgium chapter set: transport, Global Journey, add-ons, food
 * and drink, and the rules chapter.
 *
 * The five chapters here are the ones this workstream owns. `index.ts` holds the
 * rest of the edition and is assembled by another workstream, so this module
 * exports its own list rather than editing that file. Slugs are unique within
 * the edition and orders 6–10 sit after the five chapters part A owns.
 */
export const belgiumChaptersB: readonly GuideChapter[] = [
  transportChapter,
  globalJourneyChapter,
  addOnsChapter,
  foodDrinksChapter,
  faqChapter,
];
