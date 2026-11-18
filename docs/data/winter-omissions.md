# Winter 2027 data omissions

Every claim in `docs/factcheck/winter.md` and `docs/factcheck/conflicts.md` that could **not** become a typed record in `src/data/winter/`, with the ledger verdict and the reason. Generated alongside the data files on 2026-11-18.

The rule applied: a record exists only when the ledger verdict is `confirmed`, `changed` (using the corrected value) or stated as resolved in `conflicts.md`, **and** the schema has a field to hold every required value. A claim that is verifiable but has no published figure is not turned into a record with a guessed figure.

## Counts

| Outcome | Count |
|---|---|
| Typed records produced | 97 |
| Verified claims recorded outside an entity file (section B) | 19 |
| Verified claims that could not be recorded at all (section A) | 26 |
| Contradicted claims whose notes value was rewritten or dropped (section C) | 8 |

The ledger records 216 claims. This file does not re-list the roughly 140 claims whose verdict already excludes them; it lists the 26 verified claims that a reader would expect to find and does not (section A), the claims that do exist but live outside an entity file (section B), and the contradicted claims whose correction had to be handled with care (section C).

## A. Verified but unrecordable — no published value for a required field

These are the material omissions. Each was checked on an official page and holds, but the schema demands a figure or field that Tomorrowland has not published.

| Claim | Ledger verdict | Field that cannot be filled | Reason |
|---|---|---|---|
| 4-Day Festival Ticket, 23–26 March 2027 | `unverifiable` (price) | `priceEur` | The official page confirms the product for 2027 but renders no price to an unauthenticated reader. Community reporting says €560; not an official figure. |
| 1-Day Festival Ticket, 20–22 March 2027 (MainStage closed) | `unverifiable` (price) | `priceEur` | Product confirmed for 2027, no price rendered. Community reporting says €130. |
| 1-Day Festival Ticket, 23–26 March 2027 (MainStage open) | `unverifiable` (price) | `priceEur` | Product confirmed for 2027, no price rendered. Community reporting says €190. |
| 7-day and 4-day package minimum prices | `outdated` (2025 figures) | `priceEur` | The 2027 package sale shows "Sold out" with no minimum published. The 2025 figures of €995 and €875 must not be carried forward. |
| Exclusive / Hospitality packages | `unverifiable` | `priceEur` | Packages exist for 2027; no price or spending-credit amount is published. |
| Discover Paris | `unverifiable` (price) | `priceEur` | The 2027 experience is confirmed (4-star Aparthotel Adagio, three nights) but no price is published. Recorded as a headline fact without an amount, not as a product. |
| Accommodation pricing, any property | not in ledger | `nightlyOrTotalEur`, `capacity` | Lodging is sold only inside a package, and no 2027 package price exists. `winterAccommodation` is empty for this reason. |
| Package accommodation categories (Wood, Bronze, Silver, Gold) | `confirmed` | no field | Recorded as a headline fact, not as accommodation records, because the category is not a bookable property and carries no price. |
| Locker prices, all sizes | `unverifiable` (price) | `priceEur` | `conflicts.md` item 4: the 2027 dimensions, locations and rental durations are official, but "none published officially" for price. `winterLockers` is empty. |
| Locker dimensions and access hours | resolved in `conflicts.md` | no field | `lockerSchema` has `size` as free text but requires a price, so the dimension data cannot be stored without inventing one. Recorded as a headline fact instead. |
| Ski and snowboard equipment hire prices | `outdated` (2025 figures) | `priceEur` | No 2027 price is published; the official page describes contents and pick-up points only. |
| Towels | `unverifiable` | `priceEur` | Sold in Manage My Booking or the Add-On Sale, no 2027 price published. |
| Ski insurance | `confirmed` (exists) | `priceEur` | Listed as a 2027 add-on category with no published price. |
| Restaurant experiences (Frozen Lotus, Amare, Signal, Brasa) | `outdated` (2025 prices) | `priceEur` | The 2027 add-on index has no restaurant category, and no 2027 price list exists. |
| Tomorrowland shuttle fares (Paris, Grenoble, Lyon, Geneva, Belgium, Netherlands) | `outdated` (2025 figures) | `priceEur` | 2027 departure points are published; no 2027 prices are. Operator fares are recorded instead. |
| Winter Pearl value, 2027 | `unverifiable` | `priceEur` | `conflicts.md` item 7: no 2027 rate is published; only the mechanism (cashless, Pearls on the bracelet) is confirmed. No pearl-bundle record can be built. |
| Sale windows: 7-day packages (3 Oct 2026), 4-day packages and festival tickets (10 Oct 2026) | inside a `contradicted-by-sources` row | `opensAt` | The dates appear only in the corrected value of a row testing the fan site's "sales run in September" pattern. The row's verdict governs the claim, not the corrected value, and the brief excludes 2027 sale dates as owned by another agent. |
| 2027 stage count | `unverifiable` | no field | Only the seven named 2027 stages are confirmed; no official total. `winterStages` holds the seven named stages and asserts no count. |
| Mountain-stage lift routes for 2027 | partly `outdated` | `description` (evidence) | Only Frozen Lotus has a confirmed 2027 route (Marmottes 1 from Bergers). Amare, Reflection of Love, Friends by Coke Studio and L'Aventure are absent from the 2027 line-up, so their routes are not recorded anywhere. |
| Free town-lift hours, 2026–27 | `unverifiable` | `detail` | The tourist office confirms free access but publishes no 2026–27 times; the only timetable found was 2024–25. |
| Visitor Experience Centre hours | `unverifiable` | `detail` | No 2027 hours published. |
| Intra-resort festival shuttle (Tue–Fri, every 10 min) | `unverifiable` | `route`, `priceEur` | Not described on any 2027 official page. |
| Taxi fares | `unverifiable` | `priceEur` | No official tariff published. Operator names are confirmed but a shuttle record needs a price and a route. |
| Altibus Geneva single fare | `contradicted-by-sources` (single) | `priceEur` | Only the return fares (€80 adult, €75 child) are published. The single-fare claim is contradicted, so no single record exists. |
| Parking: outdoor car parks are free | `confirmed` | `priceEur` | A free facility with no price and no `addOn` representation. Free is recorded inside the covered-parking FAQ answer, not as a record. |
| Name-tag rule for train luggage | `unverifiable` | — | SNCF help page returned 404; nothing checked supports it. |

