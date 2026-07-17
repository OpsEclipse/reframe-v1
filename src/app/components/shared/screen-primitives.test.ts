import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("screen primitives bundle boundary", () => {
  const source = readFileSync(
    new URL("./screen-primitives.tsx", import.meta.url),
    "utf8",
  );

  it("does not pull importer or archive code into login", () => {
    expect(source).not.toContain("DockWithImporter");
    expect(source).not.toContain("OldEntriesArchive");
    expect(source).not.toContain("/api/ingestion/");
  });

  it("reads the compact ingestion result count", () => {
    const dockSource = readFileSync(
      new URL("./dock-with-importer.tsx", import.meta.url),
      "utf8",
    );
    expect(dockSource).toContain("successPayload.entryCount");
    expect(dockSource).not.toContain("successPayload.entries");
  });
});
