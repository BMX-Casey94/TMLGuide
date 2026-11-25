import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/admin-console";

/**
 * The admin console page.
 *
 * ## Why it is a thin shell
 *
 * The console reads its session from memory, in the browser, and sends the token
 * to the API on every request, where `requireAdminSession` verifies it against
 * Supabase. That means no part of this page reads cookies or headers on the
 * server, so it prerenders into the static shell under `cacheComponents` and there
 * is nothing to wrap in a `<Suspense>` boundary.
 *
 * Putting the session read on the server would be no safer — the API would still
 * have to verify the token itself, because that is the only place a check actually
 * protects data — and it would make the route dynamic for no gain.
 *
 * ## Not indexed, and not linked
 *
 * `robots` keeps it out of search results, and nothing in the site header or
 * footer points at it: an administrator knows the address. The page itself holds
 * nothing sensitive; the data it can reach is behind the API, which answers `401`
 * to anyone without a verified `aal2` administrator session.
 */
export const metadata: Metadata = {
  title: "Admin console",
  description: "Secured publishing console for the site operator.",
  // `follow: false` as well as `index: false`: a crawler that finds this page
  // should not walk out of it into the public site and treat this as a hub.
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main id="main" className="tml-admin-main">
      <AdminConsole />
    </main>
  );
}