## B. Verified claims recorded somewhere other than a dedicated entity

Listed so a future editor does not duplicate them.

| Claim | Where it now lives |
|---|---|
| Festival dates 20–27 March 2027 | `winterFacts` `festival-dates-2027`; FAQ `faq-festival-dates-2027` |
| MainStage closed Sat–Mon, open Tue–Fri | `winterFacts` `mainstage-open-days`; stage `mainstage-2027` |
| Mountain stages 12:00–17:00 / 12:00–17:30 | `winterFacts` `mountain-stage-opening-hours`; `faq-mountain-stage-hours` |
| Main area 19:00–00:00 / 01:30 and last admission | `winterFacts` `main-area-hours`, `main-area-last-admission`; `faq-mainstage-hours-last-entry` |
| Moosebar by Day 15:00–19:30, Sat–Fri | `winterFacts` `moosebar-day-slot`; stage `moose-bar-2027` |
| Payment terms 40% / €2,500 cap / 30 days | `winterFacts` `package-payment-terms`; `faq-payment-terms` |
| Comfort €390, must be bought at purchase | `winterFacts` `comfort-upgrade-price`; `faq-comfort-upgrade-timing` |
| Treasure Case €15 EU / €22 worldwide | Two facts; `faq-treasure-case-fee` |
| Transportation Pass €40 | Add-on `transportation-pass-2027`; fact; `faq-transportation-pass` |
| Covered parking €18/day, €95/week, six car parks | Facts `covered-parking-daily`, `covered-parking-weekly`, `covered-parking-spaces`; `faq-covered-parking` |
| Winter equipment rule | Fact `winter-equipment-rule`; `faq-winter-tyre-rule` |
| Altibus Geneva suspension | Shuttle `altibus-geneva-return`; fact `geneva-shuttle-not-operated` |
| Cancellation ladder, name-change window, Exchange Desk | Three facts; `faq-package-cancellation`, `faq-name-changes`, `faq-exchange-desk` |
| Walking between villages prohibited | Fact `walking-between-villages-prohibited`; `faq-transportation-pass` |
| Village lift last departures | Fact `village-lift-last-departures`; `faq-lift-last-departures` |
| 2027 activity prices | `winterAddOns` (8 records) + `activity-price-range-2027` |
| 2027 lesson and slope-experience prices | `winterAddOns` (6 records) + `faq-ski-lessons-2027` |
| 1-Day Ticket MainStage split | Fact `day-pass-mainstage-split` |
| 2027 Add-On Sale date | `winterSaleWindows` `add-on-sale-2027`; fact; `faq-add-on-sale-date` |

