/**
 * tsuki (月) — Commit classifier
 *
 * Classifies commits by conventional commit type or heuristic analysis.
 * No AI, no ML — just pattern matching.
 */

import { GitCommit, CommitCategory } from './types.js';

/** Conventional commit type labels */
const CONVENTIONAL_LABELS: Record<string, string> = {
  feat: 'Features',
  fix: 'Fixes',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Testing',
  chore: 'Chores',
  style: 'Style',
  perf: 'Performance',
  ci: 'CI/CD',
  build: 'Build',
};

/** Heuristic patterns for non-conventional commits, checked in order */
const HEURISTIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(add|new|implement|create|introduce|feature)\b/i, label: 'Features' },
  { pattern: /\b(fix|bug|patch|resolve|repair|correct)\b/i, label: 'Fixes' },
  { pattern: /\b(refactor|clean|restructure|reorganize|simplify)\b/i, label: 'Refactoring' },
  { pattern: /\b(doc|readme|comment|jsdoc|typedoc)\b/i, label: 'Documentation' },
  { pattern: /\b(test|spec|coverage|assert)\b/i, label: 'Testing' },
];

/**
 * Classify a single commit subject. Returns a category label.
 */
function classifyCommit(subject: string): string {
  // Try conventional commit format: type(scope): description  or  type: description
  const conventional = subject.match(/^(\w+)(?:\(.+?\))?!?:\s/);
  if (conventional) {
    const type = conventional[1].toLowerCase();
    if (CONVENTIONAL_LABELS[type]) {
      return CONVENTIONAL_LABELS[type];
    }
  }

  // Fall back to heuristic classification
  for (const { pattern, label } of HEURISTIC_PATTERNS) {
    if (pattern.test(subject)) {
      return label;
    }
  }

  return 'Other Changes';
}

/**
 * Group commits into categories. Returns categories sorted by a stable order
 * (conventional types first, then heuristic, then "Other Changes").
 */
export function categorizeCommits(commits: GitCommit[]): CommitCategory[] {
  const groups = new Map<string, GitCommit[]>();

  for (const commit of commits) {
    const label = classifyCommit(commit.subject);
    const existing = groups.get(label);
    if (existing) {
      existing.push(commit);
    } else {
      groups.set(label, [commit]);
    }
  }

  // Stable sort order: known labels first, then "Other Changes" last
  const ORDER = [
    'Features', 'Fixes', 'Refactoring', 'Performance',
    'Documentation', 'Testing', 'Style', 'Chores',
    'CI/CD', 'Build', 'Other Changes',
  ];

  const categories: CommitCategory[] = [];

  for (const label of ORDER) {
    const groupCommits = groups.get(label);
    if (!groupCommits || groupCommits.length === 0) continue;

    const allFiles = new Set<string>();
    let insertions = 0;
    let deletions = 0;

    for (const commit of groupCommits) {
      for (const file of commit.files) {
        allFiles.add(file.path);
        insertions += file.additions;
        deletions += file.deletions;
      }
    }

    categories.push({
      name: label,
      commits: groupCommits,
      filesChanged: allFiles.size,
      insertions,
      deletions,
    });
  }

  // Include any labels not in ORDER (shouldn't happen, but defensive)
  for (const [label, groupCommits] of groups) {
    if (ORDER.includes(label)) continue;

    const allFiles = new Set<string>();
    let insertions = 0;
    let deletions = 0;

    for (const commit of groupCommits) {
      for (const file of commit.files) {
        allFiles.add(file.path);
        insertions += file.additions;
        deletions += file.deletions;
      }
    }

    categories.push({
      name: label,
      commits: groupCommits,
      filesChanged: allFiles.size,
      insertions,
      deletions,
    });
  }

  return categories;
}
