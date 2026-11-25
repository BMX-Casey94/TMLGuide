// Verifies that every sourceRef in eval-set.json resolves to a real file, and
// that any "#record-id" fragment appears somewhere in that file.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const set = JSON.parse(fs.readFileSync(path.join(root, "docs/ai/eval-set.json"), "utf8"));

const cache = new Map();
const read = (p) => {
  if (!cache.has(p)) cache.set(p, fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
  return cache.get(p);
};

let missing = 0;
let badFragment = 0;

for (const item of set.items) {
  // sourceRef may list several files, separated by "; " and carrying #fragments.
  const refs = item.sourceRef.split(";").map((s) => s.trim()).filter(Boolean);
  for (const ref of refs) {
    const filePart = ref.split("#")[0].trim();
    // Fragments are comma-separated record ids or field paths after the first "#".
    const fragments = ref
      .split("#")
      .slice(1)
      .join("#")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    const abs = path.join(root, filePart);
    const content = read(abs);

    if (content === null) {
      console.error(`MISSING FILE  ${item.id}  ${filePart}`);
      missing++;
      continue;
    }

    for (const frag of fragments) {
      // Fragments are prose labels in this set (e.g. "festival.weekendOne"), so
      // accept a plain substring match rather than requiring exact syntax.
      const bare = frag.replace(/^[\w.]+#/, "").replace(/,$/, "");
      const candidates = [frag, bare, bare.split(",")[0]];
      if (!candidates.some((c) => c && content.toLowerCase().includes(c.toLowerCase()))) {
        console.error(`UNRESOLVED     ${item.id}  ${filePart}#${frag}`);
        badFragment++;
      }
    }
  }
}

console.log(`\n${set.items.length} items checked`);
console.log(`missing files: ${missing}`);
console.log(`unresolved fragments: ${badFragment}`);
process.exit(missing === 0 && badFragment === 0 ? 0 : 1);
