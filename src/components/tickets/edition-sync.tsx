"use client";

/**
 * Keeps the shell's edition accent in step with the URL.
 *
 * The URL is the source of truth for which edition is on screen, but the site
 * shell switches its accent from its own edition state. Without this, a visitor
 * reading the Winter page would still see the Belgium accent. The component writes
 * the URL's edition into that state, which also persists it for the rest of the
 * visit, so navigating back to a guide shows the accent the visitor was last
 * looking at.
 *
 * It renders nothing, so it can sit inside the page without affecting layout, and
 * it never reads the URL back into storage on the first paint: the server already
 * rendered the correct edition from `searchParams`.
 */
import { useEffect } from "react";
import { useEdition } from "@/components/shell";
import type { TicketEditionId } from "./routes";

export interface EditionSyncProps {
  edition: TicketEditionId;
}

export function EditionSync({ edition }: EditionSyncProps) {
  const { edition: shellEdition, setEdition } = useEdition();

  useEffect(() => {
    if (shellEdition !== edition) setEdition(edition);
  }, [edition, shellEdition, setEdition]);

  return null;
}
