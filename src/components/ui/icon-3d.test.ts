// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_3D_NAMES } from "./icon-3d";

const iconsDirectory = path.resolve(process.cwd(), "public/icons/3d");

function filesOnDisk(): string[] {
  return readdirSync(iconsDirectory)
    .filter((file) => file.endsWith(".webp"))
    .map((file) => file.replace(/\.webp$/, ""))
    .sort();
}

describe("ICON_3D_NAMES", () => {
  it("has a file on disk for every exported name", () => {
    for (const name of ICON_3D_NAMES) {
      const file = path.join(iconsDirectory, `${name}.webp`);
      expect(existsSync(file), `missing ${file}`).toBe(true);
    }
  });

  it("contains exactly the files in public/icons/3d, with none missing or extra", () => {
    expect([...ICON_3D_NAMES].sort()).toEqual(filesOnDisk());
  });

  it("contains no duplicate names", () => {
    expect(new Set(ICON_3D_NAMES).size).toBe(ICON_3D_NAMES.length);
  });

  it("uses lower case kebab-case file names", () => {
    for (const name of ICON_3D_NAMES) {
      expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
