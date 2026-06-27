const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseEntryDate(entryDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(entryDate);

  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, monthIndex, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === monthIndex &&
      date.getUTCDate() === day
    ) {
      return date;
    }

    return null;
  }

  const date = new Date(entryDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAge(from: Date, to: Date): string {
  const monthDiff =
    (to.getFullYear() - from.getUTCFullYear()) * 12 +
    (to.getMonth() - from.getUTCMonth());

  if (monthDiff <= 0) return "this month";

  if (monthDiff < 12) {
    return `${monthDiff} ${monthDiff === 1 ? "month" : "months"} ago`;
  }

  const yearDiff = Math.floor(monthDiff / 12);
  return `${yearDiff} ${yearDiff === 1 ? "year" : "years"} ago`;
}

export function formatEntryReferenceDate(
  entryDate: string | null,
  now = new Date(),
): string {
  if (!entryDate) return "RECENT ENTRY";

  const date = parseEntryDate(entryDate);
  if (!date) return "RECENT ENTRY";

  return `${monthYearFormatter.format(date)}, ${formatAge(date, now)}`;
}

export function getEntryReferenceLabel(
  entryId: string,
  entryDatesById: Map<string, string | null>,
  now = new Date(),
): string {
  return formatEntryReferenceDate(entryDatesById.get(entryId) ?? null, now);
}
