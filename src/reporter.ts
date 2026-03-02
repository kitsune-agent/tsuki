/**
 * tsuki (月) — Report generation
 *
 * Transforms raw git data into a structured RepoReport.
 */

import { GitCommit, RepoReport, AuthorSummary, FileHotspot, DirectoryHotspot } from './types.js';
import { categorizeCommits } from './classifier.js';
import { buildTimeline } from './timeline.js';
import { getRepoName, getCurrentBranch, getCommits, isGitRepo } from './git.js';

/**
 * Generate a report for a single repository.
 */
export function generateRepoReport(options: {
  cwd: string;
  since: string;
  until: string;
  authors: string[];
  noMerges: boolean;
  branch: string | null;
  path: string | null;
}): RepoReport {
  const { cwd, since, until } = options;

  if (!isGitRepo(cwd)) {
    throw new Error(`Not a git repository: ${cwd}`);
  }

  const repoName = getRepoName(cwd);
  const branch = options.branch || getCurrentBranch(cwd);

  const commits = getCommits(options);
  const categories = categorizeCommits(commits);
  const authors = buildAuthorSummary(commits);
  const { fileHotspots, directoryHotspots } = buildHotspots(commits);
  const timeline = buildTimeline(commits, since, until);

  // Aggregate totals
  const allFiles = new Set<string>();
  let totalInsertions = 0;
  let totalDeletions = 0;
  for (const commit of commits) {
    for (const file of commit.files) {
      allFiles.add(file.path);
      totalInsertions += file.additions;
      totalDeletions += file.deletions;
    }
  }

  return {
    repoName,
    branch,
    dateRange: { since, until },
    totalCommits: commits.length,
    totalFilesChanged: allFiles.size,
    totalInsertions,
    totalDeletions,
    categories,
    authors,
    fileHotspots,
    directoryHotspots,
    timeline,
  };
}

/**
 * Build author summary from commits.
 */
function buildAuthorSummary(commits: GitCommit[]): AuthorSummary[] {
  const map = new Map<string, AuthorSummary>();

  for (const commit of commits) {
    const key = commit.email;
    const existing = map.get(key);
    const ins = commit.files.reduce((sum, f) => sum + f.additions, 0);
    const del = commit.files.reduce((sum, f) => sum + f.deletions, 0);

    if (existing) {
      existing.commits++;
      existing.insertions += ins;
      existing.deletions += del;
    } else {
      map.set(key, {
        name: commit.author,
        email: commit.email,
        commits: 1,
        insertions: ins,
        deletions: del,
      });
    }
  }

  // Sort by commits descending
  return [...map.values()].sort((a, b) => b.commits - a.commits);
}

/**
 * Build file and directory hotspots.
 */
function buildHotspots(commits: GitCommit[]): {
  fileHotspots: FileHotspot[];
  directoryHotspots: DirectoryHotspot[];
} {
  const fileMap = new Map<string, { count: number; ins: number; del: number }>();
  const dirMap = new Map<string, number>();

  for (const commit of commits) {
    for (const file of commit.files) {
      // File hotspots
      const existing = fileMap.get(file.path);
      if (existing) {
        existing.count++;
        existing.ins += file.additions;
        existing.del += file.deletions;
      } else {
        fileMap.set(file.path, { count: 1, ins: file.additions, del: file.deletions });
      }

      // Directory hotspots — use top-level directory
      const dir = file.path.includes('/') ? file.path.split('/')[0] : '.';
      dirMap.set(dir, (dirMap.get(dir) || 0) + 1);
    }
  }

  const fileHotspots: FileHotspot[] = [...fileMap.entries()]
    .map(([path, data]) => ({
      path,
      changeCount: data.count,
      insertions: data.ins,
      deletions: data.del,
    }))
    .sort((a, b) => b.changeCount - a.changeCount)
    .slice(0, 10);

  const directoryHotspots: DirectoryHotspot[] = [...dirMap.entries()]
    .map(([path, count]) => ({ path, changeCount: count }))
    .sort((a, b) => b.changeCount - a.changeCount)
    .slice(0, 10);

  return { fileHotspots, directoryHotspots };
}
