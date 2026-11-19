import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * NFT chapter. Confirmed material only: the collections, the Solana setup, the
 * Medallion as a holder status, snapshot mechanics and wallet safety. No ticket
 * guarantee is stated, because the official FAQ still carries 2024 terms and the
 * newer per-Medallion claims rest on fan guides.
 */
export const generalNftChapter = guideChapterSchema.parse({
  edition: "general",
  slug: "nft",
  order: 4,
  title: "NFTs and the Medallion",
  summary:
    "What Tomorrowland's Solana NFT collections are, what the Medallion status means, how holder pre-sales are verified and how to avoid the known scams.",
  lastVerified: VERIFIED_ON,
  related: ["general/sets", "general/radio", "general/editions"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland NFT — official site",
      url: "https://nft.tomorrowland.com/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "Tomorrowland NFT — frequently asked questions",
      url: "https://nft.tomorrowland.com/faq",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "Tomorrowland NFT — Medallion sales",
      url: "https://nft.tomorrowland.com/medallion-sales",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "collections", text: "The collections" },
    {
      type: "p",
      text: "Tomorrowland has released three NFT collections: A Letter from the Universe, The Reflection of Love and The Symbol of Love and Unity. The first two are also labelled by edition year on the marketing pages, as the Winter 2022 and Belgium 2022 collections, but the collection names are the three above.",
      sources: ["s2"],
    },
    {
      type: "p",
      text: "They run on Solana, so they are held in a Solana wallet and bought with SOL. The original launch dropped on Magic Eden's launchpad on 15 July 2022, the first day of that year's Belgium edition.",
      sources: ["s2", "s1"],
    },
    { type: "h2", id: "medallion", text: "The Medallion status" },
    {
      type: "p",
      text: "The Medallion of Memoria is a holder status, not an NFT. You earn it by holding at least one NFT from each of the three collections in a single wallet. Tomorrowland states plainly that the Medallion is not an NFT and that there is no Medallion NFT, so anything called a Medallion that appears in your wallet is not official.",
      sources: ["s2"],
    },
    {
      type: "p",
      text: "The status brings access to an NFT-holder pre-sale. What that access entitles a holder to buy is not stated in current official terms: the official FAQ still carries the wording of the 2024 sale cycle, and no official page sets out a 2027 entitlement. Read the terms published with the sale you are entering rather than relying on a figure from an earlier year.",
      sources: ["s2", "s3"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "No ticket guarantee is published",
      text: "Fan guides repeat a guaranteed number of tickets per Medallion each year. The official FAQ still states the 2024 terms, and no current official page confirms a 2027 guaranteed allocation, so treat any such promise as unverified.",
      sources: ["s2"],
    },
    { type: "h2", id: "pre-sale-access", text: "How pre-sale access is checked" },
    {
      type: "ol",
      items: [
        "Pre-register for the specific sale. Registration is per sale, not a standing right.",
        "Keep the qualifying NFTs in the wallet you registered. Tomorrowland and Matrica require that the NFTs remain in your wallet, with no active marketplace listing.",
        "Wait for the snapshot. The snapshot records what the wallet holds at that moment; if the tokens are not there, or are listed for sale, the entry does not qualify.",
        "Buy through the official sale route once access is granted.",
      ],
      sources: ["s2"],
    },
    {
      type: "p",
      text: "Missing a snapshot means missing that sale, and there is no repair route afterwards. Verification runs through Matrica, Tomorrowland's named verification partner, and support runs through ticket channels in the official Discord at tomorrow.land/discord.",
      sources: ["s2", "s1"],
    },
    {
      type: "facts",
      caption: "What a holder has to keep in place",
      rows: [
        {
          label: "Wallet contents",
          value: "At least one NFT from each of the three collections, held in one wallet",
          sources: ["s2"],
        },
        {
          label: "Listing status",
          value: "No active marketplace listing on any qualifying NFT",
          sources: ["s2"],
        },
        {
          label: "Registration",
          value: "Separate pre-registration for each sale, followed by a snapshot",
          sources: ["s2"],
        },
        {
          label: "Verification",
          value: "Through Matrica, with support in the official Discord",
          sources: ["s2"],
        },
      ],
    },
    { type: "h2", id: "portal", text: "Why the Medallion portal shows nothing" },
    {
      type: "p",
      text: "The Medallion sales page on the NFT site is a placeholder. It carries a notice that it will soon be updated with fresh information, so a wallet that should qualify can display an empty or zero count without anything being wrong with the NFTs.",
      sources: ["s3"],
    },
    {
      type: "p",
      text: "Check holdings at the wallet level and through Matrica rather than trusting the portal figure.",
      sources: ["s3", "s2"],
    },
    { type: "h2", id: "safety", text: "Wallet safety" },
    {
      type: "ul",
      items: [
        "A scam token named Medallion of Memoria has been airdropped to holders. It is not official. Do not click the link in its description; send it to the trash wallet tmltrash.sol, whose address is CxjMGSjrvNLKUj441mADACP7Nu7p79DYvkGQEAZDJfMA, or burn it.",
        "Never verify or buy through a platform other than Matrica and a reputable Solana marketplace.",
        "Do not transfer qualifying NFTs out of the wallet between registration and the sale, and do not list them.",
        "Do not share a seed phrase or sign a transaction you did not initiate. No legitimate verification step needs either.",
      ],
      sources: ["s2", "s1"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The airdrop is the attack",
      text: "An unexpected NFT arriving in your wallet is a phishing attempt, not a gift. The Medallion name is deliberately reused to look official. Do not open its link and do not sign anything it asks for.",
      sources: ["s2"],
    },
  ],
});
