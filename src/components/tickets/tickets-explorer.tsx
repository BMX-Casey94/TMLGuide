"use client";

/**
 * The in-page drill-down: categories, then packages, then one package.
 *
 * The level shown comes from the URL, not from component state, so every view has
 * an address, the back and forward buttons work, and a link to one package can be
 * shared or crawled. Navigation is performed with `next/link`, which renders a
 * plain anchor: a visitor without JavaScript still gets the whole catalogue by
 * following links and the server renders each level in full.
 *
 * What this component adds on top of that is interaction the server cannot
 * provide: focus moved to the new heading after a drill-down so a keyboard or
 * screen-reader user is not left at the top of the page, a polite live region
 * announcing how many packages the new level holds, and the comparison tickboxes.
 */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon3D } from "@/components/ui/icon-3d";
import { ComparisonProvider, useComparison } from "./comparison";
import { CompareToggle } from "./compare-toggle";
import { ComparisonTable } from "./comparison-table";
import { PackageCard } from "./package-card";
import { PriceTiers } from "./price-tiers";
import { SourceLine } from "./source-line";
import { buildTicketHref, type TicketEditionId } from "./routes";
import { findCategory, findItem } from "./catalogue";
import type { CatalogueCategory, CatalogueItem, EditionCatalogue } from "./types";
import "./tickets.css";

export interface TicketsExplorerProps {
  catalogue: EditionCatalogue;
  /** The category id from the URL, when present. */
  categoryId?: string;
  /** The package id from the URL, when present and valid. */
  packageId?: string;
}

/* ---------------------------------------------------------------------------------------------
 * Breadcrumb
 * --------------------------------------------------------------------------------------------- */

interface Crumb {
  label: string;
  href?: string;
}

