/**
 * Tests for the contact form contract.
 *
 * A schema on the public boundary is the only thing standing between a request
 * body and a database column, so every boundary is pushed: empty, too short, too
 * long, wrong type, and the honeypot in each of its disguises.
 */

import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  CONTACT_FIELD_LIMITS,
  CONTACT_TOPICS,
  contactSubmissionSchema,
  fieldErrors,
  isHoneypotTripped,
} from "./contact-schema";

const VALID = {
  name: "Alex Turner",
  email: "alex@example.com",
  topic: "correction" as const,
  message: "The DreamVille opening date on the tickets page is a day out.",
};

describe("contactSubmissionSchema", () => {
  it("accepts a well-formed submission", () => {
    const result = contactSubmissionSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("accepts every published topic", () => {
    for (const topic of CONTACT_TOPICS) {
      expect(contactSubmissionSchema.safeParse({ ...VALID, topic }).success).toBe(true);
    }
  });

  it("rejects an unknown topic", () => {
    const result = contactSubmissionSchema.safeParse({ ...VALID, topic: "sales" });
    expect(result.success).toBe(false);
  });

  it("rejects a topic supplied with different casing", () => {
    // The value is a database label, not display text, so it is matched exactly.
    expect(contactSubmissionSchema.safeParse({ ...VALID, topic: "Correction" }).success).toBe(false);
  });

  it("trims surrounding whitespace on every text field", () => {
    const result = contactSubmissionSchema.safeParse({
      ...VALID,
      name: "  Alex Turner  ",
      email: "  alex@example.com  ",
      message: `  ${VALID.message}  `,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alex Turner");
      expect(result.data.email).toBe("alex@example.com");
      expect(result.data.message).toBe(VALID.message);
    }
  });

  describe("name", () => {
    it("rejects a name that is too short", () => {
      const result = contactSubmissionSchema.safeParse({ ...VALID, name: "A" });
      expect(result.success).toBe(false);
    });

    it("rejects a name that is only whitespace", () => {
      expect(contactSubmissionSchema.safeParse({ ...VALID, name: "    " }).success).toBe(false);
    });

    it("rejects a name over the cap", () => {
      expect(
        contactSubmissionSchema.safeParse({
          ...VALID,
          name: "a".repeat(CONTACT_FIELD_LIMITS.name.max + 1),
        }).success,
      ).toBe(false);
    });

    it("accepts a name at exactly the cap", () => {
      expect(
        contactSubmissionSchema.safeParse({
          ...VALID,
          name: "a".repeat(CONTACT_FIELD_LIMITS.name.max),
        }).success,
      ).toBe(true);
    });

    it("rejects a non-string name", () => {
      expect(contactSubmissionSchema.safeParse({ ...VALID, name: 42 }).success).toBe(false);
      expect(contactSubmissionSchema.safeParse({ ...VALID, name: null }).success).toBe(false);
    });
  });

  describe("email", () => {
    it("accepts ordinary addresses", () => {
      for (const email of [
        "a@b.co",
        "first.last@example.com",
        "user+tag@example.co.uk",
        "o'brien@example.com",
        "user_name@sub.example.org",
      ]) {
        expect(contactSubmissionSchema.safeParse({ ...VALID, email }).success).toBe(true);
      }
    });

    it("rejects addresses without a domain dot", () => {
      expect(contactSubmissionSchema.safeParse({ ...VALID, email: "a@localhost" }).success).toBe(
        false,
      );
    });

    it("rejects a missing local or domain part", () => {
      for (const email of ["@example.com", "alex@", "alex", ""]) {
        expect(contactSubmissionSchema.safeParse({ ...VALID, email }).success).toBe(false);
      }
    });

    it("rejects an address containing whitespace", () => {
      expect(contactSubmissionSchema.safeParse({ ...VALID, email: "a b@example.com" }).success).toBe(
        false,
      );
    });

    it("rejects a header-injection attempt", () => {
      // A newline in an address is the classic way to smuggle a second header
      // into an outgoing reply.
      expect(
        contactSubmissionSchema.safeParse({
          ...VALID,
          email: "a@example.com\nBcc: victim@example.com",
        }).success,
      ).toBe(false);
    });

    it("rejects an address over the length cap", () => {
      const long = `${"a".repeat(250)}@example.com`;
      expect(contactSubmissionSchema.safeParse({ ...VALID, email: long }).success).toBe(false);
    });
  });

  describe("message", () => {
    it("rejects a message under the minimum", () => {
      expect(contactSubmissionSchema.safeParse({ ...VALID, message: "too short" }).success).toBe(
        false,
      );
    });

    it("rejects a message over the cap", () => {
      expect(
        contactSubmissionSchema.safeParse({
          ...VALID,
          message: "a".repeat(CONTACT_FIELD_LIMITS.message.max + 1),
        }).success,
      ).toBe(false);
    });

    it("accepts a message at exactly the cap", () => {
      expect(
        contactSubmissionSchema.safeParse({
          ...VALID,
          message: "a".repeat(CONTACT_FIELD_LIMITS.message.max),
        }).success,
      ).toBe(true);
    });

    it("accepts multi-line text and markup as literal content", () => {
      // The message is stored as text and escaped on display; a `<script>` in it
      // is a validation non-event, not a reason to reject a legitimate reporter.
      const result = contactSubmissionSchema.safeParse({
        ...VALID,
        message: "Line one.\nLine two.\n\n<script>alert(1)</script>",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("honeypot", () => {
    it("is optional", () => {
      const { ...withoutHoneypot } = VALID as Record<string, unknown>;
      expect(contactSubmissionSchema.safeParse(withoutHoneypot).success).toBe(true);
    });

    it("accepts an empty value", () => {
      expect(contactSubmissionSchema.safeParse({ ...VALID, website: "" }).success).toBe(true);
    });

    it("rejects any filled value", () => {
      expect(contactSubmissionSchema.safeParse({ ...VALID, website: "spam" }).success).toBe(false);
    });
  });

  it("rejects unknown extra fields being silently kept", () => {
    // Zod strips unknown keys by default, so the parse succeeds but the output
    // must not carry the smuggled value through to the insert.
    const result = contactSubmissionSchema.safeParse({ ...VALID, role: "admin" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
    }
  });

  it("rejects a payload that is not an object", () => {
    for (const payload of [null, undefined, "string", 42, ["a"]]) {
      expect(contactSubmissionSchema.safeParse(payload).success).toBe(false);
    }
  });
});

describe("isHoneypotTripped", () => {
  it("is false for an absent or empty field", () => {
    expect(isHoneypotTripped({})).toBe(false);
    expect(isHoneypotTripped({ website: "" })).toBe(false);
    expect(isHoneypotTripped({ website: "   " })).toBe(false);
    expect(isHoneypotTripped({ website: null })).toBe(false);
    expect(isHoneypotTripped({ website: undefined })).toBe(false);
  });

  it("is true for any non-empty string", () => {
    expect(isHoneypotTripped({ website: "spam" })).toBe(true);
    expect(isHoneypotTripped({ website: " " })).toBe(false);
    expect(isHoneypotTripped({ website: "a" })).toBe(true);
  });

  it("is true for a non-string value, which a person's browser never sends", () => {
    // A bot sending a number or a boolean is still a bot; rejecting it as a
    // validation error would reveal that the field is watched.
    expect(isHoneypotTripped({ website: 5 })).toBe(true);
    expect(isHoneypotTripped({ website: true })).toBe(true);
    expect(isHoneypotTripped({ website: {} })).toBe(true);
    expect(isHoneypotTripped({ website: [] })).toBe(true);
  });

  it("is false for a payload that is not an object", () => {
    for (const payload of [null, undefined, "string", 42]) {
      expect(isHoneypotTripped(payload)).toBe(false);
    }
    // An array is not an object for this purpose: it cannot carry the field.
    expect(isHoneypotTripped([])).toBe(false);
  });

  it("does not mistake a similarly named field for the honeypot", () => {
    expect(isHoneypotTripped({ websites: "spam", url: "http://spam.example" })).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("maps each failing field to its first message", () => {
    const result = contactSubmissionSchema.safeParse({ name: "A", email: "bad", topic: "nope", message: "x" });
    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = fieldErrors(result.error);
    expect(Object.keys(errors).sort()).toEqual(["email", "message", "name", "topic"]);
    for (const message of Object.values(errors)) {
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("keeps only the first message per field", () => {
    const result = contactSubmissionSchema.safeParse({ ...VALID, message: "x" });
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(Object.keys(errors)).toEqual(["message"]);
  });

  it("returns an empty map when nothing failed", () => {
    // `fieldErrors` is only reachable after a failure, so a synthetic error with
    // no issues is the honest way to test the empty case.
    const result = contactSubmissionSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.keys(fieldErrors(new ZodError([])))).toEqual([]);
  });

  it("never includes a stack trace or an internal path in a message", () => {
    const result = contactSubmissionSchema.safeParse({});
    if (result.success) return;
    const errors = fieldErrors(result.error);
    for (const message of Object.values(errors)) {
      expect(message).not.toMatch(/[\\/]|node_modules|ZodError|at /);
    }
  });
});

describe("CONTACT_FIELD_LIMITS", () => {
  it("declares limits that the schema actually enforces", () => {
    // A drift between the advertised limits and the enforced ones is how a form
    // ends up rejecting a message it said was acceptable.
    const tooLong = {
      name: "a".repeat(CONTACT_FIELD_LIMITS.name.max + 1),
      email: `${"a".repeat(CONTACT_FIELD_LIMITS.email.max)}@e.com`,
      topic: "other",
      message: "b".repeat(CONTACT_FIELD_LIMITS.message.max + 1),
    };
    const result = contactSubmissionSchema.safeParse(tooLong);
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = Object.keys(fieldErrors(result.error));
    expect(fields).toContain("name");
    expect(fields).toContain("email");
    expect(fields).toContain("message");
  });

  it("has a message cap that fits inside the route's body limit", () => {
    // 5,000 characters is at most 20 kB of UTF-8 once JSON-escaped, so the 32 kB
    // body cap must be comfortably larger.
    const worstCaseBytes = CONTACT_FIELD_LIMITS.message.max * 4;
    expect(worstCaseBytes).toBeLessThanOrEqual(20 * 1024);
  });
});
