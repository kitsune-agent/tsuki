/**
 * tsuki (月) — Git data collection
 *
 * Executes git commands and parses output into structured data.
 * Uses child_process.execSync — no dependencies.
 */

import { execSync } from 'node:child_process';
import { GitCommit, FileChange } from './types.js';

const FIELD_SEP = '§'; // unlikely to appear in commit messages

/**
 * Run a git command in the given directory, returning stdout as a string.
 * Returns empty string on failure (e.g. not a git repo).
 */
function git(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50 MB — large repos can have big logs
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Get the repository name from the git remote or fallback to directory name.
 */
export function getRepoName(cwd: string): string {
  const remote = git('remote get-url origin', cwd);
  if (remote) {
    // Extract repo name from URLs like:
    // https://github.com/org/repo.git  or  git@github.com:org/repo.git
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/) || remote.match(/:([^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  }
  // Fallback: directory name
  const parts = cwd.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || 'unknown';
}

/**
 * Get the current branch name.
 */
export function getCurrentBranch(cwd: string): string {
  return git('rev-parse --abbrev-ref HEAD', cwd) || 'unknown';
}

/**
 * Check if a directory is inside a git repository.
 */
export function isGitRepo(cwd: string): boolean {
  return git('rev-parse --is-inside-work-tree', cwd) === 'true';
}

/**
 * Collect commits for a date range with optional filters.
 */
export function getCommits(options: {
  cwd: string;
  since: string;
  until: string;
  authors: string[];
  noMerges: boolean;
  branch: string | null;
  path: string | null;
}): GitCommit[] {
  const { cwd, since, until, authors, noMerges, branch, path } = options;

  // Use %x00 (null byte) as record separator.
  // Each commit's output starts with \0, followed by fields, then numstat on subsequent lines.
  // This keeps numstat grouped with its commit.
  const format = [
    '%H',  // hash
    '%an', // author name
    '%ae', // author email
    '%aI', // author date ISO
    '%s',  // subject
    '%b',  // body
  ].join(FIELD_SEP);

  let cmd = `log --format="%x00${format}" --numstat`;
  cmd += ` --since="${since}" --until="${until}"`;

  if (noMerges) cmd += ' --no-merges';

  for (const author of authors) {
    cmd += ` --author="${author}"`;
  }

  if (branch) {
    cmd += ` ${branch}`;
  }

  if (path) {
    cmd += ` -- "${path}"`;
  }

  const raw = git(cmd, cwd);
  if (!raw) return [];

  return parseGitLog(raw);
}

/**
 * Parse the raw git log output into structured commits.
 *
 * Each commit block starts with \0 followed by the formatted fields on one line,
 * then numstat lines for that commit. Splitting on \0 gives us self-contained blocks.
 */
function parseGitLog(raw: string): GitCommit[] {
  const commits: GitCommit[] = [];
  // Split on null byte — each part is one commit's data (fields + numstat)
  const records = raw.split('\0');

  for (const record of records) {
    const trimmed = record.trim();
    if (!trimmed) continue;

    // First line: the formatted fields. Remaining lines: numstat data.
    const lines = trimmed.split('\n');
    const fieldLine = lines[0];
    const fields = fieldLine.split(FIELD_SEP);

    if (fields.length < 5) continue; // malformed record

    const files: FileChange[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const numstatMatch = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (numstatMatch) {
        files.push({
          additions: numstatMatch[1] === '-' ? 0 : parseInt(numstatMatch[1], 10),
          deletions: numstatMatch[2] === '-' ? 0 : parseInt(numstatMatch[2], 10),
          path: numstatMatch[3],
        });
      }
    }

    commits.push({
      hash: fields[0],
      author: fields[1],
      email: fields[2],
      date: fields[3],
      subject: fields[4],
      body: fields.slice(5).join(FIELD_SEP).trim(),
      files,
    });
  }

  return commits;
}
