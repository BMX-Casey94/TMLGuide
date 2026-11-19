import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * Brasil tickets: the pass types, the half-price rule as the operator publishes
 * it, the closed 2027 sale calendar and the payment methods that are confirmed.
 */
export const brasilTicketsChapter = guideChapterSchema.parse({
  edition: "brasil",
  slug: "tickets",
  order: 2,
  title: "Tickets and prices",
  summary:
    "Every 2027 Brasil pass in reais, how the meia-entrada discount actually works, the closed sale calendar and the payment methods that are confirmed.",
  lastVerified: VERIFIED_ON,
  related: ["brasil/overview", "brasil/dreamville", "belgium/tickets", "general/pearls"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Brasil 2027 festival tickets and prices",
      url: "https://brasil.tomorrowland.com/en/tickets/festival-tickets/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "Who is entitled to a half-price (meia-entrada) ticket?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/en-us/articles/13511256421780",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "What is a Social Ticket?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13511236435348",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "Tomorrowland Brasil 2027: all you need to know",
      url: "https://www.tomorrowland.com/article/tomorrowland-brasil-2027-all-you-need-to-know/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s5",
      title: "Bybit Pre-Sale press release",
      url: "https://press.brasil.tomorrowland.com/tomorrowland-brasil-2027",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s6",
      title: "Portal do Amanhã — Bybit Early Bird sale information",
      url: "https://portaldoamanha.tomorrowlandbrasil.com/en",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s7",
      title: "How many tickets can I buy?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/14233074960916",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s8",
      title: "Which payment methods are accepted?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13511229008916",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s9",
      title: "Where is the box office?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/14408278973588",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "pass-types", text: "Pass types" },
    {
      type: "p",
      text: "Brasil sells two three-day products, Full Madness and Full Madness Comfort, and three single-day products, a Day Pass, a Day Comfort Pass and a Day N°1 Pass. Prices are in Brazilian reais and are not converted anywhere in this guide.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The 2027 Comfort wording is specific: premium views, covered terraces, table service and dedicated waitstaff, with wave-style dining at the Mainstage. Older descriptions of snack stations and dedicated toilets do not appear in the 2027 text.",
      sources: ["s1"],
    },
    {
      type: "data",
      edition: "brasil",
      collection: "tickets",
      idPrefix: "full-madness",
      caption: "Three-day Full Madness passes, standard and Comfort (sold out)",
    },
    { type: "h2", id: "day-passes", text: "Day passes" },
    {
      type: "p",
      text: "Day passes are priced for 2027 and are sold out. They cover one day only, so a reader who wants two days of the weekend needs a three-day pass or two day passes.",
      sources: ["s1"],
    },
    {
      type: "data",
      edition: "brasil",
      collection: "tickets",
      idPrefix: "day-pass",
      caption: "Single-day passes (sold out)",
    },
    { type: "h2", id: "half-price", text: "The half-price (meia-entrada) rate" },
    {
      type: "p",
      text: "Meia-entrada is a Brazilian legal benefit, open only to Brazilian citizens. The official Brasil help centre states that it is available exclusively to Brazilian citizens because it is granted under Brazilian law, so a visitor from the UK, the EU or anywhere else outside Brazil cannot buy it.",
      sources: ["s2"],
    },
    {
      type: "p",
      text: "The discount is a flat R$1,580 off the full price, not a percentage. On the standard Full Madness pass, R$3,160 less R$1,580 is exactly half, which is why the label fits there. On the R$5,535 Comfort pass the same R$1,580 leaves R$3,955, about 71% of the full price, and on the R$2,960 Bybit early-bird pass it leaves R$1,380, about 47%. The pass table above lists every half-price row alongside its full-price counterpart, so the gap is visible without arithmetic.",
      sources: ["s1", "s2"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Proof at the gate",
      text: "If eligibility cannot be proved at entry, access is granted only after paying the difference up to the full price in force on the festival day. Bring the document itself: bank slips, enrolment letters and website screenshots are refused for students.",
      sources: ["s2"],
    },
    { type: "h3", id: "who-qualifies", text: "Who qualifies" },
    {
      type: "ul",
      items: [
        "Brazilian students, with a nationally standardised CIE digital student ID or an equivalent card from an authorised body such as ANPG, UNE, UBES, a state or municipal entity, a DCE or an academic centre.",
        "People aged 60 or over, with valid government photo ID.",
        "People with disabilities, plus one companion where assistance is required, with a BPC card or INSS documentation and the companion's declaration of need.",
        "São Paulo state public-school administrative staff.",
        "São Paulo state public-school teachers.",
        "Low-income young adults aged 18 to 29 registered in Cadastro Único with family income up to two minimum wages, holding a valid ID Jovem. Federal Law 12,933/2013 sets this band at 15 to 29; the discrepancy with the operator's article is theirs, not a reading error.",
      ],
      sources: ["s2"],
    },
    { type: "h2", id: "social-ticket", text: "The Social ticket" },
    {
      type: "p",
      text: "The Social ticket bundles a R$30 donation to the Tomorrowland Foundation. The official article calls it a 40% discount, but the published price list is a flat R$1,235 below the matching standard ticket, which is 39% on Full Madness and 22% on Full Madness Comfort. The two official surfaces disagree; the price list is what you actually pay.",
      sources: ["s3", "s1"],
    },
    { type: "h2", id: "sale-calendar", text: "The 2027 sale calendar" },
    {
      type: "p",
      text: "Every 2027 sale moment has passed: the Bybit Early Bird in May, Global Journey in September, the Bybit Pre-Sale in September and the WorldWide Ticket Sale on 24 September 2026. Pre-registration was required to take part in any of them and ran from 30 April 2026 to 23 September 2026.",
      sources: ["s4", "s5"],
    },
    {
      type: "data",
      edition: "brasil",
      collection: "sale-windows",
      caption: "Brasil 2027 sale moments, in São Paulo time",
    },
    {
      type: "p",
      text: "Global Journey went on sale on 15 September 2026. The 17 September date still appears on some official pages but was the originally announced date, later brought forward; 15 September is the corrected date.",
      sources: ["s4", "s6"],
    },
    {
      type: "p",
      text: "Shuttle passes also went on sale in the WorldWide Ticket Sale on 24 September 2026, rather than in a sale of their own.",
      sources: ["s4"],
    },
    { type: "h3", id: "how-many", text: "How many you can buy" },
    {
      type: "p",
      text: "The cap is six tickets per buyer, counted per CPF and per Tomorrowland Account across every sale moment. Two official help-centre articles disagree on whether a separate, lower cap applied during the Bybit Pre-Sale, so no Bybit sub-limit is published here.",
      sources: ["s7"],
    },
    { type: "h2", id: "payment", text: "Paying" },
    {
      type: "p",
      text: "Mastercard, Visa, Elo and Google Pay are confirmed, and the box office also takes debit cards. Corporate cards are refused. American Express appears on no official page, and Pix appears on the ticket page but not in the payment article, so treat Pix as unconfirmed.",
      sources: ["s8"],
    },
    {
      type: "p",
      text: "The box office is at Teatro Renault, Avenida Brigadeiro Luís Antônio 411, República, São Paulo.",
      sources: ["s9"],
    },
    {
      type: "callout",
      tone: "note",
      title: "The Early Bird headline was not the Full Madness discount",
      text: "The Bybit Early Bird sale advertised up to 20% off, capped at R$400. The published early-bird Full Madness price is a flat R$200 below the standard pass, which is 6.3%. The 20% headline describes the best case on other eligible products, not the Full Madness saving.",
      sources: ["s6", "s1"],
    },
  ],
});
