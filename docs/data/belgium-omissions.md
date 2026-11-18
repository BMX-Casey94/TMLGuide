# Belgium data — omissions ledger

- **Built on:** 18 November 2026
- **Rule applied:** a `confirmed` verdict is published as stated. An `outdated` or `changed` row is published using the **corrected value** in its "correct value" column, because that column carries the current official 2027 figure with an official source URL. What is discarded is the *old* value the note carried. Anything marked `unverifiable`, or with no official URL, is not published at all.
- **How to read this:** row numbers refer to the ledger's own tables, so this file can be diffed against `docs/factcheck/belgium.md` section by section.

## Summary

| Data type | Records | Position |
|---|---|---|
| Sale windows | 3 | Complete for the published 2027 cycle |
| Tickets | 10 | Every 2027 ticket price the ledger publishes |
| Accommodation | 36 | 19 products, one record per sale tier |
| Add-ons | 3 | Treasure Case only; no other add-on has a 2027 price |
| FAQs | 38 | `confirmed` and corrected claims only |
| Shuttles | 0 | No 2027 fare published; schema requires one |
| Lockers | 0 | No 2027 price and no Belgium dimensions published |
| Stages | 0 | No 2027 stage list published |
| Pearl bundles | 0 | No 2027 rate published |

**The four remaining gaps**, in order of consequence:

1. **Shuttle fares.** Routes and the Thursday-in/Monday-out pattern are confirmed for 2027, but no fare is published for any route. The schema requires a price, so no shuttle record can be built.
2. **Locker prices and dimensions.** Tomorrowland confirms lockers exist and are sold in the Add-On Sale, and states that the price table will follow later.
3. **All other add-ons.** Dining, breakfast, parking, camping gear, drinks and yoga have no published 2027 price; the ledger marks every one `unverifiable`.
4. **The 2027 Pearl rate.** Not published until around June 2027, so no bundle can be priced.

---

## 1. Prices published as records

These rows were previously omitted and are now live. Listed so a reviewer can see which ledger rows each record came from.

| Ledger row | Product | 2027 value now published |
|---|---|---|
| pricing-tickets #2 | Day Pass | €144 pre-sale, €159 WorldWide |
| pricing-tickets #3 | Pleasure Day Pass | €194 / €224 |
| pricing-tickets #4 | Comfort Day Pass | €256 / €275 |
| pricing-tickets #5 | Full Madness | €335 / €410 |
| pricing-tickets #6 | Full Madness Comfort | €581 / €700 |
| pricing-tickets #7 | Magnificent Greens | €422 / €498 |
| pricing-tickets #8 | MG 1P Tent | €585 / €664 |
| pricing-tickets #9 | MG 2P Tent | €1,087 / €1,243 |
| pricing-tickets #10 | Camp2Camp 2P | €1,153 / €1,285 |
| pricing-tickets #11 | Friendship Garden 10P, Spectacular 10P | €5,707 / €6,598 (WorldWide only) |
| pricing-tickets #12 | Easy Tent 2P | €1,240 / €1,372 |
| pricing-tickets #13 | Easy Tent 4P | €2,454 / €2,718 |
| pricing-tickets #14 | Relax Room 2P | €2,231 / €2,363 |
| pricing-tickets #15 | DreamLodge 2P | €2,437 / €2,569 |
| pricing-tickets #16 | Cabana 2P | €2,648 / €2,780 |
| pricing-tickets #17 | Marivela 2P | €5,478 / €5,610 |
| pricing-tickets #18 | Kokono, Luna, Astera, Spectacular DreamLodge, Ensuite | €2,540/€2,672; €2,615/€2,747; €2,827/€2,959; €2,748/€2,880; €5,640/€5,772 |
| pricing-tickets #19 | Solara 2P, Noctis 2P | €5,576/€5,708; €2,591/€2,723 |
| pricing-tickets #20 | Treasure Case | €15 Belgium, €22 EU, €31 Worldwide |

