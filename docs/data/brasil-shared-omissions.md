# Brasil and shared data — omissions

**Written:** 18 November 2026
**Scope:** every claim read from `docs/factcheck/brasil-general.md`, `docs/factcheck/conflicts.md`, `research/brasil/*.md` and `research/general/{editions-dates,nft,radio,pearls,faq,sets}.md` that is **not** published as a record in `src/data/brasil/` or `src/data/shared/`.

## Rule applied

A claim became a record only if its ledger verdict was `confirmed`, or `changed` (using the corrected value), or if `conflicts.md` records it as resolved. Everything marked `unverifiable`, `outdated` or `contradicted-by-sources` was dropped. Nothing was estimated, converted or filled in.

## Decisions that shape the data

1. **All Brasil money is in reais, never euros.** The shared schemas store `priceEur` only. No official Brasil page publishes a euro equivalent, so `src/data/brasil/facts.ts` defines local schemas holding a whole number of reais under the literal `"BRL"`. No reais figure was converted, and no record was dropped merely because it could not be expressed in euros.
2. **Brasil sale times are in São Paulo time, not Brussels time.** The shared `saleWindowSchema` pins `timeZone` to `"Europe/Brussels"`, which would mislabel a 10:00 BRT sale. Brasil sale moments therefore use a local schema with `timeZone: "America/Sao_Paulo"`.
3. **Two banned strings are absent from every record.** "Astera" and "Romania" appear nowhere in the data, and a test enforces it. Astera was a real 2025-era product that no longer exists for 2027; Romania was a real carriage that has ended. Publishing either would state a superseded fact as current.

---

## `docs/factcheck/brasil-general.md` — `dates-tickets.md`

| # | Claim | Verdict | Why it is not a record |
|---|---|---|---|
| 14 | Pre-registration "does NOT guarantee a ticket" | unverifiable | No official page says this of pre-registration; the official wording covers the separate Waiting List. |
| 30 | "2027 day-pass prices not yet confirmed" | outdated | Superseded: the 2027 day passes are priced and sold out, and are published as four ticket records. |
| 31 | "2025 estimates ~R$1,250 full / R$625 half" | outdated | Superseded by the 2027 figures of R$1,270 and R$635. |
| 34 | Hiatus caused by SFX Entertainment bankruptcy, then Covid | unverifiable | Official history says only "after a few years of pause"; no cause is stated. |
| 35 | Returned 2023, "sold out in hours" | changed | The 2023 return is published as part of the venue history; "sold out in hours" is not stated officially and is excluded. |
| 10 (part) | Bybit Early Bird "requires an active Bybit account and Bybit Card" | unverifiable | The 2027 Brasil pages do not restate the requirement, so the sale record omits it. |
| 15 (part) | Bybit Pre-Sale sub-limit of 2 per Account | contradicted by another official article | Two help-centre articles disagree (2 versus no sub-limit). The six-per-CPF cap is published; the sub-limit is not. |
| 22–27 (context) | "Up to 20% off, capped at R$400" as the Full Madness early-bird discount | changed | The 20% headline does not describe the Full Madness discount, which is a flat R$200. The sale record keeps the headline only to say it does not apply. |

## `docs/factcheck/brasil-general.md` — `venue-dreamville.md`

