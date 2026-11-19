import type { GuideChapter } from "../schema";
import { winterOverviewChapter } from "./overview";
import { winterTicketsAndPackagesChapter } from "./tickets-and-packages";
import { winterAccommodationChapter } from "./accommodation";
import { winterTransportChapter } from "./transport";
import { winterStagesAndHoursChapter } from "./stages-and-hours";
import { winterClothingAndLockersChapter } from "./clothing-and-lockers";
import { winterLessonsAndGearChapter } from "./lessons-and-gear";
import { winterAddOnsChapter } from "./add-ons";

/**
 * The Winter guide, in reading order.
 *
 * Every chapter is typed data validated by `guideChapterSchema`, so a source
 * reference that points at nothing fails at module load rather than in the
 * browser. Prices never live in this folder: a chapter shows them through a
 * `data` block that renders from `src/data/winter`.
 */
export const winterChapters: readonly GuideChapter[] = [
  winterOverviewChapter,
  winterTicketsAndPackagesChapter,
  winterAccommodationChapter,
  winterTransportChapter,
  winterStagesAndHoursChapter,
  winterClothingAndLockersChapter,
  winterLessonsAndGearChapter,
  winterAddOnsChapter,
];
