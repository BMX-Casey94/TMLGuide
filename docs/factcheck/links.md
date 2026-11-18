# Link health report

Generated 2026-11-18T18:15:22.604Z from `docs/factcheck/links-input.json`.

Every verdict below comes from a real response. Each link was requested with HEAD and, where that method was refused or told us nothing, with GET; WhatsApp invites were always fetched with GET so the invite page could be read. No link is marked ok without a response, and nothing here was joined, signed into or paid for.

## Totals

- Checked: **53** links (21 resource, 26 whatsapp, 6 partner)

| Classification | Count |
| --- | ---: |
| ok | 37 |
| redirected | 1 |
| insecure | 13 |
| dead | 1 |
| blocked | 1 |
| unreachable | 0 |
| rejected | 0 |

## Totals by kind

| Kind | ok | redirected | insecure | dead | blocked | unreachable | rejected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| partner | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| resource | 12 | 1 | 7 | 0 | 1 | 0 | 0 |
| whatsapp | 19 | 0 | 6 | 1 | 0 | 0 | 0 |

## Every link that is not ok (16)

| id | title | url | status | note |
| --- | --- | --- | --- | --- |
| resource-apps | Official Apps (Official Tomorrowland Apps) | http://tomorrowland.lnk.to/apps | insecure | plain http:// (follows a redirect) [HEAD 301, HEAD 204, GET 200] |
| resource-discord | Tomorrowland Discord (Official Server - 25K+ Members) | http://discord.gg/tomorrowland | insecure | plain http:// (follows 2 redirects) [HEAD 301, HEAD 301, HEAD 200] |
| resource-lineup | Line-Up (Official Festival Artists) | http://belgium.tomorrowland.com/en/line-up/ | insecure | plain http:// (follows a redirect) [HEAD 301, HEAD 200] |
| resource-maps | Tomorrowland Maps (Floorplan/Layout) | http://festivalviewer.com/tomorrowland/map/2024 | insecure | plain http:// (follows a redirect) [HEAD 301, HEAD 200] |
| resource-prices | Ticket Prices (Packages & Categories) | http://festivalviewer.com/tomorrowland/tickets | insecure | plain http:// (follows a redirect) [HEAD 301, HEAD 200] |
| resource-radio | One World Radio (Live Stream) | http://www.tomorrowland.com/home/one-world-radio/ | insecure | chain longer than 2 redirects; stopped after 3 hops at https://www.tomorrowland.com/one-world-radio/ without resolving the final page (the link is plain http://); the https:// twin does resolve (see the http table), so switching to it also saves a hop [HEAD 301, HEAD 302, HEAD 302] |
| resource-travel-partner | Travel Partner (Travel Packages) | http://drive.google.com/file/d/1zdWofqpQVfPUmtcjQxkAZjWp3nLPO_dm/view | insecure | plain http:// (follows a redirect) [HEAD 301, HEAD 200] |
| wa-10 | Accommodation (Camping, Airbnb, B&B, Hotels) ⛺️🏝️🏨 | http://chat.whatsapp.com/HG7FRoZMBJYLumQu8fdZ5B | insecure | plain http:// (403) but the https twin answers 200; invite live at https://chat.whatsapp.com/HG7FRoZMBJYLumQu8fdZ5B, group name shown: "TML - W2 Local Hosts, Camping, Airbnb, B&B, Hotels ⛺️ 🏡 🏨" [GET 403] |
| wa-11 | Transport & Travel (Local Taxis, Buses) 🚖🚌 | http://chat.whatsapp.com/KWJ03eNmOek6q1SnakOWhZ | insecure | plain http:// (403) but the https twin answers 200; invite live at https://chat.whatsapp.com/KWJ03eNmOek6q1SnakOWhZ, group name shown: "TML - W2 Local Transport - Taxi & Bus 🚌 🚖" [GET 403] |
| wa-12 | NFT (Information & Exchange) 🥉 | http://chat.whatsapp.com/HoOuMFpuyXvHfkX46vk5VY | insecure | plain http:// (403) but the https twin answers 200; invite live at https://chat.whatsapp.com/HoOuMFpuyXvHfkX46vk5VY, group name shown: "TML - NFT Info & FAQ🥉" [GET 403] |
| wa-20 | Brazil (São Paulo) 🇧🇷 | http://chat.whatsapp.com/K7sVCLTQBDrLrbIMwmSmlm | insecure | plain http:// (403) but the https twin answers 200; invite live at https://chat.whatsapp.com/K7sVCLTQBDrLrbIMwmSmlm, group name shown: "TML - Brazil, São Paulo 🇧🇷" [GET 403] |
| wa-21 | Winter (Alp d'Huez, FR) 🇫🇷 | http://chat.whatsapp.com/HZ3QTcMBXe82GRgLuQswcq | insecure | plain http:// (403) but the https twin answers 200; invite live at https://chat.whatsapp.com/HZ3QTcMBXe82GRgLuQswcq, group name shown: "TML - Winter ❄️ Alpe d’Huez 🇫🇷" [GET 403] |
| wa-9 | DreamVille (Easy Tent) - W2 Group Camp ⛺️ | http://chat.whatsapp.com/JAYGWTE2Nrx3SIartOY3i7 | insecure | plain http:// (403) but the https twin answers 200; invite live at https://chat.whatsapp.com/JAYGWTE2Nrx3SIartOY3i7, group name shown: "TML - W2 Montagoe - Camping Chat ⛺️💰" [GET 403] |
| wa-24 | 👠✨ Festival Outfits 💫👗 | https://chat.whatsapp.com/K4PsxsSsqVPBkmJM3FoVfO | dead | invite link invalid or revoked — generic invite page with no group name (title: "WhatsApp Group Invite") [GET 200] |
| resource-faqs | FAQs | https://faq.tomorrowland.com/ | blocked | 403 — access refused to automated clients [HEAD 302, HEAD 301, HEAD 403, GET 403] |
| resource-official | Tomorrowland (Official Website) | https://www.tomorrowland.com/home/ | redirected | follows 2 redirects [HEAD 302, HEAD 302, HEAD 200] |

## Redirected links

| id | title | from | to | hops |
| --- | --- | --- | --- | ---: |
| resource-travel-partner | Travel Partner (Travel Packages) | http://drive.google.com/file/d/1zdWofqpQVfPUmtcjQxkAZjWp3nLPO_dm/view | http://drive.google.com/file/d/1zdWofqpQVfPUmtcjQxkAZjWp3nLPO_dm/view → https://drive.google.com/file/d/1zdWofqpQVfPUmtcjQxkAZjWp3nLPO_dm/view (301) | 1 |
| resource-discord | Tomorrowland Discord (Official Server - 25K+ Members) | http://discord.gg/tomorrowland | http://discord.gg/tomorrowland → https://discord.gg/tomorrowland (301)<br>https://discord.gg/tomorrowland → https://discord.com/invite/tomorrowland (301) | 2 |
| resource-lineup | Line-Up (Official Festival Artists) | http://belgium.tomorrowland.com/en/line-up/ | http://belgium.tomorrowland.com/en/line-up/ → https://belgium.tomorrowland.com/en/line-up/ (301) | 1 |
| resource-prices | Ticket Prices (Packages & Categories) | http://festivalviewer.com/tomorrowland/tickets | http://festivalviewer.com/tomorrowland/tickets → https://festivalviewer.com/tomorrowland/tickets (301) | 1 |
| resource-maps | Tomorrowland Maps (Floorplan/Layout) | http://festivalviewer.com/tomorrowland/map/2024 | http://festivalviewer.com/tomorrowland/map/2024 → https://festivalviewer.com/tomorrowland/map/2024 (301) | 1 |
| resource-apps | Official Apps (Official Tomorrowland Apps) | http://tomorrowland.lnk.to/apps | http://tomorrowland.lnk.to/apps → https://tomorrowland.lnk.to/apps (301) | 1 |
| resource-radio | One World Radio (Live Stream) | http://www.tomorrowland.com/home/one-world-radio/ | http://www.tomorrowland.com/home/one-world-radio/ → https://www.tomorrowland.com/home/one-world-radio/ (301)<br>https://www.tomorrowland.com/home/one-world-radio/ → https://tomorrowland.com/one-world-radio/ (302)<br>https://tomorrowland.com/one-world-radio/ → https://www.tomorrowland.com/one-world-radio/ (302) | 3 |
| resource-official | Tomorrowland (Official Website) | https://www.tomorrowland.com/home/ | https://www.tomorrowland.com/home/ → https://tomorrowland.com/ (302)<br>https://tomorrowland.com/ → https://www.tomorrowland.com/ (302) | 2 |
| resource-faqs | FAQs | https://faq.tomorrowland.com/ | https://faq.tomorrowland.com/ → https://faq.tomorrowland.com/hc (302)<br>https://faq.tomorrowland.com/hc → https://faq.tomorrowland.com/hc/en-us (301) | 2 |

## http:// URLs and their https:// alternatives (13)

| id | title | http url | https alternative | https result |
| --- | --- | --- | --- | --- |
| resource-travel-partner | Travel Partner (Travel Packages) | http://drive.google.com/file/d/1zdWofqpQVfPUmtcjQxkAZjWp3nLPO_dm/view | https://drive.google.com/file/d/1zdWofqpQVfPUmtcjQxkAZjWp3nLPO_dm/view | works (ok, 200) |
| resource-discord | Tomorrowland Discord (Official Server - 25K+ Members) | http://discord.gg/tomorrowland | https://discord.gg/tomorrowland | works (redirected, 200) |
| resource-lineup | Line-Up (Official Festival Artists) | http://belgium.tomorrowland.com/en/line-up/ | https://belgium.tomorrowland.com/en/line-up/ | works (ok, 200) |
| resource-prices | Ticket Prices (Packages & Categories) | http://festivalviewer.com/tomorrowland/tickets | https://festivalviewer.com/tomorrowland/tickets | works (ok, 200) |
| resource-maps | Tomorrowland Maps (Floorplan/Layout) | http://festivalviewer.com/tomorrowland/map/2024 | https://festivalviewer.com/tomorrowland/map/2024 | works (ok, 200) |
| resource-apps | Official Apps (Official Tomorrowland Apps) | http://tomorrowland.lnk.to/apps | https://tomorrowland.lnk.to/apps | works (ok, 200) |
| resource-radio | One World Radio (Live Stream) | http://www.tomorrowland.com/home/one-world-radio/ | https://www.tomorrowland.com/home/one-world-radio/ | works (redirected, 200) |
| wa-9 | DreamVille (Easy Tent) - W2 Group Camp ⛺️ | http://chat.whatsapp.com/JAYGWTE2Nrx3SIartOY3i7 | https://chat.whatsapp.com/JAYGWTE2Nrx3SIartOY3i7 | works (ok, 200) |
| wa-10 | Accommodation (Camping, Airbnb, B&B, Hotels) ⛺️🏝️🏨 | http://chat.whatsapp.com/HG7FRoZMBJYLumQu8fdZ5B | https://chat.whatsapp.com/HG7FRoZMBJYLumQu8fdZ5B | works (ok, 200) |
| wa-11 | Transport & Travel (Local Taxis, Buses) 🚖🚌 | http://chat.whatsapp.com/KWJ03eNmOek6q1SnakOWhZ | https://chat.whatsapp.com/KWJ03eNmOek6q1SnakOWhZ | works (ok, 200) |
| wa-12 | NFT (Information & Exchange) 🥉 | http://chat.whatsapp.com/HoOuMFpuyXvHfkX46vk5VY | https://chat.whatsapp.com/HoOuMFpuyXvHfkX46vk5VY | works (ok, 200) |
| wa-20 | Brazil (São Paulo) 🇧🇷 | http://chat.whatsapp.com/K7sVCLTQBDrLrbIMwmSmlm | https://chat.whatsapp.com/K7sVCLTQBDrLrbIMwmSmlm | works (ok, 200) |
| wa-21 | Winter (Alp d'Huez, FR) 🇫🇷 | http://chat.whatsapp.com/HZ3QTcMBXe82GRgLuQswcq | https://chat.whatsapp.com/HZ3QTcMBXe82GRgLuQswcq | works (ok, 200) |

## WhatsApp invite groups

26 invites checked by reading the public invite page only (no login, no join request): 25 active, 1 invalid or revoked, 0 indeterminate.

| id | group title | invite | state | group name on invite page |
| --- | --- | --- | --- | --- |
| wa-1 | Solo & Group Travellers (Community) ✨✈️ | https://chat.whatsapp.com/Jt8m3LkfniYC7Vipnavj2e | active | TML - W2 - Solo & Group Travellers Community ✨🌈🌞🍄🎵🌌☮️💖🌎🚆✈️ |
| wa-2 | Main Chat (Solo & Group Travellers) 💬 | https://chat.whatsapp.com/LyRDb3qxs0u1eytQKsCmDw | active | TML - W2 Main Chat - Solo & Group Travellers 💬📢 |
| wa-3 | Weekend 1 (General Chat) 💬 | https://chat.whatsapp.com/GfB6z4RDvQN65mGpSYFXu5 | active | TML - W1 Main Chat - Solo & Group Travellers 💬📢 |
| wa-4 | Weekend 2 (General Chat) 💬 | https://chat.whatsapp.com/DmeA53dRZpW3x2afZKRgHS | active | W2 chat closed |
| wa-5 | South Africa Chat (🇿🇦) ☁️ | https://chat.whatsapp.com/HPbZsTu80o532IMrpwS0px | active | TML - Solo & Group Traveller - SA Chat 🇿🇦💭 |
| wa-6 | DreamVille (MG) - W1 Group Camp ⛺️ | https://chat.whatsapp.com/FtDY6xKSibc3je5dUa98IS | active | TML - W1 Magnificent Greens & Easy Tents - Camping Chat 🏕️💤 |
| wa-7 | DreamVille (MG) - W2 Group Camp ⛺️ | https://chat.whatsapp.com/LD1AyBrArih1pab5xfMNA9 | active | TML - W2 Magnificent Greens & Easy Tents - Camping Chat 🏕️💤 |
| wa-8 | DreamVille (Easy Tent) - W1 Group Camp ⛺️ | https://chat.whatsapp.com/HQbdftFnYGPGvnn068L6bp | active | TML - W1 Montagoe - Camping Chat ⛺️💰 |
| wa-9 | DreamVille (Easy Tent) - W2 Group Camp ⛺️ | http://chat.whatsapp.com/JAYGWTE2Nrx3SIartOY3i7 | active | TML - W2 Montagoe - Camping Chat ⛺️💰 |
| wa-10 | Accommodation (Camping, Airbnb, B&B, Hotels) ⛺️🏝️🏨 | http://chat.whatsapp.com/HG7FRoZMBJYLumQu8fdZ5B | active | TML - W2 Local Hosts, Camping, Airbnb, B&B, Hotels ⛺️ 🏡 🏨 |
| wa-11 | Transport & Travel (Local Taxis, Buses) 🚖🚌 | http://chat.whatsapp.com/KWJ03eNmOek6q1SnakOWhZ | active | TML - W2 Local Transport - Taxi & Bus 🚌 🚖 |
| wa-12 | NFT (Information & Exchange) 🥉 | http://chat.whatsapp.com/HoOuMFpuyXvHfkX46vk5VY | active | TML - NFT Info & FAQ🥉 |
| wa-13 | Add-on Voucher Sales (Exchange & Swap) 🍽️🥂 | https://chat.whatsapp.com/Bu4EGrMSLy17tbQ3v698VH | active | TML - W2 Add-On & Vouchers Exchange 🍽️ 🥂 |
| wa-14 | Tickets (Exchange/Swap/Advice) 🎟️📷 | https://chat.whatsapp.com/DPFTB5gRUTLHv0yPZyYVF6 | active | TML - W1 - Ticket Swap & Exchange 🎫🎟️ |
| wa-15 | Fraud Protection (How to spot Scammers) ❗️❓ | https://chat.whatsapp.com/Hp8ob6MM1LI6s2pzgeJPHP | active | TML - W2 Fraud Protection - How to spot Scammers ⁉️🚫 |
| wa-16 | Merchandise/Second Hand (Exchange & Swap) 🛒 | https://chat.whatsapp.com/FVf9DQZnv8y5h1jA1egMpW | active | TML - W2 Merchandise & Secondhand Stuff 💰🧢 |
| wa-17 | First Timer FAQs ℹ️ | https://chat.whatsapp.com/LVHVVY3ayLVAPt97CsXz69 | active | TML - W2 First Timer FAQ ℹ️🥇 |
| wa-18 | Camping Equipment Rental ⛺️🌲 | https://chat.whatsapp.com/H1iVWLwyotp1GYERjbRqIl | active | TML - W2 Camping Rental Equipment ⛺️🏕️ |
| wa-19 | Core (Medellin, COL) 🇨🇴 | https://chat.whatsapp.com/K5u56TF16ZAKTSHZnMhHf8 | active | TML - Core around the World ✈️🌍 |
| wa-20 | Brazil (São Paulo) 🇧🇷 | http://chat.whatsapp.com/K7sVCLTQBDrLrbIMwmSmlm | active | TML - Brazil, São Paulo 🇧🇷 |
| wa-21 | Winter (Alp d'Huez, FR) 🇫🇷 | http://chat.whatsapp.com/HZ3QTcMBXe82GRgLuQswcq | active | TML - Winter ❄️ Alpe d’Huez 🇫🇷 |
| wa-22 | Terra Solis (Dubai) 🇦🇪 | https://chat.whatsapp.com/EpzYXADRagC7x0EG58MfbE | active | TML - Terra Solis - UAE, Dubai 🇦🇪 |
| wa-23 | TML X INSOMNIAC - UNITY (LA, Sphere) 🇺🇸 | https://chat.whatsapp.com/CeI63us7R6z8xVsGB8tDD8 | active | TML - Unity Sphere - USA, Las Vegas  🇺🇸 |
| wa-24 | 👠✨ Festival Outfits 💫👗 | https://chat.whatsapp.com/K4PsxsSsqVPBkmJM3FoVfO | invalid | — |
| wa-25 | Female Only (General Chat) 💬👸 | https://chat.whatsapp.com/EDB3Pf2urIC0HFu3aPg8tt | active | TML - W2 Female Only - General Chat 💬🧝‍♀️ |
| wa-26 | ADE (Amsterdam, NL) 🇳🇱 | https://chat.whatsapp.com/KykJ2awuelP1JL1ovoSjhg | active | TML - ADE - Netherlands, Amsterdam 🇳🇱 |

## Notes and assumptions

- A link is only marked `ok` when a response arrived with a success status and, for WhatsApp, the invite page still printed a group name.
- `blocked` means the host answered but refused automated clients (403/429/451 or a bot challenge). It is recorded as blocked, never upgraded to ok. A blocked link may well work in a browser; that is not something this script can prove, so it is not claimed.
- Once a host answers 429 or a bot challenge, the remaining links on that host are recorded as blocked without another request, so a rate limit is not made worse. Any row whose note says "not requested again" was not measured in this run.
- Requests are capped at 4 in flight overall and 2 per host, 12 s each, with one retry only for transport errors (a status code is an answer and is never retried). Redirects are followed by hand, at most 2, and every hop is recorded.
- A plain `http:` URL is classified `insecure` whatever the server answered, because the scheme itself is the defect. The https alternative is tested separately and reported above.
- Duplicate URLs in the input (the same invite listed as both a resource and a group, or one Drive file used twice) are probed once and reported per entry, so the per-entry counts sum to more requests than the host actually received.
- 1 link(s) redirect more than twice over http; the chain was followed as far as the cap allows against the raw link, so that entry's destination is unconfirmed. The https twin for `resource-radio` was tested separately and does resolve: https://www.tomorrowland.com/one-world-radio/.
- 13 link(s) still use plain http and need rewriting to https.
- 1 link(s) could not be verified from a script and need one manual check in a browser: `resource-faqs`.

