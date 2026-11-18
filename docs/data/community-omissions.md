# Community data omissions

Everything from `docs/factcheck/links-input.json` that is **not** published in
`src/data/community/`, and why. Counts are taken from the link check run on
2026-11-18 (`docs/factcheck/links.md`).

Of the 53 input links, 50 are published as data records and 3 are omitted.

## Omitted records

| Input id | Kind | Title | Input URL | Measured status | Reason for omission |
| --- | --- | --- | --- | --- | --- |
| `wa-24` | WhatsApp group | 👠✨ Festival Outfits 💫👗 | `https://chat.whatsapp.com/K4PsxsSsqVPBkmJM3FoVfO` | dead | The invite is invalid or revoked: the page is a generic invite shell with no group name. There is no group to publish, so the record is dropped rather than shipped with `linkStatus: "dead"`. |
| `wa-4` | WhatsApp group | Weekend 2 (General Chat) 💬 | `https://chat.whatsapp.com/DmeA53dRZpW3x2afZKRgHS` | ok | The invite resolves, but the page now shows the group name "W2 chat closed". The link works and the group does not, so publishing it as an active chat would mislead readers. Excluded from the array; if it is ever reinstated, it should be re-checked first. |
| `resource-faqs` | Resource | FAQs | `https://faq.tomorrowland.com/` | blocked (403) | `resourceSchema` has no `linkStatus` field, so an "unchecked" resource cannot be represented, and a 403 is not evidence that the page works for a reader. Omitted rather than guessed at; see the schema gap below. |

## Records kept but changed

| Input id | Change | Why |
| --- | --- | --- |
| `wa-9`, `wa-10`, `wa-11`, `wa-12`, `wa-20`, `wa-21` | Plain `http://` invite replaced with its `https://` twin. | The schema accepts https only, and the link check confirmed each https twin answers 200 with a live group name. |
| `resource-travel-partner`, `resource-discord`, `resource-lineup`, `resource-maps`, `resource-prices`, `resource-apps` | Plain `http://` URL replaced with its `https://` twin. | Same reason; each https twin was measured separately and works. |
| `resource-radio` | Old `http://www.tomorrowland.com/home/one-world-radio/` replaced with `https://www.tomorrowland.com/home/one-world-radio/`. | The https twin resolves and saves a redirect hop. |
| `resource-official` | Kept `https://www.tomorrowland.com/home/` (measured `redirected`, final URL `https://www.tomorrowland.com/`). | The input URL works and the redirect is the site's own. The final URL is not in the input, so the test that ties records back to the input would reject it. |
| `resource-prices`, `resource-maps` | Description says "Unofficial third-party tool", category `practical`. | festivalviewer.com is not a Tomorrowland property. |
| `resource-travel-partner` | Category `practical` instead of the old "Travel". | `resourceCategorySchema` has no travel value, and the entry is a Drive document rather than a transport service. |
| `resource-discord` | Title kept verbatim, description notes the membership figure is unverified. | The "25K+ Members" claim and "Official Server" wording come from the old title and were not measured. |
| `partner-rent-a-tent` | Promotion code `DCATRAVEL` with the offer "5% discount", taken from the old site's shared `partners.discountCode` string. | The old site rendered that string only under Rent-a-Tent, but the code reads like DCA Travel's name. Whether the code belongs to Rent-a-Tent or was mis-wired on the old site cannot be settled from the source; it needs one check with the vendor before a reader relies on it. |
| `partner-beat-retreat`, `partner-tomorrowcrazy` | Old marketing adjectives ("Premium", "Luxury") dropped from the offer text. | The remainder is the old site's own description; the adjectives are unverifiable sales language and add nothing a reader can act on. |
| `partner-buy-me-a-coffee` | Published as a partner record with a donation disclosure. | The input categorises it as a `partner` with category "Donations", and the old site opened `buymeacoffee.com/tmlcommunity` from its donation dialog. It is not a commercial relationship, and the disclosure says so. |