| # | Claim | Verdict | Why it is not a record |
|---|---|---|---|
| 2 | Parque Maeda is "roughly 60 miles (100 km) from São Paulo city" | unverifiable | No official page states a distance; routing tools give 91–93 km. |
| 12 (part) | Mística tiers "include Solaris, Astera, Grande" | changed | The corrected 2027 line-up is published; Astera does not exist for 2027 and is omitted by name. |
| 23 | Astera 2P at R$19,980 / R$24,730 / R$31,380 | contradicted-by-sources | No Astera package is offered for 2027. The closest 2P glamping tier is Luna. |
| 29 | 2024 add-ons opened mid-August | unverifiable | No official page states a 2024 add-on sale date. |
| Notes | Vida Nova 2P (R$7,009 / R$11,759 / R$20,119) and Spectacular Easy Tent 2P (R$8,359 / R$13,109 / R$21,469) | noted as verified against product pages, but **no row, verdict or URL** | The ledger's notes assert these are official 2027 products but supply no citable URL, so they cannot satisfy the source rule. Omitted pending a URL. |
| Notes | Luna 2P and Luna 2P Supreme at R$20,049 / R$24,599 / R$32,959 | stated as corrected values, but the mapping of price to variant is not given | Published as one fact naming all three prices as printed, rather than as three package records, because the ledger gives three prices against two product names. |
| Notes | 2027 stage count: homepage says 5, press boilerplate says 6 | unresolved, no verdict | Neither figure is published. |
| Row 4 (part) | 2025 drone show attributed to the festival as a whole | changed | Published with the corrected attribution to Alok's 12 October 2025 set. |

## `docs/factcheck/brasil-general.md` — `transport.md`

| # | Claim | Verdict | Why it is not a record |
|---|---|---|---|
| 3 | Official reserved parking sold as an add-on | unverifiable | The 2027 add-on shop lists only the two shuttle products. The add-on fact records what was on sale, not a parking product. |
| 4 (part) | Shuttle tickets sold per timeslot | unverifiable | The shop is JavaScript-only, so no timeslot model could be inspected. The ByInti platform itself is published. |
| 5 | 2025 fares of R$199 for São Paulo, Barueri, Campinas, São Bernardo | outdated | Replaced by the 2027 floor of R$220. |
| 6 | Curitiba shuttle at R$509 | outdated | Curitiba is not a 2027 departure city. Omitted by name, and a test asserts its absence. |
| 7 | 2024 fare was R$180 | unverifiable | No official 2024 fare page survives. |
| 9 | Outbound slots 10:00–20:00, returns 21:00/22:00–01:30 | unverifiable | The official page says exact times appear only in the ticket shop. |
| 11 | 2024 used Holiday Inn Parque Anhembi and Hilton Morumbi | unverifiable | The current list is published; no page states what 2024 used. |
| 12 | DreamVille shuttle 2025 fare R$219 return (2024: R$200) | outdated | Replaced by the 2027 round-trip description, with the fare left to the shop. |
| 14 | DreamVille shuttle returns 05:00–12:30 the day after | unverifiable | No official page states return windows. |
| 19 | Global Journey simulator "publishes nearer the sale" | outdated | The simulator launched 3 September 2026 and is live. |
| 17 (part) | American Express and Pix accepted | changed | Amex appears on no official page; Pix appears on the ticket page but not in the payment article. Only Mastercard, Visa, Elo, Google Pay and box-office debit cards are published, with Pix flagged as unconfirmed. |
| 20 | Times chosen at purchase, 100% digital | unverifiable | The checkout flow could not be inspected. |

## `docs/factcheck/brasil-general.md` — `editions-dates.md`

| # | Claim | Verdict | Why it is not a record |
|---|---|---|---|
| 6 | Winter 2026 had ~22,000 attendees and 100+ artists | confirmed | An attendance statistic for a past edition, outside the dates overview's scope. Recorded here rather than published. |
| 7 | Winter 2026 had a new Mainstage and the debut of the Orbyz stage | confirmed | Belongs to the Winter guide's own data, not the dates overview. |
| 8 | Winter runs annually in March; first edition March 2019 | confirmed | An annual pattern rather than one edition's dates; belongs in the Winter guide. |
| 9, 21 | The Winter bracelet is entry, payment method and ski-lift pass, worn on the left wrist | confirmed | Winter product detail, outside the shared date set. |
| 10 (part) | Brasil theme "Consciência" | confirmed | Published in Brasil data, not duplicated in the shared overview. |
| 14 | CORE began as a Tomorrowland stage and is now a standalone tour | confirmed | CORE is not one of the three editions TMLGUIDE covers. |
| 15 | CORE Medellín, 20–21 February 2026 | confirmed | Same reason: a separate CORE tour, not a TMLGUIDE edition. |
| 16 | CORE Los Angeles returns 2–3 October 2027 | confirmed | Same reason. |
| 17 | CORE Melbourne, 28 November 2026, sold out | confirmed | Same reason. |
| 19 | Thailand "may not have full public info yet" | outdated | Superseded by the confirmed sold-out Thailand record. |
| 22 | Quick-reference table listed Belgium 2026 as upcoming | outdated | Superseded by the Belgium 2026 record marked `past`. |