function Breadcrumb({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="tml-tix-crumbs">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} style={{ display: "contents" }}>
              {index > 0 ? (
                <span className="tml-tix-crumbs__sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              {crumb.href === undefined || isLast ? (
                <span
                  className="tml-tix-crumbs__current"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link className="tml-tix-crumbs__link" href={crumb.href}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Levels
 * --------------------------------------------------------------------------------------------- */

function CategoryGrid({
  catalogue,
  edition,
}: {
  catalogue: EditionCatalogue;
  edition: TicketEditionId;
}) {
  return (
    <ul className="tml-tix-grid">
      {catalogue.categories.map((category) => {
        const count = category.items.length;
        return (
          <li key={category.id} style={{ display: "flex" }}>
            <Link
              className="tml-tix-cat"
              href={buildTicketHref({ edition, category: category.id })}
            >
              <Icon3D name={category.icon} size={44} glow />
              <p className="label text-cream-mute">{category.kicker}</p>
              <h3 className="tml-tix-cat__title">{category.label}</h3>
              <p className="tml-tix-note">{category.description}</p>
              <p className="tml-tix-cat__count">
                {count === 0
                  ? "No price published yet"
                  : `${count} ${count === 1 ? "package" : "packages"}`}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PackageList({
  catalogue,
  category,
  edition,
}: {
  catalogue: EditionCatalogue;
  category: CatalogueCategory;
  edition: TicketEditionId;
}) {
  const all = catalogue.categories.flatMap((entry) => entry.items);

  if (category.items.length === 0) {
    return (
      <div className="tml-tix-unpublished">
        <p className="tml-tix-unpublished__label">No price published yet</p>
        <p className="tml-tix-unpublished__reason">{category.emptyNote}</p>
        {category.emptyUrl ? (
          <p className="tml-tix-unpublished__link">
            <a
              className="tml-tix-source__link"
              href={category.emptyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official page
              <span className="tml-tix-sr"> for {category.label} (opens in a new tab)</span>
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="tml-tix-grid">
        {category.items.map((item) => (
          <PackageCard
            key={item.id}
            item={item}
            headingLevel={3}
            detailHref={buildTicketHref({
              edition,
              category: category.id,
              package: item.id,
            })}
            compareControl={<CompareToggle itemId={item.id} itemName={item.name} />}
          />
        ))}
      </div>
      <ComparisonTable items={all} editionLabel={catalogue.label} />
    </>
  );
}

/** One product in full: every tier, its inclusions, its note and its citation. */
function PackageDetail({
  item,
  category,
  edition,
}: {
  item: CatalogueItem;
  category: CatalogueCategory;
  edition: TicketEditionId;
}) {
  const { selectedIds, isFull, toggle } = useComparison();
  const checked = selectedIds.includes(item.id);
  const disabled = !checked && isFull;

  return (
    <div className="tml-tix-card" style={{ maxWidth: "46rem" }}>
      {item.badges.length > 0 ? (
        <ul className="tml-tix-card__badges">
          {item.badges.map((badge) => (
            <li key={badge} className="tml-tix-badge">
              {badge}
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="tml-tix-focus" id="package-heading" tabIndex={-1}>
        {item.name}
      </h2>
      {item.qualifier ? <p className="tml-tix-card__qualifier">{item.qualifier}</p> : null}

      <PriceTiers item={item} />

      {item.includes.length > 0 ? (
        <>
          <h3 className="tml-tix-tier__label">What is included</h3>
          <ul className="tml-tix-includes">
            {item.includes.map((inclusion) => (
              <li key={inclusion}>{inclusion}</li>
            ))}
          </ul>
        </>
      ) : null}

      {item.note ? (
        <>
          <h3 className="tml-tix-tier__label">From the official page</h3>
          <p className="tml-tix-note">{item.note}</p>
        </>
      ) : null}

      {item.tiers.length > 1 ? (
        <>
          <h3 className="tml-tix-tier__label">Where each price applies</h3>
          <ul className="tml-tix-includes">
            {item.tiers.map((tier) => (
              <li key={tier.key}>
                <strong>
                  {tier.label} ({tier.year})
                </strong>
                {tier.note ? ` — ${tier.note}` : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <SourceLine source={item.source} lastVerified={item.lastVerified} />

      <div className="tml-tix-actions">
        <label
          className={disabled ? "tml-tix-compare tml-tix-compare--disabled" : "tml-tix-compare"}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={() => toggle(item.id)}
            aria-label={`Add ${item.name} to the comparison`}
          />
          <span aria-hidden="true">{checked ? "In comparison" : "Add to comparison"}</span>
        </label>
        <Link
          className="tml-tix-open"
          href={buildTicketHref({ edition, category: category.id })}
        >
          <span aria-hidden="true">←</span> Back to {category.label}
        </Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Explorer
 * ------------------------------------------------------------------------------------------- */

function ExplorerBody({ catalogue, categoryId, packageId }: TicketsExplorerProps) {
  const edition = catalogue.edition;
  const category = findCategory(catalogue, categoryId);
  const item = findItem(category, packageId);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const previousView = useRef<string | null>(null);

  const viewKey = `${categoryId ?? "root"}|${item?.id ?? "none"}`;

  /*
    Move focus to the new region's heading after a drill-down, but not on the
    first render: a visitor who lands on a deep link should start at the top of
    the page, not have focus stolen into the middle of it.
  */
  useEffect(() => {
    const previous = previousView.current;
    previousView.current = viewKey;
    if (previous === null || previous === viewKey) return;
    const target =
      document.getElementById("package-heading") ??
      document.getElementById("level-heading") ??
      headingRef.current;
    target?.focus();
  }, [viewKey]);

  const crumbs: Crumb[] = [{ label: "Tickets", href: buildTicketHref({ edition }) }];
  if (category !== undefined) {
    crumbs.push({
      label: category.label,
      href: buildTicketHref({ edition, category: category.id }),
    });
  }
  if (item !== undefined) crumbs.push({ label: item.name });

  const packageCount = category?.items.length ?? 0;
  const categoryCount = catalogue.categories.length;
  const categoryWord = categoryCount === 1 ? "category" : "categories";
  const totalProducts = catalogue.categories.reduce(
    (total, entry) => total + entry.items.length,
    0,
  );

  return (
    <>
      <Breadcrumb crumbs={crumbs} />

      {/* A polite live region: the count changes on drill-down, and a screen
          reader hears the new total without focus moving to it. */}
      <p className="tml-tix-sr" role="status" aria-live="polite">
        {item !== undefined
          ? `${item.name} details shown.`
          : category !== undefined
            ? `${packageCount} ${packageCount === 1 ? "package" : "packages"} in ${category.label}.`
            : `${categoryCount} ${categoryWord} of tickets and packages for ${catalogue.label}, with ${totalProducts} products in total.`}
      </p>

      <div style={{ marginTop: "1.5rem" }}>
        {item !== undefined && category !== undefined ? (
          <PackageDetail item={item} category={category} edition={edition} />
        ) : category !== undefined ? (
          <section aria-labelledby="level-heading">
            <p className="label text-accent">{category.kicker}</p>
            <h2
              className="tml-tix-focus"
              id="level-heading"
              tabIndex={-1}
              ref={headingRef}
              style={{
                margin: "0.4rem 0 0",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.75rem, 3.4vw, 2.5rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
              }}
            >
              {category.label}
            </h2>
            <p className="tml-tix-note" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
              {category.description}
            </p>
            <div style={{ marginTop: "1.5rem" }}>
              <PackageList catalogue={catalogue} category={category} edition={edition} />
            </div>
          </section>
        ) : (
          <section aria-labelledby="level-heading">
            {/*
              A visible heading, not a visually hidden one. Focus moves here when a
              visitor comes back from a category, and focus must never land on
              something that cannot be seen.
            */}
            <h2 className="tml-tix-focus tml-tix-cat-heading" id="level-heading" tabIndex={-1} ref={headingRef}>
              Browse by category
            </h2>
            <CategoryGrid catalogue={catalogue} edition={edition} />
          </section>
        )}
      </div>
    </>
  );
}

export function TicketsExplorer(props: TicketsExplorerProps) {
  return (
    <ComparisonProvider>
      <ExplorerBody {...props} />
    </ComparisonProvider>
  );
}
