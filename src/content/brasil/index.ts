import type { GuideChapter } from "../schema";
import { brasilDreamvilleChapter } from "./dreamville";
import { brasilOverviewChapter } from "./overview";
import { brasilTicketsChapter } from "./tickets";
import { brasilTransportChapter } from "./transport";

/** Chapters for the Tomorrowland Brasil edition, in reading order. */
export const brasilChapters: readonly GuideChapter[] = [
  brasilOverviewChapter,
  brasilTicketsChapter,
  brasilDreamvilleChapter,
  brasilTransportChapter,
];
