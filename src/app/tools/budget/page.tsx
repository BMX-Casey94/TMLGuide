import type { Metadata } from "next";
import { BudgetCalculator } from "@/components/tools/budget-calculator";
import type { PaymentTermsFact } from "@/components/tools/budget-state";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import { addOns, saleWindows as belgiumSaleWindows, tickets as belgiumTickets } from "@/data/belgium";
import { winterFacts, winterTickets } from "@/data/winter";
import { brasilTickets } from "@/data/brasil";
import { socialMetadata } from "@/lib/seo/social";

const TITLE = "Festival budget calculator";
const DESCRIPTION =
  "An independent Tomorrowland budget calculator for Belgium, Winter and Brasil. Add tickets, accommodation, travel, food and extras for one person or a group, in euros or reais, with a category breakdown.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/budget" },
  ...socialMetadata({ path: "/tools/budget", title: TITLE, description: DESCRIPTION }),
};

/**
 * The verified Winter payment-terms fact, read from the data layer.
 *
 * Passed to the calculator as data rather than looked up inside it, so the
 * component never imports the Winter dataset and the hint disappears by itself
 * if the fact is withdrawn. The facts array is searched by id because that id is
 * the stable handle the Winter data assigns it.
 */
const WINTER_PAYMENT_TERMS_ID = "package-payment-terms";

function winterPaymentTerms(): PaymentTermsFact | undefined {
  const fact = winterFacts.find((entry) => entry.id === WINTER_PAYMENT_TERMS_ID);
  if (fact === undefined) return undefined;
  return {
    id: fact.id,
    value: fact.value,
    ...(fact.detail === undefined ? {} : { detail: fact.detail }),
    ...(fact.amountEur === undefined ? {} : { amountEur: fact.amountEur }),
    lastVerified: fact.lastVerified,
    source: { url: fact.source.url },
  };
}

/**
 * The sources shown under the calculator.
 *
 * Built from the data rather than typed here, so a price's stated source is the
 * source the calculator actually used. Each entry carries the record's own
 * `source.title`, and duplicates are collapsed by URL: two ticket records that
 * cite the same page appear once, while two records citing different pages show
 * their different page titles rather than a repeated generic label.
 */
function budgetSources(): readonly ToolSource[] {
  const byUrl = new Map<string, ToolSource>();

  const add = (source: { url: string; title: string; retrievedOn: string }): void => {
    if (byUrl.has(source.url)) return;
    byUrl.set(source.url, {
      url: source.url,
      label: source.title,
      retrievedOn: source.retrievedOn,
    });
  };

  for (const ticket of belgiumTickets) add(ticket.source);
  for (const ticket of winterTickets) add(ticket.source);
  for (const ticket of brasilTickets) add(ticket.source);
  for (const addOn of addOns) add(addOn.source);
  for (const window of belgiumSaleWindows) add(window.source);

  const paymentTerms = winterFacts.find((entry) => entry.id === WINTER_PAYMENT_TERMS_ID);
  if (paymentTerms !== undefined) add(paymentTerms.source);

  return [...byUrl.values()];
}

/**
 * The budget calculator page.
 *
 * A Server Component. It reads the ticket prices, the add-ons and the Winter
 * payment terms from the validated data layer and passes the payment fact to the
 * client calculator, so the page ships one small interactive island rather than
 * the whole dataset.
 */
export default function BudgetToolPage() {
  return (
    <ToolShell
      kicker="Money"
      title="Festival budget calculator"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Budget calculator" },
      ]}
      intro={
        <>
          <p>
            Work out what a trip costs before you commit. Start from a published ticket price or
            type your own, then add accommodation, travel, food and anything else.
          </p>
          <p>
            Amounts are in the edition&rsquo;s own currency: euros for Belgium and Winter, reais for
            Brasil. Nothing is converted, and a Brasil plan is never shown in euros.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the ticket prices and sources below are still on the page, but the
          totals cannot be recalculated as you type.
        </p>
      }
      sources={budgetSources()}
    >
      <BudgetCalculator paymentTerms={winterPaymentTerms()} />
    </ToolShell>
  );
}
