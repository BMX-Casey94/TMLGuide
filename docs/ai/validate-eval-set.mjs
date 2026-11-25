// Validates docs/ai/eval-set.json: structure, counts, and satisfiability.
// Run: node docs/ai/validate-eval-set.mjs
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "docs/ai/eval-set.json");
const raw = fs.readFileSync(file, "utf8");

let set;
try {
  set = JSON.parse(raw);
} catch (e) {
  console.error("INVALID JSON:", e.message);
  process.exit(1);
}

const REQUIRED = [
  "id",
  "category",
  "question",
  "expectedBehaviour",
  "mustInclude",
  "mustNotInclude",
  "sourceRef",
];
const BEHAVIOURS = ["answer", "refuse", "warn"];

const errors = [];
const items = set.items;

if (!Array.isArray(items)) errors.push("items is not an array");
if (items.length !== 100) errors.push(`expected 100 items, found ${items.length}`);

const ids = new Set();
const byCategory = {};
const byBehaviour = {};

const normalise = (s) => s.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, " ");

for (const [i, item] of items.entries()) {
  const where = `items[${i}] (${item?.id ?? "no id"})`;

  for (const key of REQUIRED) {
    if (!(key in item)) errors.push(`${where} missing ${key}`);
  }
  if (ids.has(item.id)) errors.push(`${where} duplicate id`);
  ids.add(item.id);

  if (!BEHAVIOURS.includes(item.expectedBehaviour)) {
    errors.push(`${where} invalid expectedBehaviour ${JSON.stringify(item.expectedBehaviour)}`);
  }
  if (!set.categories.includes(item.category)) {
    errors.push(`${where} category not declared: ${item.category}`);
  }
  byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  byBehaviour[item.expectedBehaviour] = (byBehaviour[item.expectedBehaviour] ?? 0) + 1;

  if (typeof item.question !== "string" || item.question.trim().length < 8) {
    errors.push(`${where} question too short`);
  }
  if (!/^src\/|^docs\/|^\.env/.test(item.sourceRef ?? "")) {
    errors.push(`${where} sourceRef does not point at src/, docs/ or .env: ${item.sourceRef}`);
  }

  for (const field of ["mustInclude", "mustNotInclude"]) {
    const list = item[field];
    if (!Array.isArray(list) || list.length === 0) {
      errors.push(`${where} ${field} must be a non-empty array`);
      continue;
    }
    if (new Set(list.map(normalise)).size !== list.length) {
      errors.push(`${where} ${field} has duplicates`);
    }
    for (const phrase of list) {
      if (typeof phrase !== "string" || phrase.trim() === "") {
        errors.push(`${where} ${field} has a blank phrase`);
      }
    }
  }

  // A mustInclude phrase that contains a mustNotInclude phrase is unsatisfiable:
  // an answer cannot contain the required string without also containing the
  // banned one. The reverse is fine, and common: banning the phrase
  // "includes DreamVille camping" does not stop an answer from saying
  // "DreamVille". That asymmetry is why mustNotInclude strings are chosen as
  // whole false claims rather than bare keywords.
  for (const need of item.mustInclude ?? []) {
    for (const banned of item.mustNotInclude ?? []) {
      if (normalise(need).includes(normalise(banned))) {
        errors.push(
          `${where} unsatisfiable: mustInclude ${JSON.stringify(need)} contains mustNotInclude ${JSON.stringify(banned)}`,
        );
      }
    }
  }
}

// The three families the brief requires must all be present.
for (const [name, predicate] of [
  ["belgium", (i) => i.category === "belgium-tickets"],
  ["dreamville/montagoe", (i) => i.category === "dreamville-montagoe"],
  ["winter", (i) => i.category === "winter"],
  ["brasil", (i) => i.category === "brasil"],
  ["sale/exchange", (i) => i.category === "sales-and-exchange"],
  ["shuttles/trains/lockers/pearls/age", (i) => i.category === "practical-travel"],
  ["accessibility", (i) => i.category === "accessibility"],
  ["scam/trick", (i) => i.category === "scams-safety"],
  ["refusal", (i) => i.category === "unpublished-refusal"],
  ["prompt injection", (i) => i.category === "prompt-injection"],
]) {
  const n = items.filter(predicate).length;
  if (n === 0) errors.push(`no items in required family: ${name}`);
}

// Currency discipline: no Brasil item may carry a euro/sterling figure in
// mustInclude, and no Belgium/Winter item may carry a real figure.
for (const item of items) {
  const joined = (item.mustInclude ?? []).join(" ");
  if (item.category === "brasil" && /[€£]/.test(joined)) {
    errors.push(`${item.id} is a Brasil item but mustInclude carries € or £`);
  }
  if (["belgium-tickets", "winter", "dreamville-montagoe"].includes(item.category) && /R\$/.test(joined)) {
    errors.push(`${item.id} is a EUR item but mustInclude carries R$`);
  }
}

if (errors.length) {
  console.error(`FAILED with ${errors.length} error(s):`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log("PASS");
console.log("items:", items.length);
console.log("unique ids:", ids.size);
console.log("by category:", JSON.stringify(byCategory, null, 2));
console.log("by expectedBehaviour:", JSON.stringify(byBehaviour, null, 2));