## C. Claims whose ledger verdict is `contradicted-by-sources` — recorded as the corrected value, or not at all

These are the traps. Each row names what the notes claimed, what the sources actually say, and what the data does.

| Notes claim | Wrong because | What the data does |
|---|---|---|
| "Snow chains are mandatory to carry" | Four winter tyres satisfy the rule on their own | FAQ `faq-winter-tyre-rule` and fact `winter-equipment-rule` state both routes |
| "Comfort upgrades are bought in the add-on sale" | Must be bought at ticket purchase | `faq-comfort-upgrade-timing` says so explicitly |
| "Bus packages from NL, BE, CH, FR" | Belgium only, 4-day only | Fact `package-mode-matrix` |
| "Altibus Geneva single €65" | Altibus publishes €80 adult / €75 child return, and the route did not run in 2025/26 | Shuttle `altibus-geneva-return`, marked as a suspended route |
| "Grenoble shuttles daily except Wednesday" | Ben's Bus runs any day with a scheduled flight | Grenoble shuttle notes state the operator's position, not the notes' claim |
| "Eclose stop closed during festival week" | Transaltitude still lists L'Éclose as served for 2026–27 | Not recorded. Only "some stops are withdrawn" is supportable, and it is too vague for a record |
| "No public transport at night" | Paid night service exists via the Transportation Pass | `faq-transportation-pass` |
| "Sales run in September" / "fixed sale order" | 2027 ran in October with a different sequence | No sale windows recorded beyond the Add-On Sale |

## D. Schema gaps — proposed, not changed

These are places where the schemas prevented a correct record from being written. Nothing in `src/data/schemas` was modified; these are proposals for whoever owns it.

1. **`accommodationSchema` requires a price.** Winter 2027 accommodation is package-only with no published figure, so the entity is unavoidably empty. A nullable `priceEur` with a `priceStatus: "published" | "included-in-package" | "sold-out"` field would let the four package categories be recorded honestly.
2. **`lockerSchema` requires a price.** `conflicts.md` supplies official 2027 sizes, locations, access hours and USB charging for Winter, but no price. Either make `priceEur` optional with a `priceStatus` marker, or add `dimensions`, `location` and `accessHours` fields — at present this verified detail can only live in `winterFacts`.
3. **`addOnSchema` has no `notes` or `unit` field.** A price of €74 per person per half-day cannot say "per person" or "per group" in a structured way, so qualifiers are crammed into `name`. That keeps the record valid but makes the name unreadable as a label. A `unit: "per-person" | "per-group" | "per-item"` field plus optional `notes` would fix it.
4. **No schema for a non-product fact.** Hours, percentages, rules and terms have no home in the entity list, which is why `winterFactSchema` is defined locally in `src/data/winter/facts.ts`. If Belgium and Brasil need the same shape, it belongs in `src/data/schemas` as a shared `fact.ts` — with the caveat that its category enum would then be a union across editions.
5. **`shuttleSchema` cannot express a suspended route.** It requires a price and has no status field, so the Altibus Geneva record has to say "not running" inside `notes` while still carrying a fare. A `serviceStatus` enum would let the UI suppress or badge it.
6. **`ticketPackageSchema` cannot express "product exists, price unpublished".** This is the single biggest gap for Winter: three of the four 2027 ticket products are confirmed to exist with no readable price, and the only honest representation today is no record at all.
7. **`saleWindowSchema` pins `timeZone` to `Europe/Brussels`.** Correct for both editions checked here, but worth noting as an assumption rather than a derived value.
8. **No `accessibility` or `stageRoute` entity.** The confirmed lift routes, pedestrian access rules and fixed village departures are all verified and all homeless in the current schema set.

## E. Sources that blocked the check

Recorded in the ledger and repeated here because they explain several omissions: `faq.tomorrowlandwinter.com` root and index returned HTTP 500 (articles were read individually), `shop.tomorrowland.com` returned HTTP 500, the 2027 4-day and 1-day ticket sub-pages and `/en/tickets/prices/` returned 404, `securite-routiere.gouv.fr`'s winter-equipment page returned 404 (the rule was verified on `service-public.gouv.fr` instead), SNCF Connect's luggage page returned 404, and `altibus.com`'s English destination page returned 404.
