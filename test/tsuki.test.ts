/**
 * tsuki (月) — Test suite
 *
 * Creates a temporary git repo with known commits, runs tsuki against it,
 * and validates the output structure.
 *
 * Uses Node's built-in test runner (node:test + node:assert).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

// Import our modules
import { getRepoName, getCurrentBranch, isGitRepo, getCommits } from '../src/git.js';
import { categorizeCommits } from '../src/classifier.js';
import { buildTimeline, renderTimelineChart } from '../src/timeline.js';
import { generateRepoReport } from '../src/reporter.js';
import { formatMarkdown, formatJson, formatText } from '../src/formatter.js';

let tmpDir: string;

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function createCommit(cwd: string, message: string, files: Record<string, string>, author?: string): void {
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(cwd, name);
    // Ensure parent directory exists
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  git('add -A', cwd);
  const authorFlag = author ? `--author="${author}"` : '';
  execSync(`git commit -m "${message}" ${authorFlag} --allow-empty`, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GIT_COMMITTER_DATE: new Date().toISOString() },
  });
}

/**
 * Set up a temporary git repo with a variety of commits for testing.
 */
function setupTestRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tsuki-test-'));
  git('init', dir);
  git('config user.email "test@tsuki.dev"', dir);
  git('config user.name "Test User"', dir);

  // Conventional commits
  createCommit(dir, 'feat: add user authentication', { 'src/auth.ts': 'export function auth() {}' });
  createCommit(dir, 'fix: resolve login timeout issue', { 'src/auth.ts': 'export function auth() { /* fixed */ }' });
  createCommit(dir, 'docs: update README with examples', { 'README.md': '# Project\n\nExamples here.' });
  createCommit(dir, 'refactor: simplify database queries', { 'src/db.ts': 'export function query() {}' });
  createCommit(dir, 'test: add auth unit tests', { 'test/auth.test.ts': 'assert(true)' });
  createCommit(dir, 'chore: update dependencies', { 'package.json': '{}' });

  // Non-conventional commits (heuristic classification)
  createCommit(dir, 'Add new dashboard component', { 'src/dashboard.ts': 'export function render() {}' });
  createCommit(dir, 'Fix bug in payment processing', { 'src/payments.ts': 'export function pay() {}' });

  // Multiple-author commit
  createCommit(dir, 'feat: add API rate limiting', { 'src/api.ts': 'export function rateLimit() {}' }, 'Alice <alice@tsuki.dev>');

  return dir;
}

// Top-level setup/teardown so all suites share the same test repo
before(() => {
  tmpDir = setupTestRepo();
});

