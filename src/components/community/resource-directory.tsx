import type { Resource } from "@/data/schemas";
import { cx } from "@/components/ui/cx";
import { formatCheckDate, sourceHost } from "./card-format";
import {
  groupResourcesByCategory,
  isDocumentLink,
  resourceBadge,
  resourceProvenance,
} from "./resource-groups";

export interface ResourceDirectoryProps {
  resources: readonly Resource[];
  className?: string;
}

/** Badge colours differ by provenance, and the text says the same thing, so colour is never the only signal. */
function badgeClass(resource: Resource): string {
  return resourceProvenance(resource) === "official"
    ? "border-teal/50 text-teal"
    : "border-hair-strong text-cream-mute";
}

/**
 * The community resources list, grouped by category.
 *
 * Each entry prints who published it, what it is for, and when the link was last
 * checked. Everything else on the card comes from the record, so nothing here
 * can drift from the data: the description in particular is the record's own,
 * which is where the "unofficial" claims live.
 */
export function ResourceDirectory({ resources, className }: ResourceDirectoryProps) {
  const groups = groupResourcesByCategory(resources);

  if (groups.length === 0) {
    return (
      <p className={cx("mt-8 rounded-[var(--radius-card)] border border-hair bg-surface/40 p-8 text-center text-sm text-cream-mute", className)}>
        No resources are published yet.
      </p>
    );
  }

  return (
    <div className={cx("mt-8 flex flex-col gap-12", className)}>
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`resources-${group.category}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hair pb-3">
            <h3 id={`resources-${group.category}`} className="font-display text-2xl">
              {group.label}
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cream-mute">
              {group.resources.length} {group.resources.length === 1 ? "link" : "links"}
            </p>
          </div>

          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {group.resources.map((resource) => {
              const badge = resourceBadge(resource);
              const checked = formatCheckDate(resource.lastVerified);
              const host = sourceHost(resource.url);
              const official = resourceProvenance(resource) === "official";

              return (
                <li key={resource.id}>
                  <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-hair bg-gradient-to-b from-surface-2 to-surface p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {badge === null ? null : (
                        <span
                          className={cx(
                            "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                            badgeClass(resource),
                          )}
                        >
                          {badge}
                        </span>
                      )}
                      {isDocumentLink(resource) ? (
                        <span className="rounded-full border border-hair px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
                          Document
                        </span>
                      ) : null}
                    </div>

                    <h4 className="mt-3 font-display text-lg leading-snug [overflow-wrap:anywhere]">
                      {resource.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-cream-mute">{resource.description}</p>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
                        {host === null ? "Source link" : `Source: ${host}`}
                        {checked === null ? null : (
                          <>
                            {" · "}
                            Checked <time dateTime={resource.lastVerified}>{checked}</time>
                          </>
                        )}
                      </p>

                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cx(
                          "inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] underline-offset-4 hover:underline",
                          official ? "text-teal" : "text-accent",
                        )}
                      >
                        Open
                        <span aria-hidden="true">↗</span>
                        <span className="sr-only">{` — ${resource.title} (opens in a new tab)`}</span>
                      </a>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
