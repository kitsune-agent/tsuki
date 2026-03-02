/**
 * tsuki (月) — Output formatters
 *
 * Renders a Report into markdown, JSON, or plain text.
 * Supports templates: standup, weekly, client.
 */

import { Report, RepoReport, Template } from './types.js';
import { renderTimelineChart } from './timeline.js';

/**
 * Format a report as markdown.
 */
export function formatMarkdown(report: Report, template: Template): string {
  const parts: string[] = [];

  for (const repo of report.repos) {
    if (report.repos.length > 1) {
      parts.push(`---\n`);
    }
    parts.push(formatRepoMarkdown(repo, template));
  }

  return parts.join('\n');
}

function formatRepoMarkdown(repo: RepoReport, template: Template): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Work Report: ${repo.repoName}`);
  lines.push('');
  lines.push(`**Date range:** ${repo.dateRange.since} to ${repo.dateRange.until}`);
  lines.push(`**Branch:** ${repo.branch}`);
  lines.push(`**Commits:** ${repo.totalCommits} | **Files changed:** ${repo.totalFilesChanged} | **Lines:** +${repo.totalInsertions} / -${repo.totalDeletions}`);
  lines.push('');

  if (repo.totalCommits === 0) {
    lines.push('*No activity in this period.*');
    lines.push('');
    return lines.join('\n');
  }

  // Activity Summary
  lines.push(`## Activity Summary`);
  lines.push('');

  for (const cat of repo.categories) {
    // Client template: skip non-user-facing categories
    if (template === 'client' && !['Features', 'Fixes'].includes(cat.name)) {
      continue;
    }

    lines.push(`### ${cat.name}`);
    lines.push('');

    // Deduplicate commit messages
    const seen = new Set<string>();
    for (const commit of cat.commits) {
      const msg = cleanSubject(commit.subject);
      if (seen.has(msg.toLowerCase())) continue;
      seen.add(msg.toLowerCase());

      if (template === 'client') {
        // No technical details for client template
        lines.push(`- ${msg}`);
      } else {
        lines.push(`- ${msg} (${commit.hash.slice(0, 7)})`);
      }
    }
    lines.push('');

    if (template !== 'standup' && template !== 'client') {
      lines.push(`> ${cat.filesChanged} files changed, +${cat.insertions} / -${cat.deletions}`);
      lines.push('');
    }
  }

  // Standup is brief — stop here
  if (template === 'standup') {
    return lines.join('\n');
  }

  // Client template — stop after activity
  if (template === 'client') {
    return lines.join('\n');
  }

  // Contributor Summary (only if multiple authors)
  if (repo.authors.length > 1) {
    lines.push(`## Contributors`);
    lines.push('');
    for (const author of repo.authors) {
      lines.push(`- **${author.name}** — ${author.commits} commits, +${author.insertions} / -${author.deletions}`);
    }
    lines.push('');
  }

  // Hotspots
  if (repo.fileHotspots.length > 0) {
    lines.push(`## Hotspots`);
    lines.push('');
    lines.push('**Most-changed files:**');
    lines.push('');
    for (const file of repo.fileHotspots) {
      lines.push(`- \`${file.path}\` — ${file.changeCount} changes, +${file.insertions} / -${file.deletions}`);
    }
    lines.push('');

    if (repo.directoryHotspots.length > 0) {
      lines.push('**Most-active directories:**');
      lines.push('');
      for (const dir of repo.directoryHotspots) {
        lines.push(`- \`${dir.path}/\` — ${dir.changeCount} changes`);
      }
      lines.push('');
    }
  }

  // Timeline
  if (repo.timeline.length > 0) {
    lines.push(`## Timeline`);
    lines.push('');
    lines.push('```');
    lines.push(renderTimelineChart(repo.timeline));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Clean a commit subject line: strip conventional commit prefix scope.
 */
function cleanSubject(subject: string): string {
  // Remove conventional prefix like "feat(scope): " but keep the description
  return subject.replace(/^\w+(?:\(.+?\))?!?:\s*/, '');
}

/**
 * Format a report as JSON.
 */
export function formatJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format a report as plain text (no markdown formatting).
 */
export function formatText(report: Report, template: Template): string {
  const parts: string[] = [];

  for (const repo of report.repos) {
    parts.push(formatRepoText(repo, template));
    if (report.repos.length > 1) {
      parts.push('─'.repeat(60));
    }
  }

  return parts.join('\n');
}

function formatRepoText(repo: RepoReport, template: Template): string {
  const lines: string[] = [];

  lines.push(`WORK REPORT: ${repo.repoName.toUpperCase()}`);
  lines.push(`Date range: ${repo.dateRange.since} to ${repo.dateRange.until}`);
  lines.push(`Branch: ${repo.branch}`);
  lines.push(`Commits: ${repo.totalCommits} | Files changed: ${repo.totalFilesChanged} | Lines: +${repo.totalInsertions} / -${repo.totalDeletions}`);
  lines.push('');

  if (repo.totalCommits === 0) {
    lines.push('No activity in this period.');
    lines.push('');
    return lines.join('\n');
  }

  for (const cat of repo.categories) {
    if (template === 'client' && !['Features', 'Fixes'].includes(cat.name)) {
      continue;
    }

    lines.push(`[${cat.name}]`);

    const seen = new Set<string>();
    for (const commit of cat.commits) {
      const msg = cleanSubject(commit.subject);
      if (seen.has(msg.toLowerCase())) continue;
      seen.add(msg.toLowerCase());
      lines.push(`  - ${msg}`);
    }

    if (template !== 'standup' && template !== 'client') {
      lines.push(`  (${cat.filesChanged} files, +${cat.insertions} / -${cat.deletions})`);
    }
    lines.push('');
  }

  if (template === 'standup' || template === 'client') {
    return lines.join('\n');
  }

  if (repo.authors.length > 1) {
    lines.push('[Contributors]');
    for (const author of repo.authors) {
      lines.push(`  - ${author.name}: ${author.commits} commits, +${author.insertions} / -${author.deletions}`);
    }
    lines.push('');
  }

  if (repo.fileHotspots.length > 0) {
    lines.push('[Hotspots]');
    for (const file of repo.fileHotspots) {
      lines.push(`  - ${file.path} (${file.changeCount} changes, +${file.insertions} / -${file.deletions})`);
    }
    lines.push('');
  }

  if (repo.timeline.length > 0) {
    lines.push('[Timeline]');
    lines.push(renderTimelineChart(repo.timeline));
    lines.push('');
  }

  return lines.join('\n');
}