after(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('git module', () => {
  it('detects a git repo', () => {
    assert.equal(isGitRepo(tmpDir), true);
  });

  it('detects a non-git directory', () => {
    const nonGit = mkdtempSync(join(tmpdir(), 'tsuki-nongit-'));
    assert.equal(isGitRepo(nonGit), false);
    rmSync(nonGit, { recursive: true, force: true });
  });

  it('gets current branch', () => {
    const branch = getCurrentBranch(tmpDir);
    // Should be main or master depending on git defaults
    assert.ok(branch === 'main' || branch === 'master', `Expected main or master, got ${branch}`);
  });

  it('collects commits', () => {
    const commits = getCommits({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
    assert.equal(commits.length, 9, 'Expected 9 commits');
  });

  it('filters commits by author', () => {
    const commits = getCommits({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: ['Alice'],
      noMerges: false,
      branch: null,
      path: null,
    });
    assert.equal(commits.length, 1);
    assert.equal(commits[0].author, 'Alice');
  });

  it('parses file changes', () => {
    const commits = getCommits({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
    // At least some commits should have file changes
    const withFiles = commits.filter(c => c.files.length > 0);
    assert.ok(withFiles.length > 0, 'Some commits should have file changes');

    // Check that file changes have valid data
    for (const commit of withFiles) {
      for (const file of commit.files) {
        assert.ok(file.path.length > 0, 'File path should not be empty');
        assert.ok(file.additions >= 0, 'Additions should be non-negative');
        assert.ok(file.deletions >= 0, 'Deletions should be non-negative');
      }
    }
  });

  it('handles path filter', () => {
    const commits = getCommits({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: 'src/',
    });
    assert.ok(commits.length > 0, 'Should find commits in src/');
    assert.ok(commits.length < 9, 'Should filter out non-src commits');
  });
});

describe('classifier', () => {
  it('classifies conventional commits', () => {
    const commits = getCommits({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
    const categories = categorizeCommits(commits);

    const names = categories.map(c => c.name);
    assert.ok(names.includes('Features'), 'Should have Features category');
    assert.ok(names.includes('Fixes'), 'Should have Fixes category');
    assert.ok(names.includes('Documentation'), 'Should have Documentation category');
    assert.ok(names.includes('Refactoring'), 'Should have Refactoring category');
    assert.ok(names.includes('Testing'), 'Should have Testing category');
  });

  it('has no empty categories', () => {
    const commits = getCommits({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
    const categories = categorizeCommits(commits);
    for (const cat of categories) {
      assert.ok(cat.commits.length > 0, `Category ${cat.name} should not be empty`);
    }
  });

  it('handles empty commit list', () => {
    const categories = categorizeCommits([]);
    assert.equal(categories.length, 0);
  });
});

describe('timeline', () => {
  it('builds a timeline from commits', () => {
    const commits = getCommits({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
    const today = new Date().toISOString().slice(0, 10);
    const timeline = buildTimeline(commits, today, today);
    assert.ok(timeline.length > 0, 'Timeline should have entries');
  });

  it('renders an ASCII chart', () => {
    const days = [
      { date: '2026-01-01', commits: 5 },
      { date: '2026-01-02', commits: 3 },
      { date: '2026-01-03', commits: 0 },
      { date: '2026-01-04', commits: 8 },
    ];
    const chart = renderTimelineChart(days);
    assert.ok(chart.includes('2026-01-01'), 'Chart should include dates');
    assert.ok(chart.includes('█'), 'Chart should include bar characters');
    assert.ok(!chart.includes('2026-01-03'), 'Zero-activity days should not appear');
  });

  it('handles no activity', () => {
    const chart = renderTimelineChart([]);
    assert.ok(chart.includes('no activity'));
  });
});

describe('reporter', () => {
  it('generates a complete repo report', () => {
    const report = generateRepoReport({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });

    assert.ok(report.repoName.length > 0);
    assert.equal(report.totalCommits, 9);
    assert.ok(report.totalFilesChanged > 0);
    assert.ok(report.totalInsertions > 0);
    assert.ok(report.categories.length > 0);
    assert.ok(report.fileHotspots.length > 0);
    assert.ok(report.timeline.length > 0);
  });

  it('handles multiple authors', () => {
    const report = generateRepoReport({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
    assert.ok(report.authors.length >= 2, 'Should have at least 2 authors');
    // Sorted by commits descending
    for (let i = 1; i < report.authors.length; i++) {
      assert.ok(report.authors[i - 1].commits >= report.authors[i].commits, 'Authors should be sorted by commits');
    }
  });

  it('detects non-git directory', () => {
    const nonGit = mkdtempSync(join(tmpdir(), 'tsuki-nongit2-'));
    assert.throws(() => {
      generateRepoReport({
        cwd: nonGit,
        since: '1970-01-01',
        until: 'now',
        authors: [],
        noMerges: false,
        branch: null,
        path: null,
      });
    }, /Not a git repository/);
    rmSync(nonGit, { recursive: true, force: true });
  });
});

describe('formatters', () => {
  let report: ReturnType<typeof generateRepoReport>;

  before(() => {
    report = generateRepoReport({
      cwd: tmpDir,
      since: '1970-01-01',
      until: 'now',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
  });

  it('formats markdown with weekly template', () => {
    const md = formatMarkdown({ generatedAt: new Date().toISOString(), repos: [report] }, 'weekly');
    assert.ok(md.includes('# Work Report:'), 'Should have report header');
    assert.ok(md.includes('## Activity Summary'), 'Should have activity summary');
    assert.ok(md.includes('## Hotspots'), 'Should have hotspots');
    assert.ok(md.includes('## Timeline'), 'Should have timeline');
  });

  it('formats markdown with standup template', () => {
    const md = formatMarkdown({ generatedAt: new Date().toISOString(), repos: [report] }, 'standup');
    assert.ok(md.includes('# Work Report:'));
    assert.ok(md.includes('## Activity Summary'));
    // Standup should NOT have hotspots or timeline
    assert.ok(!md.includes('## Hotspots'), 'Standup should not have hotspots');
    assert.ok(!md.includes('## Timeline'), 'Standup should not have timeline');
  });

  it('formats markdown with client template', () => {
    const md = formatMarkdown({ generatedAt: new Date().toISOString(), repos: [report] }, 'client');
    assert.ok(md.includes('# Work Report:'));
    // Client should only have Features and Fixes, no commit hashes
    assert.ok(!md.includes('### Refactoring'), 'Client should not show refactoring');
    assert.ok(!md.includes('### Chores'), 'Client should not show chores');
  });

  it('formats JSON', () => {
    const json = formatJson({ generatedAt: new Date().toISOString(), repos: [report] });
    const parsed = JSON.parse(json);
    assert.ok(parsed.generatedAt);
    assert.ok(Array.isArray(parsed.repos));
    assert.equal(parsed.repos[0].totalCommits, 9);
  });

  it('formats plain text', () => {
    const text = formatText({ generatedAt: new Date().toISOString(), repos: [report] }, 'weekly');
    assert.ok(text.includes('WORK REPORT:'), 'Should have report header');
    assert.ok(text.includes('[Features]') || text.includes('[Fixes]'), 'Should have categorized sections');
  });

  it('handles empty repo (no commits in range)', () => {
    const emptyReport = generateRepoReport({
      cwd: tmpDir,
      since: '2099-01-01',
      until: '2099-12-31',
      authors: [],
      noMerges: false,
      branch: null,
      path: null,
    });
    const md = formatMarkdown({ generatedAt: new Date().toISOString(), repos: [emptyReport] }, 'weekly');
    assert.ok(md.includes('No activity'), 'Should indicate no activity');
  });
});