## 2. `research/belgium/pricing-tickets.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | Regular, Pleasure and Comfort definitions | confirmed | Not a price. The definitions are stated in the ticket records' `includes` and in the `ticket-types-explained` FAQ |
| 21 | Prices include payment and service fees but exclude the Treasure Case fee | confirmed | No schema field for a pricing-terms note; stated in each ticket record's `notes` |
| 22 | Hospitality packages are for companies only, minimum 10 guests | confirmed | No hospitality records exist: the 2027 pages publish no prices |
| 23 | 2025 hospitality prices (Balcony €550 … tables €1,250–2,750) | unverifiable | 2027 hospitality pages describe the packages but publish no prices, so there is no corrected value |
| 24 | Mansion: no public price, enquiries to table@tomorrowland.com, festival access not included | changed | The corrected value is "no published price", and the accommodation schema requires a number |
| 25 | Indicative "from" prices (Day €144, FM €335, MG ≈ €422) | outdated | The corrected values are the same figures already published as full records above; a separate "indicative" record would duplicate them |
| 26 | Pearl rate: €1.82 (2025), €1.90 (2026), none for 2027 | confirmed | No 2027 rate exists, so `pearl-bundles.ts` has nothing to price. The historical rates are carried as prose in the `historic-pearl-rates` FAQ |

## 3. `research/belgium/accommodation.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | Packages include FM pass, DreamVille access, The Gathering, Marketplace and Chill Out | confirmed | No inclusions field on the accommodation schema; summarised in each record's `notes` |
| 2 | Guests can only enter their own accommodation zone | unverifiable | Only area *facilities* are officially restricted, not zone entry |
| 3 | Pricier accommodation sits closer to the festival gate | unverifiable | No official distances or ordering published |
| 4 | MG 1P Tent: 250 × 150 × 120 cm, single mattress, sleeping bag | confirmed | Dimensions are stated in the record's `notes`; there is no dedicated field |
| 5 | MG 2P Tent: same tent, double mattress, two sleeping bags | confirmed | As above |
| 6 | No power supply in Magnificent Greens | unverifiable | The official page is silent on pitch power |
| 7 | Camp2Camp 2P: pre-pitched tent, double mattress, two sleeping bags, two relax chairs | confirmed | Stated in the record's `notes` |
| 8 | Refundable deposit payable at collection | unverifiable | No deposit term found on the official page |
| 9 | Friendship Garden Regular: 10 × 10 m plot, 365 × 365 cm shelter | confirmed | Stated in the record's `notes` |
| 10 | Spectacular Friendship Garden plot size | changed | Two official pages disagree (12 × 12 m against a stated 8–13 m range), so no plot size is asserted. The price is published |
| 11 | Easy Tent 2P: dimensions, mattress, sleeping bags, night light, mirror, lock | confirmed | Stated in the record's `notes` |
| 12 | Spectacular Easy Tent 2P adds wooden flooring | unverifiable | The official inclusion list omits flooring; no 2027 price is published for this unit |
| 13 | Spectacular Easy Tent 2P: power outlet, two relax chairs, 24 × 28 × 50 cm locker | confirmed | Confirmed, but the ledger publishes **no 2027 price** for Spectacular Easy Tent, so there is no record to attach it to |
| 14 | Supreme Easy Tent 2P: 260 × 270 cm, made-up beds, patio; cannot be taken home | confirmed | As above: no 2027 price published |
| 15 | Easy Tent 4P: two 265 × 265 × 205 cm tents joined by a walkway, one lock | changed | Corrected detail stated in the record's `notes` |
| 16 | Easy Tent sleeping bags are one-size-fits-all | unverifiable | No sizing published |
| 18 | Montagoe has a separate entrance between the festival and DreamVille Entrance 2 | unverifiable | No gate position stated |
| 20 | Relax Room: 300 × 240 cm, lockable, beds and furniture | confirmed | Stated in `notes` |
| 21 | Relax Room includes two towels | unverifiable | Towels are not listed; a paid towel service exists instead |
| 22 | DreamLodge: 310 × 220 cm, in-room locker, relax chairs | confirmed | Stated in `notes`; the table is not listed officially |
| 23 | Spectacular DreamLodge: 517 × 220 cm, living room, bathrobes, slippers | confirmed | Stated in `notes` |
| 24 | Kokono: 300 × 384 cm, carpeted, locker 35 × 28 × 50 cm | confirmed | Stated in `notes` |
| 25 | Luna: 500 × 500 cm, adds two relax chairs and a private locker | changed | Corrected detail stated in `notes` |
| 26 | Cabana: 290 × 225 cm, patio with two relax chairs | confirmed | Stated in `notes` |
| 27 | Astera is 370 × 260 cm | changed | Stated in `notes` |
| 28 | Astera includes a 35 × 28 × 50 cm locker | contradicted-by-sources | The official inclusion list has no locker for Astera; the record's `notes` says so explicitly |
| 29 | Marivela: 385 × 210 cm, private bathroom, air conditioning, double bed | confirmed | Stated in `notes` |
| 30 | Ensuite: 300 × 450 cm, private bathroom, air conditioning | confirmed | Stated in `notes`; the patio is not listed officially |
| 31 | Chargeable towel replacement; checkout room inspection | unverifiable | No fees or inspection procedure published |
| 32 | Mansion: welcome drink, Thursday BBQ, breakfast 08:30–11:30 | confirmed | No Mansion record: the schema requires a price and none is published |
| 33 | Mansion: five bedrooms, 80 m² lounge, jacuzzi; no butler | changed | As above |
| 34 | Mansion: no published price; enquiries to table@tomorrowland.com | changed | Quote-only, so `nightlyOrTotalEur` cannot be satisfied |
| 35 | Mansion occupancy up to 10 people | unverifiable | No maximum stated |