## Schema gaps (proposals only, no schema was edited)

1. **`resourceSchema` has no `linkStatus`.** WhatsApp records carry a measured
   link status; resources do not, so a blocked-but-probably-fine link such as
   `faq.tomorrowland.com` has nowhere to live. Proposed: add an optional
   `linkStatus: "ok" | "unchecked" | "dead"` plus `lastLinkCheck`, mirroring
   `whatsappGroupSchema`. That would let the FAQ record be published as
   "unchecked" instead of dropped.
2. **`resourceCategorySchema` has no `media` or `tickets` value.** The old site
   used Media (radio, playlists) and Tickets (TicketSwap, prices). Media records
   are stored as `other` and ticket records as `practical`, which loses
   information for anyone filtering the links page.
3. **`whatsappGroupSchema` has no field for the invite page's group name.** The
   measured name often differs from the old title (for example `wa-10` is
   "TML - W2 Local Hosts, Camping, Airbnb, B&B, Hotels ⛺️ 🏡 🏨" on the invite
   page). Nothing public-facing is lost, because the title is kept verbatim, but
   the measured name is not retained anywhere in the data.
4. **`whatsappGroupSchema` has no `closed` state.** `linkStatus` can say the
   link is ok, dead or unchecked, but not "the link works and the group has
   shut". The closed W2 chat had to be dropped from the array instead of being
   published with an accurate state.
5. **No group or resource carries an attendee-facing category.** The old site
   grouped chats by Chats, Camping & Accommodation, Travel & Transport, Sales &
   Exchanges, Scam Protection, Female Only, Other and Tomorrowland Events. None
   of that survives in the schema, so the new site cannot reproduce those
   filters without either an enum or a free-text `category` field.

## Fields that had no source value

Two required fields were not in the old data at all, and neither claim can be
measured:

- **`region`** (WhatsApp groups) is taken from the group title where the title
  names a place ("South Africa", "Alpe d'Huez, France", "DreamVille, Boom,
  Belgium"), from the input's own `region` field where it had one, and is
  "Worldwide" for the Belgium-weekend and exchange chats whose titles name no
  place. "Worldwide" is a label, not a measurement.
- **`edition`** is assigned by where a group's subject belongs: "belgium" for
  the Belgian weekend, DreamVille, camping, transport and exchange chats;
  "winter" for the Alpe d'Huez chat; "brasil" for the São Paulo chat; and "all"
  for the meet-ups that belong to no single festival edition (Core Medellín,
  Terra Solis Dubai, Unity Los Angeles, ADE Amsterdam). Those four are
  Tomorrowland-adjacent events outside the three editions the schema lists, so
  "all" is the closest available value rather than a statement that they cover
  every edition.

## Duplicate URLs kept as separate records

These pairs point at the same destination but are distinct entries in the input,
and both are published because each serves a different purpose on the page:

| URL | Records |
| --- | --- |
| `https://chat.whatsapp.com/Jt8m3LkfniYC7Vipnavj2e` | `resource-whatsapp` (resource) and `wa-1` (group) |
| `https://chat.whatsapp.com/Hp8ob6MM1LI6s2pzgeJPHP` | `resource-fraud` (resource) and `wa-15` (group) |
| `https://drive.google.com/file/d/14HcfxSkxX2y-gZFSYshYH80zBvQuVr03/view?usp=drive_link` | `resource-packing` and `resource-ticket-info` |

The Drive file is the same document under two titles, so
`resource-ticket-info` says its contents are unconfirmed. This looks like a
mistake on the old site and is worth a human check.

## Update 2026-11-18: ticket-info removed

esource-ticket-info (Detailed Ticket Sales & Information) was never a link. On the old site it opened an in-page pop-up of 2025 package categories with approximate prices. It is excluded from the resources directory. The v3 replacement is a ticket and packages explorer built from the verified ledgers; none of the old 2025 prices are carried over.

