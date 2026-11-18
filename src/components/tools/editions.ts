import { z } from "zod";

/**
 * The editions the planning tools cover, and the currency each one is priced in.
 *
 * Brasil publishes every price in reais and no official source states a euro
 * equivalent, so the tools never convert between the two. A tool therefore needs
 * to know which currency an edition uses before it can format a single figure,
 * which is why that mapping lives here rather than in each calculator.
 *
 * The schema is the single definition: `TOOL_EDITIONS` is derived from its
 * options, so the list a control renders and the list a stored state validates
 * against cannot drift apart.
 */
export const toolEditionSchema = z.enum(["belgium", "winter", "brasil"], {
  error: 'edition must be "belgium", "winter" or "brasil"',
});

export type ToolEdition = z.infer<typeof toolEditionSchema>;

/** Every edition, in the order the site presents them. */
export const TOOL_EDITIONS: readonly ToolEdition[] = toolEditionSchema.options;

/** Currencies a tool can display. Never mixed within one calculation. */
export const toolCurrencySchema = z.enum(["EUR", "BRL"], {
  error: 'currency must be "EUR" or "BRL"',
});

export type ToolCurrency = z.infer<typeof toolCurrencySchema>;

/** Human-readable edition names, used in headings and calendar summaries. */
export const EDITION_LABEL: Readonly<Record<ToolEdition, string>> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
};

export function isToolEdition(value: unknown): value is ToolEdition {
  return toolEditionSchema.safeParse(value).success;
}

/**
 * The currency an edition's prices are published in. Belgium and Winter are
 * quoted in euros by the festival; Brasil is quoted in reais.
 */
export function currencyForEdition(edition: ToolEdition): ToolCurrency {
  return edition === "brasil" ? "BRL" : "EUR";
}