## 4. `research/belgium/dreamville.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | DreamVille is open to the five named areas | confirmed | No entity type carries an area list |
| 3 | Entrance-to-entrance 20–30 min, plus 10–15 min to the gate | unverifiable | No walking times published |
| 6 | An ATM is usually available | unverifiable | The site is cashless and no page names an ATM |
| 8 | Own drinks may be brought to The Gathering | unverifiable | The Gathering page is silent |
| 9 | Frequent surprise guests at The Gathering | unverifiable | Only generic "surprise acts" wording |
| 11 | Supermarket is a Carrefour, card only, limited alcohol | unverifiable | Official page says only "mini-supermarket", unnamed |
| 15 | 2025 paid-shower prices and hours | unverifiable | No price or timetable published |
| 17 | Tent theft is common | unverifiable | No official statement on theft |
| 19 | Magnificent Greens fills from Entrance 2 towards Entrance 1 | unverifiable | No filling guidance published |
| 20 | Staff take down gazebos in strong wind | unverifiable | Page only asks guests to check with neighbours |
| 21 | Belgian rain is frequent; 2023 exceeded 35 °C | unverifiable | No official weather record |
| 22 | Very little natural shade | unverifiable | Not addressed officially |
| 23 | Water is sold capless or in cans | unverifiable | Only a remark about large bottles |
| 27 | Comfort areas have separate menus with no drinks in or out | unverifiable | Comfort is described as a bar and bites only |

## 5. `research/belgium/food-drinks.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | 1 Pearl = €1.82 (2025); €1.90 (2026); none for 2027 | confirmed | No 2027 rate; the historical rates are prose in `historic-pearl-rates` |
| 2 | Hundreds of food and drink outlets | unverifiable | No outlet count published |
| 3 | Comfort-area prices are slightly higher | unverifiable | No prices published |
| 4 | 2025 drink prices (Jupiler 2 Pearls, spirits 6.75 …) | unverifiable | No official stall price list exists |
| 5 | 2025 food prices (fries 3.5, burger 6.75 …) | unverifiable | As above |
| 6 | Rough daily budget of 15–30 Pearls | unverifiable | Budget guidance is not published |
| 7 | Gluten-free, vegan and vegetarian option lists | unverifiable | No official dietary matrix |
| 8 | Staff advise on allergens; recipes change yearly | unverifiable | Restaurants state the opposite for special diets |
| 9 | Water sold in cans or with caps removed | unverifiable | Only the cup deposit is confirmed |
| 10 | Restaurant vouchers go on sale mid-June and sell out | changed | The corrected value is the 2026 sale date, now past; no 2027 date exists |
| 11 | Empty soft-plastic bottles allowed in | unverifiable | 2026 prohibited list names plastic bottles |

