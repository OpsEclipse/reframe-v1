export function formatEntryReferenceDate(entryDate: string | null): string {
  if (!entryDate) return "RECENT ENTRY";

  const date = new Date(entryDate);
  if (Number.isNaN(date.getTime())) return "RECENT ENTRY";

  return date
    .toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

export function getEntryReferenceLabel(
  entryId: string,
  entryDatesById: Map<string, string | null>,
): string {
  return formatEntryReferenceDate(entryDatesById.get(entryId) ?? null);
}
