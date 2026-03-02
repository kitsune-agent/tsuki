# tsuki (月)

**Generate narrative work reports from git history.**

[![AI-Free](https://img.shields.io/badge/AI-free-brightgreen)](https://github.com/kitsune-agent)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Not a changelog — a **work report**. Think "what did the team do this week?" answered instantly from git data.

**Zero AI. Deterministic. Instant. No API keys.**

Part of the [kitsune-agent](https://github.com/kitsune-agent) AI-free developer tools collection.

## Install

```bash
npx @kitsune-agent/tsuki          # run without installing
npm install -g @kitsune-agent/tsuki  # or install globally
```

Requires Node.js 18+ and git.

## Quick Start

```bash
tsuki                    # today's activity
tsuki --week             # this week
tsuki --month            # this month
tsuki --since yesterday  # yesterday's work
```

## Example Output

```markdown
# Work Report: my-project

**Date range:** 2026-02-24 to 2026-03-02
**Branch:** main
**Commits:** 23 | **Files changed:** 41 | **Lines:** +1,204 / -387

## Activity Summary

### Features
- Add user authentication (a1b2c3d)
- Add dashboard component (d4e5f6a)
- Add API rate limiting (b7c8d9e)

> 12 files changed, +845 / -120

### Fixes
- Resolve login timeout issue (f0a1b2c)
- Fix payment processing bug (c3d4e5f)

> 5 files changed, +67 / -43

## Contributors

- **Alice** — 14 commits, +890 / -245
- **Bob** — 9 commits, +314 / -142

## Hotspots

**Most-changed files:**
- `src/auth.ts` — 8 changes, +234 / -89
- `src/api.ts` — 5 changes, +156 / -34

**Most-active directories:**
- `src/` — 35 changes
- `test/` — 12 changes

## Timeline

​```
  2026-02-24  ████████████████████ (5)
  2026-02-25  ████████████ (3)
  2026-02-26  ████████████████████████████████████████ (10)
  2026-02-27  ████████ (2)
  2026-02-28  ████████████ (3)
​```
```

## Usage

### Time Range

```bash
tsuki                                           # today
tsuki --since yesterday                         # yesterday
tsuki --since '3 days ago' --until today        # last 3 days
tsuki --since 2026-02-01 --until 2026-02-28    # specific range
tsuki --week                                    # this week (Monday–now)
tsuki --month                                   # this month
```

### Output Format

```bash
tsuki                    # markdown (default, to stdout)
tsuki --format md        # explicit markdown
tsuki --format json      # structured JSON for piping
tsuki --format text      # plain text (no markdown)
tsuki -o report.md       # write to file
```

### Templates

```bash
tsuki --template standup    # brief — just bullet points
tsuki --template weekly     # detailed — all sections (default)
tsuki --template client     # client-facing — features & fixes only, no paths
```

### Filtering

```bash
tsuki --author 'Alice'          # filter by author
tsuki --author 'Alice,Bob'      # multiple authors
tsuki --no-merges               # exclude merge commits
tsuki --branch main             # specific branch
tsuki --path src/               # only changes in a path
```

### Multi-Repo

```bash
tsuki --repos ~/projects/api,~/projects/frontend  # comma-separated
tsuki --repos-file repos.txt                       # one path per line
```

## All Options

| Option | Description | Default |
|--------|-------------|---------|
| `--since <date>` | Start date | Start of today |
| `--until <date>` | End date | Now |
| `--week` | This week shortcut | — |
| `--month` | This month shortcut | — |
| `--format <fmt>` | Output: `md`, `json`, `text` | `md` |
| `-o, --output <file>` | Write to file | stdout |
| `--template <name>` | `standup`, `weekly`, `client` | `weekly` |
| `--author <names>` | Filter by author (comma-sep) | All |
| `--no-merges` | Exclude merge commits | false |
| `--branch <name>` | Specific branch | Current |
| `--path <path>` | Filter by file path | All |
| `--repos <paths>` | Multiple repo paths (comma-sep) | cwd |
| `--repos-file <file>` | Repo paths from file | — |
| `-h, --help` | Show help | — |
| `-v, --version` | Show version | — |

## Philosophy

tsuki is part of the **kitsune-agent** collection of AI-free developer tools. We believe:

- **Deterministic beats probabilistic** for developer tooling. The same input should always produce the same output.
- **Zero dependencies** means zero supply chain risk, zero version conflicts, zero node_modules bloat.
- **No API keys** means it works offline, in CI, behind firewalls, instantly.
- **Git already knows** what happened. We just need to read it clearly.

Your commit history is a narrative. tsuki tells that story.

## License

MIT