## 6. `research/belgium/overview.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 2 | Two weekends each July, plus a third weekend in 2022 only | confirmed | History; the 2027 weekends are in `facts.ts` |
| 4 | Both weekends can be bought in one transaction except Global Journey | unverifiable | The cap is per account across all sales; weekend mixing is undocumented |
| 5 | 2025 sale order (NFT → GJ → First 20 → Belgian-only → …) | unverifiable | 2027 publishes three sale moments only |
| 8 | Cash and card accepted at the supermarket and a few stands | unverifiable | No exception list published |
| 9 | Two festival entrances near the Mainstage and Freedom Stage | unverifiable | No gate positions published |
| 10 | Non-DreamVille bracelets use the main entrance only | unverifiable | No gate restriction stated |
| 11 | Mainstage to Freedom Stage takes about 20 minutes | unverifiable | No stage-distance information |
| 12 | Ferris wheel is free, left of the Freedom Stage, closed in rain | unverifiable | Not mentioned on any official practical page |
| 13 | Mainstage opening show daily around 17:00 | unverifiable | No show time published |
| 14 | One World Radio studio next to the Cage Stage | unverifiable | Not described officially |
| 18 | Selfie sticks allowed up to 1 m | contradicted-by-sources | "Sticks" are prohibited; the `what-is-banned-on-site` FAQ states the rule instead |
| 20 | Touching decorations leads to bracelet confiscation | changed | The corrected rule covers tearing or breaking and removal from the festival; prose in the FAQ is sufficient |
| 21 | Comfort areas accept card payment and some have a pool | unverifiable | Only a bar, bites and a top-up station are described |
| 23 | Free sunscreen at info points | unverifiable | Only free earplugs are listed |
| 24 | Ponchos sold for about 6 Pearls | unverifiable | No poncho price published |
| 25 | Free pocket timetable and map at info stands | unverifiable | Not stated |
| 26 | Official app sends artist notifications 10 minutes before sets | unverifiable | App features undocumented |
| 27 | Taxi from Brussels Airport costs roughly €100–150 | unverifiable | No fares published |
| 28 | No public Wi-Fi at the festival or DreamVille | unverifiable | Not mentioned either way |
| 29 | Secret restaurant inside the Mainstage, about €15,000 for 12 people | unverifiable | No such hospitality product exists |
| 30 | Skipping the outbound Global Journey flight cancels the return | unverifiable | This row's own verdict is `unverifiable`. `global-journey.md` #14 gives the same rule a `confirmed` verdict, and that is the basis for the FAQ |

## 7. `research/belgium/transport-shuttles.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | Airport shuttles run from BRU, CRL and EIN | confirmed | No 2027 fare, and the shuttle schema requires a price |
| 2 | Boom station is a 20-minute walk from the festival | changed | No schema field for a walking time; stated in the `getting-to-the-site-by-train` FAQ |
| 4 | Parking tickets are single-entry | unverifiable | No entry rule published for 2027 |
| 5 | On-the-day tickets cost up to €5 more | unverifiable | No on-site pricing published |
| 7 | Airport shuttles run Thursday inbound, Monday outbound | confirmed | No 2027 fare; stated in the `airport-shuttles` FAQ |
| 8 | 2025 airport shuttle timetables | unverifiable | No timetables published |
| 9 | Brussels City Shuttle: round trip only, €38, half-hourly | unverifiable | The round trip is confirmed; the price and timetable are not |
| 10 | City shuttles run to several Belgian and Dutch cities | changed | No 2027 fare, so no record |
| 11 | City shuttles drop near the main entrance | confirmed | Confirmed, but no fare means no shuttle record can exist |
| 14 | 2025 night-train departure times | unverifiable | No departure list published |
| 15 | Weekend Ticket gives 50% off the return trip | unverifiable | The 2026 discount is 40% via event codes; no 2027 figure |
| 17 | Global Journey hotel shuttles run one morning departure | unverifiable | Only "a daily transfer is included" is stated |
| 18 | Shuttle hub is about 2.5 miles from the Mainstage | unverifiable | No distance published |
| 21 | DreamVille pick-up and drop-off at Entrance 2 off-peak | unverifiable | Only a Monday taxi zone near Entrance 2 is confirmed |
| 22 | Taxi from Brussels Airport costs roughly €100–150 | unverifiable | No fares published |
| 23 | De Lijn route numbers are diverted during the festival | unverifiable | A Mechelen connection is confirmed; no route numbers are |
| 24–28 | Free supervised bike parking, Park & Bike, Kiss & Ride rules, no car charging, bus registration | confirmed | These are free services or rules, not priced products, so the shuttle schema cannot hold them. They are stated in the `driving-and-parking` FAQ |

## 8. Add-ons

All add-ons except the Treasure Case are listed here. The `addOn` schema requires a price, and none of these has a published 2027 figure.

