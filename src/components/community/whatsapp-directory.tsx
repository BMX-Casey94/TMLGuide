"use client";

import { useCallback, useId, useMemo, useSyncExternalStore } from "react";
import type { EditionScope, WhatsappGroup } from "@/data/schemas";
import { cx } from "@/components/ui/cx";
import { WhatsappGroupCard } from "./whatsapp-group-card";
import { WhatsappSafetyNote } from "./safety-note";
import {
  EDITION_LABELS,
  NO_WHATSAPP_FILTERS,
  countGroups,
  describeWhatsappResults,
  filterWhatsappGroups,
  groupWhatsappByRegion,
  hasActiveWhatsappFilters,
  whatsappRegionOptions,
  type EditionFilter,
  type WhatsappFilters,
} from "./whatsapp-filter";
import { parseWhatsappFilters, serialiseWhatsappFilters } from "./whatsapp-query";
import {
  currentPathname,
  getSearchSnapshot,
  getServerSearchSnapshot,
  subscribeToUrl,
  writeUrl,
} from "./url-store";

export interface WhatsappDirectoryProps {
  groups: readonly WhatsappGroup[];
  className?: string;
}

const EDITION_ORDER: readonly EditionScope[] = ["belgium", "winter", "brasil", "all"];

/** The server and the first client render both show the unfiltered directory. */
const SERVER_SEARCH = "";

/**
 * The filterable directory of community chats.
 *
 * The filters are the URL query string, full stop. They are read through
 * `useSyncExternalStore`, which gives a defined server snapshot (empty search, so
 * the full directory is prerendered and indexed) and re-renders with the real
 * query immediately after hydration. Nothing is copied into React state, so the
 * controls can never disagree with the address bar, and the back button works
 * because `popstate` is one of the store's triggers.
 *
 * URL handling: typing replaces the current history entry, so a search does not
 * fill the back button one keystroke at a time; the two selects push one entry,
 * so back undoes a whole filter choice.
 */
export function WhatsappDirectory({ groups, className }: WhatsappDirectoryProps) {
  const id = useId();
  const regions = useMemo(() => whatsappRegionOptions(groups), [groups]);

  const search = useSyncExternalStore(subscribeToUrl, getSearchSnapshot, getServerSearchSnapshot);
  const filters = useMemo(
    () => parseWhatsappFilters(new URLSearchParams(search === SERVER_SEARCH ? "" : search), regions),
    [search, regions],
  );

  const visible = useMemo(() => filterWhatsappGroups(groups, filters), [groups, filters]);
  const byRegion = useMemo(() => groupWhatsappByRegion(visible), [visible]);
  const filtered = hasActiveWhatsappFilters(filters);

  const commit = useCallback(
    (next: WhatsappFilters, mode: "push" | "replace") => {
      const query = serialiseWhatsappFilters(next);
      const href = `${currentPathname()}${query === "" ? "" : `?${query}`}${window.location.hash}`;
      writeUrl(href, mode);
    },
    [],
  );

  return (
    <div className={cx("mt-8", className)}>
      <WhatsappSafetyNote variant="full" />

      <div className="mt-8 rounded-[var(--radius-card)] border border-hair bg-surface/50 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-q`} className="label text-cream-mute">
              Search groups
            </label>
            <input
              id={`${id}-q`}
              type="search"
              value={filters.q}
              autoComplete="off"
              onChange={(event) => commit({ ...filters, q: event.target.value }, "replace")}              placeholder="DreamVille, taxi, tickets…"
              className="min-h-11 w-full rounded-full border border-hair-strong bg-ground/60 px-4 text-sm text-cream placeholder:text-cream-mute/70 focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-edition`} className="label text-cream-mute">
              Edition
            </label>
            <select
              id={`${id}-edition`}
              value={filters.edition}
              onChange={(event) =>
                commit({ ...filters, edition: event.target.value as EditionFilter }, "push")
              }
              className="min-h-11 w-full rounded-full border border-hair-strong bg-ground/60 px-4 text-sm text-cream focus:border-accent"
            >
              <option value="any">All editions</option>
              {EDITION_ORDER.map((edition) => (
                <option key={edition} value={edition}>
                  {EDITION_LABELS[edition]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-region`} className="label text-cream-mute">
              Region
            </label>
            <select
              id={`${id}-region`}
              value={filters.region ?? ""}
              onChange={(event) =>
                commit(
                  { ...filters, region: event.target.value === "" ? null : event.target.value },
                  "push",
                )
              }
              className="min-h-11 w-full rounded-full border border-hair-strong bg-ground/60 px-4 text-sm text-cream focus:border-accent"
            >
              <option value="">All regions</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4">
          {/* The count is the visible twin of the live region below, so sighted and
              screen reader users get the same information at the same moment. */}
          <p
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-cream-mute"
            aria-hidden="true"
          >
            {countGroups(visible.length)}
          </p>

          {filtered ? (
            <button
              type="button"
              onClick={() => commit(NO_WHATSAPP_FILTERS, "push")}
              className="inline-flex min-h-11 items-center rounded-full border border-hair-strong px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-cream transition-colors hover:border-accent hover:text-accent"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {/*
          One polite region for the whole directory. It is rendered from the first
          paint so the browser has something to announce into; changing the text
          inside it is what triggers the announcement.
        */}
        <p role="status" aria-live="polite" className="sr-only">
          {describeWhatsappResults(visible.length, groups.length)}
        </p>
      </div>

      {byRegion.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-card)] border border-hair bg-surface/40 p-8 text-center">
          {/*
            A heading, so the empty result is a navigable target rather than an
            anonymous paragraph. The clear control lives once, in the filter bar
            above, so this state does not duplicate it.

            An empty publication is not "no matches": there is nothing to match.
          */}
          <h3 className="font-display text-xl">
            {groups.length === 0 ? "No groups are published yet" : "No groups match those filters"}
          </h3>
          <p className="mt-2 text-sm text-cream-mute">
            {groups.length === 0
              ? "When a chat has been checked and confirmed live, it appears here with its region and edition."
              : "Try a broader search, or use Clear filters above to see every group."}
          </p>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-12">
          {byRegion.map((section) => {
            const headingId = `${id}-region-${section.region
              .replace(/[^a-z0-9]+/gi, "-")
              .toLowerCase()}`;
            return (
              <section key={section.region} aria-labelledby={headingId}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hair pb-3">
                  <h3 id={headingId} className="font-display text-2xl">
                    {section.region}
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cream-mute">
                    {countGroups(section.groups.length)}
                  </p>
                </div>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.groups.map((group) => (
                    <li key={group.id} className="flex">
                      <WhatsappGroupCard group={group} className="w-full" />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