## `docs/factcheck/brasil-general.md` — `nft.md`

The whole NFT answer set was cut back to what an official page states today. Six of the ten `unverifiable` rows are the perks readers care most about, and none of them can be published.

| # | Claim | Verdict | Why it is not a record |
|---|---|---|---|
| 4 | "Golden Auric" is an official NFT outside the Medallion set | unverifiable | The name appears on no official page reached. |
| 6 | **Medallion holders are guaranteed 2 Belgium tickets a year** | unverifiable | The official FAQ still states the 2024 terms of a maximum of four tickets. The two-ticket figure appears only on fan guides. **This is the single most consequential omission in the set.** |
| 7 | Maximum 2 tickets per pre-sale regardless of Medallion count | unverifiable | No official page states a per-sale cap for 2026 or 2027. |
| 8 | The account holder must be personalised on one purchased ticket | unverifiable | Only 2024 sale wording exists. |
| 9 | Exclusive NFT ticket sales for Winter 2023–2025 and Brasil | unverifiable | No official page lists past NFT sale moments by edition. |
| 10 | Friendship Deck access, Secret Stage access, tours, raffles | unverifiable | The official site lists only generic bullets about giveaways and previews. |
| 12 | Matrica is the **only** authorised verification platform | unverifiable | The word "only" appears on no official page, so Matrica is described as the named partner. |
| 14 | A Tomorrowland account must be nominated afresh for every pre-sale | unverifiable | No official page describes nomination mechanics. |
| 15 | All announcements happen in Discord, with no e-mail | unverifiable | Discord is the named support channel; the absence of e-mail is not stated. |
| 20 | Matrica is at `matrica.io` | unverifiable | No official page publishes a Matrica URL. No domain is given in the data. |
| 3 (part) | Trading on "Magic Eden, Tensor" | changed | Magic Eden is published as the launch marketplace; Tensor appears on no official page and is omitted. |

## `docs/factcheck/brasil-general.md` — `radio.md`

| # | Claim | Verdict | Why it is not a record |
|---|---|---|---|
| 17 | Romania: FM 92.1 | contradicted-by-sources | Romania is absent from the official 2026 distribution list, and the licence reverted to another broadcaster on 1 January 2026. Omitted entirely, and a test asserts neither "Romania" nor "92.1" appears. |
| 14 | Switzerland: DAB+ via my105 | changed | Switzerland is online only in the 2026 list. Published as an online-only country record. |
| 18 (part) | Spain: Mallorca and Ibiza | changed | Only Ibiza is claimed officially (DAB+ and 100.5 FM). Mallorca is omitted. |
| 6 (part) | Festival weekends carry The Gathering | changed | The 2026 official statement names live hours from Winter, Belgium, Brasil and Thailand and does not name The Gathering, so it is not claimed. |

## `docs/factcheck/conflicts.md`