### 8a. `research/belgium/addon-sale-2026.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | Add-on sale runs on Paylogic with two weekend shops | confirmed | No entity type for sale mechanics |
| 2 | 2026 add-on hub splits into four categories | changed | The corrected value describes the 2026 structure; no 2027 equivalent published |
| 3 | Add-ons never include festival or DreamVille entry | confirmed | No field for an eligibility caveat |
| 4 | Orders cannot be changed after submission | unverifiable | Shop terms unreadable post-sale |
| 5 | Restaurants cannot accommodate special dietary requirements | confirmed | More suited to an FAQ than a priced record; no 2027 price anyway |
| 6 | Brasa Meat/Fish/Veggie €59, Brasa Deluxe €105 | unverifiable | No price published on the official page |
| 7 | Dining Experience €89, wine pairing from €25 | unverifiable | Price not published |
| 8 | Belgian Classics €59, Taster €35 | unverifiable | Price not published |
| 9 | Wine pairing from €25 | unverifiable | Not mentioned officially |
| 10 | Secret Forest Yoga €25, three classes daily | unverifiable | Product confirmed; price and class count not published |
| 11 | Cold Beer Pick-Up €30, Thursday 11:00–17:00 | unverifiable | The only official figures are 2024's €29 and a 11:00–16:00 window |
| 12 | Reading Session: The Legend of Consciencia €60 | unverifiable | Product confirmed; price not published |
| 13 | Camp2Camp Pick-Up Package €282.50 / €277 | unverifiable | Gear rental confirmed; prices not published |
| 14 | Camping Chair Rental €45 including €25 warranty | unverifiable | No line items or prices published |
| 15 | Farmhouse Breakfast €25 / €75 | unverifiable | Breakfast confirmed; price not published |
| 16 | Easy Tent Breakfast €29 / €87 | unverifiable | Price not published |
| 17 | Festival Parking €15 one day / €35 three days | unverifiable | Vouchers confirmed; 2027 prices not shown |
| 18 | Festival Parking not valid at DreamVille car parks | unverifiable | Separate signage confirmed; the validity rule is not |
| 19 | DreamVille Parking €40; Montagoe included | unverifiable | Montagoe inclusion confirmed; the €40 price is not published |
| 20 | The Avicii Tribute is free with a €10 refundable deposit | confirmed | One non-negative price field and no deposit field: recording €0 or €10 would both misstate it |
| 21 | The Avicii Tribute: 144 m² installation, 10 minutes | confirmed | No field for a venue or duration |
| 22 | The Rhythm of Consciencia €25 | unverifiable | Product exists; venue and price unconfirmed |
| 23 | Love Tomorrow Summit, Thursday, speakers | unverifiable | Summit confirmed as a category; programme not confirmed |
| 24 | Summit ticket prices | unverifiable | Prices sit on a separate shop that was not opened |
| 25 | Airport Shuttle BRU €28 one way | unverifiable | Shop shows no availability |
| 26 | City Shuttle Brussels €40, only origin | contradicted-by-sources | The 2026 page advertises several Belgian and Dutch cities |
| 27 | City shuttle returns drop at Brussels-North, Central and South | unverifiable | Drop-off detail not published |
| 28 | Festival locker 3-day €25; DreamVille locker from €30 | unverifiable | No figures on the official locker pages |

### 8b. `research/belgium/addon-services-2026.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | Add-On Sale opened 16 June 2026 | confirmed | A 2026 date that has passed; no 2027 date published |
| 2 | Historical sale dates 2025, 2024, 2023 | unverifiable | Past cycles, not 2027 data |
| 3 | Add-ons are sold through the official Paylogic shop | confirmed | No entity type for sale mechanics |
| 4 | Vouchers are limited and first come, first served | unverifiable | No availability policy text |
| 5 | Add-ons are bought per weekend | confirmed | No field for weekend scoping on an add-on record |
| 6 | Practical items remain on sale and are also sold on site | unverifiable | The 2026 page says buy in advance |
| 7 | Three pre-bookable dining experiences exist | confirmed | No 2027 price |
| 8 | Dining is bookable for groups of 2–10 | unverifiable | Booking sizes not published |
| 9 | Dining prices €89 / €59 / €105 / €59 | unverifiable | No 2026 price printed on an official page |
| 10 | 2026 chefs named | unverifiable | Page confirms Michelin-starred chefs without naming them |
| 11 | B.EAT and The Tasting Journey are not 2026 products | confirmed | A negative claim; nothing to record |
| 12 | No charging lockers; phone charging is a paid service | confirmed | The locker schema is price-first, and charging is not a locker |
| 13 | Camp2Camp guests can swap a battery at the lobby | confirmed | Not a locker, add-on product or stage |
| 14 | Festival parking €15 / €35 | unverifiable | Figures absent from the 2026 official pages |
| 15 | DreamVille parking is a five-day €40 voucher | unverifiable | No duration or price stated |
| 16 | Free staffed bicycle parking and Park & Bike | confirmed | Free services cannot satisfy a schema that requires a price |
| 17 | Kiss & Ride is shared by taxis and Uber/Bolt | confirmed | No record type for a free drop-off zone |
| 18 | City shuttles are round trip only | changed | No fare published, so no shuttle record |
| 19 | Farmhouse breakfast is open to all DreamVille guests | unverifiable | Eligibility unconfirmed |
| 20 | Gas bottles prohibited; cooking only at public BBQ areas | confirmed | Prose in the `bringing-food-and-drink` FAQ |
| 21 | No trolley or cart hire add-on exists | confirmed | A negative claim |
| 22 | A pop-up Carrefour supermarket sits in the Marketplace | unverifiable | Official page says only "mini-supermarket" |
| 23 | The Avicii Tribute is a 10-minute show in a 144 m² installation | changed | Same facts as 8a #21; no suitable field |
| 24 | Symphony of Unity is not among the 2026 add-ons | confirmed | A negative claim |
| 25 | 2026 dining price rises | unverifiable | No 2026 figure is published |
| 26 | Cold Beer Pick-Up now €30 | unverifiable | The only official figures are 2024's |
| 27 | Locker dimensions, width-first | unverifiable | No dimension table published for Belgium |
| 28 | Mainstage dining is branded "Tomorrowland Dining Experience" | confirmed | No 2027 priced product to attach it to |

