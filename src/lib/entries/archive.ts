export interface ArchiveEntryReference {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchiveEntryViewModel extends ArchiveEntryReference {
  label: string;
  year: string | null;
  sortTime: number;
}

export interface ArchiveEntryGroup {
  key: string;
  label: string;
  entries: ArchiveEntryViewModel[];
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseTimestamp(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function groupArchiveEntries(
  entries: ArchiveEntryReference[],
): ArchiveEntryGroup[] {
  const datedGroups = new Map<string, ArchiveEntryViewModel[]>();
  const undated: ArchiveEntryViewModel[] = [];

  for (const entry of entries) {
    const parsedDate = entry.entry_date ? parseDateOnly(entry.entry_date) : null;

    if (parsedDate) {
      const year = String(parsedDate.getUTCFullYear());
      const viewModel: ArchiveEntryViewModel = {
        ...entry,
        label: MONTH_FORMATTER.format(parsedDate),
        year,
        sortTime: parsedDate.getTime(),
      };
      const group = datedGroups.get(year);
      if (group) group.push(viewModel);
      else datedGroups.set(year, [viewModel]);
    } else {
      undated.push({
        ...entry,
        label: "Undated entry",
        year: null,
        sortTime: parseTimestamp(entry.created_at),
      });
    }
  }

  const groups: ArchiveEntryGroup[] = Array.from(datedGroups.entries())
    .sort(([leftYear], [rightYear]) => Number(rightYear) - Number(leftYear))
    .map(([year, groupEntries]) => ({
      key: year,
      label: year,
      entries: groupEntries.sort((left, right) => right.sortTime - left.sortTime),
    }));

  if (undated.length > 0) {
    const sortedUndated = undated
      .sort((left, right) => right.sortTime - left.sortTime)
      .map((entry, index) => ({
        ...entry,
        label: index === 0 ? "Undated entry" : `Undated entry ${index + 1}`,
      }));

    groups.push({
      key: "undated",
      label: "Undated",
      entries: sortedUndated,
    });
  }

  return groups;
}
