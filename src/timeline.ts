/**
 * tsuki (月) — Timeline generation
 *
 * Builds daily activity data and renders ASCII bar charts.
 */

import { GitCommit, DayActivity } from './types.js';

/**
 * Group commits by date (YYYY-MM-DD) and return daily activity counts.
 * Fills in zero-activity days within the range for a complete timeline.
 */
export function buildTimeline(commits: GitCommit[], since: string, until: string): DayActivity[] {
  // Count commits per day
  const dayCounts = new Map<string, number>();
  for (const commit of commits) {
    const day = commit.date.slice(0, 10); // YYYY-MM-DD from ISO string
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }

  // Build a complete range of days.
  // Try parsing since/until; if they're relative strings (e.g. "7 days ago", "now"),
  // derive the range from actual commit dates instead.
  let start = parseDate(since);
  let end = parseDate(until);

  const isRelative = (s: string) => /\b(ago|yesterday|today|last|this|now)\b/i.test(s);
  const startValid = !isNaN(start.getTime()) && !isRelative(since);
  const endValid = !isNaN(end.getTime()) && !isRelative(until);

  // If we can't resolve the range from strings, derive from commit data
  if (!startValid || !endValid) {
    if (dayCounts.size > 0) {
      const sortedDays = [...dayCounts.keys()].sort();
      if (!startValid) start = new Date(sortedDays[0]);
      if (!endValid) end = new Date(sortedDays[sortedDays.length - 1]);
    } else {
      return [];
    }
  }

  const days: DayActivity[] = [];
  const current = new Date(start);
  let safety = 0;
  while (current <= end && safety < 365) {
    const dateStr = formatDate(current);
    days.push({
      date: dateStr,
      commits: dayCounts.get(dateStr) || 0,
    });
    current.setDate(current.getDate() + 1);
    safety++;
  }

  // Fallback: if no days generated, return from commit data directly
  if (days.length === 0) {
    const sortedDates = [...dayCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sortedDates.map(([date, count]) => ({ date, commits: count }));
  }

  return days;
}

/**
 * Render a simple ASCII bar chart of daily activity.
 * Each day gets a row with a bar proportional to its commit count.
 */
export function renderTimelineChart(days: DayActivity[], maxBarWidth: number = 40): string {
  if (days.length === 0) return '  (no activity)';

  const maxCommits = Math.max(...days.map(d => d.commits));
  if (maxCommits === 0) return '  (no activity)';

  // Filter to only days with activity to keep the chart readable
  const activeDays = days.filter(d => d.commits > 0);

  const lines: string[] = [];
  for (const day of activeDays) {
    const barLen = Math.max(1, Math.round((day.commits / maxCommits) * maxBarWidth));
    const bar = '█'.repeat(barLen);
    // Format: YYYY-MM-DD  ████████ (5)
    lines.push(`  ${day.date}  ${bar} (${day.commits})`);
  }

  return lines.join('\n');
}

/**
 * Parse a date string into a Date object.
 * Handles ISO dates, relative dates are expected to already be resolved by git.
 */
function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return new Date();
  }
  return d;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
