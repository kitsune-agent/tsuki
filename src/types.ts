/**
 * tsuki (月) — Core type definitions
 *
 * All interfaces for git data, report structure, and CLI options.
 */

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string; // ISO 8601
  subject: string;
  body: string;
  files: FileChange[];
}

export interface FileChange {
  additions: number;
  deletions: number;
  path: string;
}

export interface CommitCategory {
  name: string;
  commits: GitCommit[];
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface AuthorSummary {
  name: string;
  email: string;
  commits: number;
  insertions: number;
  deletions: number;
}

export interface FileHotspot {
  path: string;
  changeCount: number;
  insertions: number;
  deletions: number;
}

export interface DirectoryHotspot {
  path: string;
  changeCount: number;
}

export interface DayActivity {
  date: string; // YYYY-MM-DD
  commits: number;
}

export interface RepoReport {
  repoName: string;
  branch: string;
  dateRange: { since: string; until: string };
  totalCommits: number;
  totalFilesChanged: number;
  totalInsertions: number;
  totalDeletions: number;
  categories: CommitCategory[];
  authors: AuthorSummary[];
  fileHotspots: FileHotspot[];
  directoryHotspots: DirectoryHotspot[];
  timeline: DayActivity[];
}

export interface Report {
  generatedAt: string;
  repos: RepoReport[];
}

export type OutputFormat = 'md' | 'json' | 'text';
export type Template = 'standup' | 'weekly' | 'client';

export interface CliOptions {
  since: string;
  until: string;
  format: OutputFormat;
  output: string | null;
  repos: string[];
  reposFile: string | null;
  authors: string[];
  noMerges: boolean;
  branch: string | null;
  path: string | null;
  template: Template;
  help: boolean;
  version: boolean;
}
