import { describe, expect, it } from "vitest";
import { normalizeEntryDate } from "@/lib/ingestion/dates";

describe("normalizeEntryDate", () => {
  it("keeps valid ISO dates", () => {
    expect(normalizeEntryDate("2021-02-28")).toBe("2021-02-28");
  });

  it("drops ISO dates with impossible day values", () => {
    expect(normalizeEntryDate("2021-02-00")).toBeNull();
    expect(normalizeEntryDate("2021-02-29")).toBeNull();
    expect(normalizeEntryDate("2021-04-31")).toBeNull();
  });
});