### 8c. `research/belgium/addons.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | Public add-on sale opened 17 June 2025 | confirmed | A 2025 date |
| 2 | On-the-day parking costs up to €5 more | unverifiable | No surcharge published |
| 3 | 2025 dining prices | unverifiable | 2025 figures only |
| 4 | Festival lockers with a 2025 price table | unverifiable | No official table |
| 5 | 2025 festival parking €15 / €35 | unverifiable | 2025 figures only |
| 6 | Symphony of Unity at the Vaudeville Theatre, €25 | unverifiable | Absent from the 2026 line-up |
| 7 | 2025 breakfast prices | unverifiable | 2025 figures |
| 8 | Cold Beer Pick-Up €29 | confirmed | Confirmed only for 2024, so it cannot be published as a 2027 price |
| 9 | DreamVille lockers key-operated with a €5 key deposit | unverifiable | No key-deposit term published |
| 10 | Lockable lodgings need no locker; DreamLodge has an in-room locker | confirmed | Prose in the `lockers-and-storage` FAQ |
| 11 | DreamVille parking €40, single entry | unverifiable | No price or entry rule published |
| 12 | Montagoe guests get a parking voucher except via Global Journey | confirmed | Prose in the `montagoe-parking` FAQ |
| 13 | Party tent rental €195 including €150 deposit | unverifiable | Product page blocked; price unconfirmed |
| 14 | Secret Forest yoga €25 | unverifiable | Product confirmed; price not published |
| 15 | Reading session renamed; 2025 price €45 | changed | 2026 successor confirmed by name; price not published |
| 16 | Restaurant vouchers mid-June with an NFT pre-sale | unverifiable | No NFT pre-sale reference on the public hub |

## 9. `research/belgium/global-journey.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 2 | About 45,000 tickets sold through Global Journey in 2025 | unverifiable | No volume figure published |
| 3 | Separate orders per weekend; six-person cap | confirmed | The cap is in `facts.ts`; the rest has no field |
| 5 | Common inclusions: FM pass, newspaper, souvenir bag | confirmed | No field for package inclusions |
| 6 | Flexible check-in and check-out Wednesday to Tuesday | unverifiable | Arrival windows not stated |
| 7 | Three exclusive Global Journey events | confirmed | No entity type for travel-package events |
| 8 | Hotel tiers from hostel to theme hotel | confirmed | No hotel records: no prices published |
| 9 | Bus packages and a host at departure | unverifiable | "DreamVille only" and the host detail are not confirmed |
| 10 | 2025 bus departure cities | unverifiable | 2027 city list not published |
| 11 | Train packages arrive at Antwerp-Central or Brussels-Midi | unverifiable | Arrival stations not stated |
| 12 | Party Trains from Amsterdam and Düsseldorf | unverifiable | Only Party Flights are documented |
| 13 | Regular flights plus Party Flights | confirmed | No field for a package feature |
| 15 | Brussels hotels transfer by bus; Antwerp hotels by train | changed | No travel records exist to carry the distinction |
| 16 | Friendship Travel picks up within 200 km | confirmed | No priced package record |
| 17 | Discover Belgium is a Weekend 1 package | unverifiable | Itinerary and dates unconfirmed for 2027 |
| 18 | Discover Europe across three, four or five cities | unverifiable | Hotel grades not stated |
| 19 | Discover Europe activity prices | unverifiable | No prices published |
| 20 | Surprise Package itinerary for 2025 | confirmed | A 2025 itinerary; no 2027 itinerary published |
| 21 | Ridley cycling rides and distances | unverifiable | Ride names confirmed; distances not published |
| 22 | Ridley bike loan terms and discount | unverifiable | Loan terms and discount not stated |
| 23 | Youth Package now runs in both weekends | changed | No priced Youth Package record |
| 24 | New for 2027: Wellbeing, Love Tomorrow and Belgian Thrill packages | confirmed | No price or schema type for these packages |
| 25 | Discover Ibiza is a Weekend 1 experience package | confirmed | As above |
| 26 | DJ Academy package absent from 2027 | outdated | The product is gone; nothing to price |

