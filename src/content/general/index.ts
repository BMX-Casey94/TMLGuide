import type { GuideChapter } from "../schema";
import { generalEditionsChapter } from "./editions";
import { generalNftChapter } from "./nft";
import { generalPearlsChapter } from "./pearls";
import { generalRadioChapter } from "./radio";
import { generalSetsChapter } from "./sets";

/** Chapters for the festival-wide guide, in reading order. */
export const generalChapters: readonly GuideChapter[] = [
  generalPearlsChapter,
  generalRadioChapter,
  generalSetsChapter,
  generalNftChapter,
  generalEditionsChapter,
];
