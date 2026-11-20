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
 *
 * The effect depends on the URL prop alone, never on the shell's current edition.
 * Reading the shell edition here would make the page undo a click on BE / WI / BR
 * in the header switcher: the click changes the shell state, the effect runs again,
 * sees a value that no longer matches the unchanged URL, and writes the URL's
 * edition back. One direction only — URL to shell — leaves the header switcher in
 * charge of the visitor's choice.
 */
import { useEffect } from "react";
import { useEdition } from "@/components/shell";
import type { TicketEditionId } from "./routes";

export interface EditionSyncProps {
  edition: TicketEditionId;
}

export function EditionSync({ edition }: EditionSyncProps) {
  const { setEdition } = useEdition();

  // `setEdition` is a stable callback (useCallback with no dependencies), so this runs when the
  // URL's edition changes and on mount, and at no other time.
  useEffect(() => {
    setEdition(edition);
  }, [edition, setEdition]);

  return null;
}
