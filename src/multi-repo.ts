/**
 * tsuki (月) — Multi-repo orchestration
 *
 * Resolves repo paths and generates combined reports.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Report, CliOptions } from './types.js';
import { generateRepoReport } from './reporter.js';

/**
 * Resolve the list of repository paths from CLI options.
 */
export function resolveRepoPaths(options: CliOptions): string[] {
  // If --repos-file is specified, read paths from that file
  if (options.reposFile) {
    try {
      const content = readFileSync(resolve(options.reposFile), 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => resolve(line));
    } catch (err) {
      throw new Error(`Cannot read repos file: ${options.reposFile}`);
    }
  }

  // If --repos is specified, use those paths
  if (options.repos.length > 0) {
    return options.repos.map(r => resolve(r));
  }

  // Default: current directory
  return [process.cwd()];
}

/**
 * Generate a combined report across all repositories.
 */
export function generateReport(options: CliOptions): Report {
  const repoPaths = resolveRepoPaths(options);
  const repos = [];

  for (const cwd of repoPaths) {
    repos.push(
      generateRepoReport({
        cwd,
        since: options.since,
        until: options.until,
        authors: options.authors,
        noMerges: options.noMerges,
        branch: options.branch,
        path: options.path,
      })
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    repos,
  };
}
