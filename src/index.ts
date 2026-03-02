#!/usr/bin/env node

/**
 * tsuki (月) — Generate narrative work reports from git history.
 *
 * Zero AI. Deterministic. Instant.
 * Part of the kitsune-agent collection.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CliOptions, OutputFormat, Template } from './types.js';
import { generateReport } from './multi-repo.js';
import { formatMarkdown, formatJson, formatText } from './formatter.js';

const VERSION = '1.0.0';

const HELP = `
tsuki (月) — Generate narrative work reports from git history.

Usage:
  tsuki [options]

Time Range:
  --since <date>         Start date (default: start of today)
  --until <date>         End date (default: now)
  --week                 This week (shortcut for --since 'last monday')
  --month                This month (shortcut for --since 'first day of this month')

Output:
  --format <fmt>         Output format: md, json, text (default: md)
  -o, --output <file>    Write to file instead of stdout
  --template <name>      Report template: standup, weekly, client (default: weekly)

Filtering:
  --author <names>       Filter by author (comma-separated)
  --no-merges            Exclude merge commits
  --branch <name>        Specific branch (default: current)
  --path <path>          Only changes in path

Multi-Repo:
  --repos <paths>        Comma-separated repo paths
  --repos-file <file>    File with one repo path per line

Other:
  -h, --help             Show this help
  -v, --version          Show version

Examples:
  tsuki                           Today's activity
  tsuki --since yesterday         Yesterday's work
  tsuki --week                    This week's report
  tsuki --month --format json     This month as JSON
  tsuki --author Alice,Bob        Filter by authors
  tsuki --template standup        Brief standup format
  tsuki --repos ~/api,~/web       Multi-repo report

Part of the kitsune-agent AI-free developer tools collection.
https://github.com/kitsune-agent/tsuki
`.trim();

/**
 * Parse CLI arguments into structured options.
 * Supports --flag=value and --flag value styles.
 */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    since: todayStart(),
    until: 'now',
    format: 'md',
    output: null,
    repos: [],
    reposFile: null,
    authors: [],
    noMerges: false,
    branch: null,
    path: null,
    template: 'weekly',
    help: false,
    version: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    // Handle --flag=value
    let key: string;
    let value: string | undefined;
    if (arg.includes('=')) {
      const eqIndex = arg.indexOf('=');
      key = arg.slice(0, eqIndex);
      value = arg.slice(eqIndex + 1);
    } else {
      key = arg;
      value = undefined;
    }

    const nextVal = (): string => {
      if (value !== undefined) return value;
      i++;
      if (i >= argv.length) {
        throw new Error(`Missing value for ${key}`);
      }
      return argv[i];
    };

    switch (key) {
      case '--since':
        options.since = nextVal();
        break;
      case '--until':
        options.until = nextVal();
        break;
      case '--week':
        // Monday of this week
        options.since = getMondayOfThisWeek();
        options.until = 'now';
        break;
      case '--month':
        options.since = getFirstOfThisMonth();
        options.until = 'now';
        break;
      case '--format':
        options.format = nextVal() as OutputFormat;
        if (!['md', 'json', 'text'].includes(options.format)) {
          throw new Error(`Unknown format: ${options.format}. Use md, json, or text.`);
        }
        break;
      case '-o':
      case '--output':
        options.output = nextVal();
        break;
      case '--template':
        options.template = nextVal() as Template;
        if (!['standup', 'weekly', 'client'].includes(options.template)) {
          throw new Error(`Unknown template: ${options.template}. Use standup, weekly, or client.`);
        }
        break;
      case '--author':
        options.authors = nextVal().split(',').map(a => a.trim()).filter(Boolean);
        break;
      case '--no-merges':
        options.noMerges = true;
        break;
      case '--branch':
        options.branch = nextVal();
        break;
      case '--path':
        options.path = nextVal();
        break;
      case '--repos':
        options.repos = nextVal().split(',').map(r => r.trim()).filter(Boolean);
        break;
      case '--repos-file':
        options.reposFile = nextVal();
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}. Use --help to see available options.`);
        }
        // Positional args are ignored
        break;
    }

    i++;
  }

  return options;
}

/**
 * Return today's date at midnight as YYYY-MM-DD.
 */
function todayStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00`;
}

/**
 * Return Monday of the current week as a date string.
 */
function getMondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00`;
}

/**
 * Return the first day of the current month.
 */
function getFirstOfThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01 00:00`;
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      console.log(HELP);
      process.exit(0);
    }

    if (options.version) {
      console.log(`tsuki ${VERSION}`);
      process.exit(0);
    }

    const report = generateReport(options);

    let output: string;
    switch (options.format) {
      case 'json':
        output = formatJson(report);
        break;
      case 'text':
        output = formatText(report, options.template);
        break;
      case 'md':
      default:
        output = formatMarkdown(report, options.template);
        break;
    }

    if (options.output) {
      writeFileSync(resolve(options.output), output, 'utf-8');
      console.error(`Report written to ${options.output}`);
    } else {
      console.log(output);
    }

    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`tsuki: ${message}`);
    process.exit(1);
  }
}

main();
