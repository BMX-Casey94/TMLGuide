import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { WhatsappGroup } from "@/data/schemas";
import { whatsappGroups } from "@/data/community";
import { WhatsappGroupCard } from "./whatsapp-group-card";
import { WhatsappSafetyNote, WHATSAPP_SAFETY_POINTS } from "./safety-note";

afterEach(cleanup);

const dreamville =
  whatsappGroups.find((group) => group.id === "wa-6") ?? whatsappGroups[0];

describe("WhatsappSafetyNote", () => {
  it("states every required warning", () => {
    render(<WhatsappSafetyNote />);
    const text = document.body.textContent ?? "";

    expect(text).toMatch(/unofficial community group/i);
    expect(text).toMatch(/never share ticket details, wristband numbers, passport or payment details/i);
    expect(text).toMatch(/admins will never ask you for payment/i);
    expect(text).toMatch(/beware impersonators/i);
  });

  it("lists every point as its own list item", () => {
    render(<WhatsappSafetyNote />);
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(
      WHATSAPP_SAFETY_POINTS.length,
    );
  });

  it("renders the full variant as a labelled section, not a landmark alert", () => {
    render(<WhatsappSafetyNote variant="full" />);

    expect(
      screen.getByRole("heading", { name: "Read this before you join a group" }),
    ).toBeInTheDocument();
    // 24 cards already carry the note; a live alert on each would overwhelm a screen reader.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/check through an official Tomorrowland channel/i)).toBeInTheDocument();
  });
});

describe("WhatsappGroupCard", () => {
  it("prints the title verbatim, emoji included", () => {
    render(<WhatsappGroupCard group={dreamville} />);
    expect(
      screen.getByRole("heading", { level: 4, name: dreamville.title }),
    ).toBeInTheDocument();
    expect(dreamville.title).toContain("⛺️");
  });

  it("names the region and the edition", () => {
    render(<WhatsappGroupCard group={dreamville} />);
    expect(screen.getByText(dreamville.region)).toBeInTheDocument();
    expect(screen.getByText("Belgium")).toBeInTheDocument();
  });

  it("shows the link-check date as a machine-readable time element", () => {
    render(<WhatsappGroupCard group={dreamville} />);
    const time = screen.getByText("18 Nov 2026");
    expect(time).toHaveAttribute("datetime", "2026-11-18");
    expect(screen.getByText(/Link checked/i)).toBeInTheDocument();
  });

  it("opens the invite in a new tab with the safe rel set", () => {
    render(<WhatsappGroupCard group={dreamville} />);
    const link = screen.getByRole("link", { name: /join on whatsapp/i });

    expect(link).toHaveAttribute("href", dreamville.inviteUrl);
    expect(link).toHaveAttribute("target", "_blank");
    // nofollow because these are user-populated external invites, not endorsements.
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("gives the repeated link label a unique accessible name", () => {
    render(<WhatsappGroupCard group={dreamville} />);
    const link = screen.getByRole("link", { name: /join on whatsapp/i });
    // The visible wording is kept; the group name is appended so 24 identical
    // "Join on WhatsApp" links are still distinguishable by a screen reader.
    const name = link.textContent ?? "";
    expect(name).toContain("Join on WhatsApp");
    expect(name).toContain(dreamville.title);
    expect(name).toContain("opens in a new tab");
  });

  it("carries the safety note on the card itself", () => {
    render(<WhatsappGroupCard group={dreamville} />);
    expect(screen.getByText(/admins will never ask you for payment/i)).toBeInTheDocument();
    expect(screen.getByText(/never share ticket details/i)).toBeInTheDocument();
  });

  it("is an article named by its title", () => {
    render(<WhatsappGroupCard group={dreamville} />);
    expect(screen.getByRole("article", { name: dreamville.title })).toBeInTheDocument();
  });

  it("omits the checked line when the record has no check date", () => {
    const withoutDate: WhatsappGroup = { ...dreamville, lastLinkCheck: undefined };
    render(<WhatsappGroupCard group={withoutDate} />);
    expect(screen.queryByText(/Link checked/i)).not.toBeInTheDocument();
  });

  it("renders at a different heading level when asked", () => {
    render(<WhatsappGroupCard group={dreamville} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: dreamville.title })).toBeInTheDocument();
  });
});