## 10. `research/belgium/travel-partners.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | The authoritative partner list is on belgium.tomorrowland.com | confirmed | The list is dynamic and country-specific, and no partner schema is in scope |
| 2 | Partner allocations open after the main sales | unverifiable | No published sequencing |
| 4 | Historical partner allocation dates around early February 2019 | unverifiable | No historical dates published |

## 11. `research/general/pearls.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | 2026: 1 Pearl = €1.90; €20 = 10.5 Pearls | confirmed | No 2027 rate, and 10.5 Pearls cannot be stored as a whole number. Carried in `historic-pearl-rates` |
| 2 | 2025: 1 Pearl = €1.82; €20 = 11 Pearls | confirmed | Carried in `historic-pearl-rates`; not a 2027 price |
| 3 | The rate is fixed for the whole festival period | unverifiable | No statement that it is locked |
| 5 | Exceptions for the supermarket and special stands | unverifiable | No exception list published |
| 7 | Minimum top-up €20, maximum €1,000, cap €5,000 | unverifiable | The increment could not be verified, so the rule is incomplete |
| 8 | Bracelet activation code lengths | unverifiable | Code lengths not stated officially |
| 9 | Bonus tiers, €100 → 2 Pearls … €1,000 → 25 | confirmed | 2026 tiers; no 2027 equivalent, and the schema has no bonus field |
| 10 | 2026 bonus deadlines | confirmed | 2026 dates; no 2027 dates |
| 11 | Bonus Pearls are spent after regular Pearls | confirmed | No field for spending order |
| 12 | Bonus Pearls are non-refundable | confirmed | Prose in `pearl-refunds-and-fees` |
| 13 | Bonus Pearls cannot cover the refund fee | unverifiable | Ordering for fees not stated |
| 14 | Automatic refund online, manual form otherwise | confirmed | Prose in `pearl-refunds-and-fees`; no refund-record entity |
| 15 | Flat refund fee of 2 Pearls | confirmed | No field; stated in the FAQ |
| 16 | Pearls valid per weekend and non-transferable | confirmed | Stated in the FAQ |
| 17 | Belgian 2025 stall price table | unverifiable | No official stall price list |
| 18 | One Pearl cup deposit | confirmed | Stated in the `reusable-cup-deposit` FAQ |

## 12. `research/general/faq.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 2 | Most Visa and Mastercard cards work with international payments enabled | confirmed | No field for an accepted-card note; the top-up FAQ covers it |
| 4 | Personalisation is mandatory; missing the deadline risks cancellation | unverifiable | Personalisation is mandatory, but the cancellation consequence is not stated |
| 5 | Ticket names cannot be changed after personalisation | unverifiable | This row's verdict is `unverifiable`. The name-match rule is recorded from the dedicated article |
| 9 | A lost bracelet can be invalidated and its Pearls transferred | unverifiable | No loss procedure described |
| 12 | Bracelets ship in waves; a tracking error is normal | unverifiable | Only a shipping address is stated |
| 13 | Replacement bracelets come from a will-call desk | unverifiable | No will-call desk described |
| 14 | Global Journey travellers use a separate shuttle bracelet | unverifiable | Not described on the Global Journey page |
| 15 | Global Journey shuttle hub is 2.5 km from the main entrance | unverifiable | No distance published |
| 16 | Cash is useful only at a few stands | unverifiable | The site is cashless for food and drink |
| 17 | Check the Pearl amount charged at bars | unverifiable | No official statement on mischarges |
| 18 | An instalment or payment plan exists | unverifiable | Payment is taken at checkout |
| 20 | No public schedule for line-up announcements | confirmed | Expressed as a positive fact in `when-the-line-up-is-announced` |