| Item | Claim | Status | Why it is not a record |
|---|---|---|---|
| 1 | Belgium 2027 sale dates, ticket caps, Exchange Desk dates, name-change fee, festival hours | resolved | Belgium guide data, owned by another agent. The two 2027 weekends are used in the shared dates overview; the sale mechanics are out of scope for these files. |
| 1 (conflict) | Exchange Desk closing time: 12:00 or 23:59 CEST | official site contradicts itself | The date is published; the time is not asserted, because two official pages give different ones. The FAQ states that the two pages disagree rather than picking one. |
| 1b | Belgium headline statistics: 16 stages, 400,000 people, 191 nationalities | confirmed / partly | Belgium guide data, out of scope for these files. The "over 200 countries" line contradicts the statistic block and is not published anywhere. |
| 1 (part) | DreamVille opens Thursday 15 and Thursday 22 July 2027, closing Monday 12:00 | **inferred, not stated** | `conflicts.md` flags this as derived from the standing "Thursday 11:00 to Monday 12:00" rule rather than from any 2027-specific line, so no Thursday date is published in the dates overview. |
| 1b | DreamVille capacity | not published | No figure exists, so none is published. |
| 4 | Locker prices and dimensions | unresolved | Owned elsewhere, and no official 2027 price exists. |
| 5 | Montagoe breakfast price | unresolved | Owned elsewhere; existence only. |
| 6 | Party tent rental price | unresolved | The page is blocked, so even the product description is below confirmed standard. |
| 7 | Winter 2027 Pearl rate, bundle tiers, minimum top-up | unresolved | No 2027 Pearl value is published for the Winter edition. |
| 8 (part) | Federal Law 12,933/2013 low-income band is 15–29, where the operator says 18–29 | both recorded | Published inside the half-price categories fact as a stated discrepancy, without adjudicating it. |
| 8 (part) | Art. 1 §1: meia-entrada is not cumulative with other promotions, yet a Bybit half-price product exists | not adjudicated | The Bybit half-price prices are published as priced; whether that combination is cumulative is left alone as a question for the operator. |
| 8 (part) | Day-pass half-price for 2027 | published where priced | The R$635 day-pass half-price is on the 2027 price list and is published; the old R$625 figure is not. |
| 9 | Belgium Pearl value of €1.90 for 2026, €1.82 for 2025 | unconfirmed this session | The rate article sits behind a sign-in wall. No Pearl rate is published in any record, and the FAQ says the rate is announced when top-ups open. |
| 9 | Pearls are the official currency, bracelet-only payment, refunds subject to a fee, bonus Pearls and pre-loaded Pearls non-refundable, automatic refund of online top-ups, manual refunds up to six weeks | confirmed | Published in the Pearls FAQ. The 2-Pearl refund fee figure is **not** stated, because it comes from a fan guide. |
| 9 | Brasil has a Pearl-equivalent currency, or has none | not established | Nothing in the Brasil pages names one, so no claim is made either way. |

## Research files with no fact-check pass

These were read but have no ledger verdicts, so nothing from them could be published as fact.

| File | Why nothing is published |
|---|---|
| `research/general/pearls.md` | Its rates, bonus tiers, top-up caps, refund fee and food prices have no ledger verdict. Only the mechanics that `conflicts.md` item 9 independently confirms are published. Food and drink prices are excluded entirely. |
| `research/general/faq.md` | Only four of its claims are settled: re-entry (conflicts item 2), the TicketSwap question (conflicts item 3), the Exchange Desk date and the €10 fee (conflicts item 1), and the €350 Global Journey name-change fee (also conflicts item 1). Those are published from the official pages that resolve them. Everything else — four passes per order as a per-order rule, personalisation deadlines, the waiting list, bracelet shipping waves and the 2.5 km Global Journey shuttle hub — has no verdict and is omitted. |
| `research/general/sets.md` | No fact-check pass covers official DJ set uploads. Row after row is marked "ID to verify", and the notes warn that unverified IDs must not be published. No set data is recorded. |
| `research/brasil/dates-tickets.md`, `venue-dreamville.md`, `transport.md` | Used only through the ledger rows tabulated above. The files' own prose is not a source. |

## Counts

- Ledger rows read: 150 with a verdict, plus the unverdicted Brasil half-price arithmetic row.
- Verdicts: 82 confirmed, 37 changed, 9 outdated, 20 unverifiable, 2 contradicted-by-sources.
- Published as records: 29 Brasil facts, 16 Brasil tickets, 13 Brasil DreamVille packages, 2 Brasil shuttles, 5 Brasil sale windows, 1 radio station, 3 radio milestones, 6 radio channels, 10 radio countries, 7 edition records, 15 general FAQs — 107 records in total.
- Omitted claims and unsourced research files tabulated on this page: 73.