## 13. `research/general/sets.md`

Out of scope for this build. No set, video or artist entity exists among the files this task owns, and none of the nine schemas accepts one. Every `confirmed` row (the verified YouTube video IDs, the 2011 aftermovie, and the Avicii tribute facts about his 2011 debut and 2012–2015 returns) would need a new entity type before it could be recorded. The `unverifiable` rows — view counts, the "14-year gap", 2023/2024 set counts, upload tagging conventions and the two 403 livestream IDs — could not be recorded in any case.

## 14. `research/belgium/dates.md`

| # | Claim | Verdict | Why no record |
|---|---|---|---|
| 1–9 | Festival dates and themes for 2017–2025 | mostly confirmed | Historical editions; the data files carry 2027 only |
| 10 | 2025 sales timeline | unverifiable | The 2025 sequence is not archived on the official pages |
| 11 | Theme and date reveal lands mid-to-late November | unverifiable | No 2027 reveal date is published |
| 12 | 2026 add-on sale: 16 June 2026 | confirmed | A 2026 date; no 2027 add-on sale date exists |

## 15. `docs/factcheck/conflicts.md`

| Item | Claim | Verdict | Why no record |
|---|---|---|---|
| 1 | DreamVille opens Thursday 15 and Thursday 22 July 2027 | inferred | The Thursday opening is inferred from the standing 11:00 rule rather than a 2027-specific line. `facts.ts` records the rule, not the inferred dates |
| 1 | Tomorrowland recommends creating an account two hours early | resolved | No single ledger URL carries it as a quoted sentence; the three sale windows are recorded without it |
| 1 | Exchange Desk closes at 12:00 or 23:59 CEST | unresolved | The two official pages disagree, so `facts.ts` records the date only |
| 1b | DreamVille capacity | unresolved | No figure is published; deliberately excluded from `headlineStats` |
| 1b | "Over 200 countries" | contradicted | The statistic block's 191 nationalities is recorded instead |
| 4 | Locker existence, channel and Winter dimensions | confirmed for mechanics, unresolved on price | Belgium has no price and no dimensions; `lockers.ts` is empty |
| 5 | Montagoe breakfast exists and is Montagoe-only | confirmed | No published price, and `addOns` requires one |
| 6 | Party tent is a 3 × 3 m gazebo permitted only in Magnificent Greens | unverifiable | The page returned 404 five times |
| 7 | Winter Pearl prices | unresolved | Winter edition, out of scope |
| 8 | Brasil meia-entrada rule | resolved | Brasil edition, out of scope |
| 9 | 2027 Belgium Pearl value | unresolved | Not published until around June 2027 |

## 16. Schema gaps hit during the build

Proposed changes only — no shared schema was edited.

1. **`verifiedBase` has no edition-year field.** Every price record now carries the year in its id and name, which works but is a workaround: a query cannot filter on "give me 2027 prices" without parsing strings.
2. **One price field per record.** A product with a pre-sale and a worldwide price needs two records. That doubles the record count and makes "the price of Full Madness" an ambiguous lookup. A `prices: { presaleEur, worldwideEur }` shape would model reality directly.
3. **`addOnSchema` cannot express a deposit.** The Avicii Tribute is free against a refundable €10 deposit, so neither €0 nor €10 is honest. Optional `depositEur` would fix it.
4. **`addOnSchema` has no eligibility field.** Breakfasts, parking and gear rentals are restricted to particular accommodation areas.
5. **`pearlBundleSchema` requires whole `pearls`.** The published €1.90 rate gives €20 = 10.5 Pearls, which cannot be stored.
6. **`lockerSchema`, `shuttleSchema` and `accommodationSchema` all require a price.** That rules out quote-only products (the Mansion) and price-pending ones (lockers, all shuttle routes).
7. **`ticketTierSchema` has no "pleasure" value.** Pleasure sits between regular and comfort, so it is stored as `premium` with an explanatory note.
8. **`stageSchema` cannot be populated for 2027.** It needs a name, kind and description; the only 2027 stage information is the count.
