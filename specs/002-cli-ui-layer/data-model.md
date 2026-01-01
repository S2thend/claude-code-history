# Data Model: CLI UI Layer

**Feature**: 002-cli-ui-layer
**Date**: 2025-12-31
**Purpose**: Define CLI-specific data structures and their relationships to library types

## Overview

The CLI layer does not introduce new persistent data models. It consumes existing library types and introduces CLI-specific structures for command handling, output formatting, and configuration.

## Library Types (Consumed - Not Modified)

The CLI layer imports these types from `src/lib/`:

```typescript
// From src/lib/types.ts (via src/lib/index.ts)
import type {
  LibraryConfig,
  SessionSummary,
  Session,
  Message,
  SearchMatch,
  PaginatedResult,
  MigrateConfig,
  MigrateResult,
  ExportFormat,
} from '../lib/index.js';
```

## CLI-Specific Types

### Configuration

```typescript
// src/cli/utils/config.ts

/**
 * Global CLI options available to all commands
 */
interface GlobalOptions {
  /** Custom Claude Code data directory */
  dataPath?: string;
  /** Output in JSON format instead of human-readable */
  json: boolean;
  /** Bypass pagination, output full content */
  full: boolean;
}

/**
 * Resolved configuration combining global options, env vars, and defaults
 */
interface ResolvedCliConfig {
  dataPath: string;
  outputFormat: 'human' | 'json';
  paginate: boolean;
}

/**
 * Environment variable names
 */
const ENV_VARS = {
  DATA_PATH: 'CCH_DATA_PATH',
  NO_COLOR: 'NO_COLOR',
  PAGER: 'PAGER',
} as const;
```

### Command Results

```typescript
// src/cli/utils/output.ts

/**
 * Standardized command result for JSON output
 */
interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: CommandError;
  pagination?: PaginationInfo;
}

interface CommandError {
  code: ErrorCode;
  message: string;
  details?: string;
}

type ErrorCode =
  | 'USAGE_ERROR'      // Invalid arguments
  | 'NOT_FOUND'        // Session/workspace not found
  | 'IO_ERROR'         // File system error
  | 'INTERNAL_ERROR';  // Unexpected error

interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}
```

### Exit Codes

```typescript
// src/cli/utils/errors.ts

/**
 * CLI exit codes following Unix conventions
 */
enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  USAGE_ERROR = 2,
  NOT_FOUND = 3,
  IO_ERROR = 4,
}
```

### List Command Types

```typescript
// src/cli/commands/list.ts

interface ListOptions extends GlobalOptions {
  workspace?: string;
  limit: number;
  offset: number;
}

/**
 * Formatted session row for table display
 */
interface SessionRow {
  index: number;
  timestamp: string;      // Formatted date
  projectPath: string;    // Truncated path
  summary: string;        // Summary or first message (truncated)
  messageCount: number;
}
```

### View Command Types

```typescript
// src/cli/commands/view.ts

interface ViewOptions extends GlobalOptions {
  // Session identifier passed as argument, not option
}

/**
 * Formatted message for display
 */
interface FormattedMessage {
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  content: string;         // Formatted content (tool calls expanded)
  model?: string;          // For assistant messages
  tokenUsage?: string;     // Formatted token count
}
```

### Search Command Types

```typescript
// src/cli/commands/search.ts

interface SearchOptions extends GlobalOptions {
  session?: string | number;  // Optional: search within specific session
  context: number;            // Lines of context around match
  limit: number;
  offset: number;
}

/**
 * Formatted search result for display
 */
interface FormattedSearchResult {
  sessionIndex: number;
  sessionSummary: string;
  projectPath: string;
  match: string;              // Highlighted match
  context: string[];          // Context lines
  lineNumber: number;
}
```

### Export Command Types

```typescript
// src/cli/commands/export.ts

interface ExportOptions extends GlobalOptions {
  format: 'json' | 'markdown';
  output?: string;            // Output file path (stdout if omitted)
  all: boolean;               // Export all sessions
}
```

### Migrate Command Types

```typescript
// src/cli/commands/migrate.ts

interface MigrateOptions extends GlobalOptions {
  destination: string;        // Target workspace path
  mode: 'copy' | 'move';
  // Sessions passed as arguments
}

/**
 * Migration result for display
 */
interface FormattedMigrateResult {
  successCount: number;
  failedCount: number;
  errors: Array<{
    sessionId: string;
    error: string;
  }>;
}
```

## Type Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  User Input                                                      │
│  ──────────                                                      │
│  $ cch list --workspace /project --limit 10 --json               │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Commander.js    │  Parses args into ListOptions              │
│  │ (index.ts)      │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌──────────────────┐                   │
│  │ list.ts         │────▶│ resolveConfig()  │                   │
│  │ command handler │     │ GlobalOptions →  │                   │
│  └────────┬────────┘     │ LibraryConfig    │                   │
│           │              └──────────────────┘                   │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Library Layer                             │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                                             │
│  │ listSessions()  │  Returns PaginatedResult<SessionSummary>    │
│  │ (session.ts)    │                                             │
│  └────────┬────────┘                                             │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                         CLI Layer (Output)                        │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                                             │
│  │ formatters/     │  SessionSummary[] → SessionRow[] → string   │
│  │ table.ts        │  or                                         │
│  │                 │  SessionSummary[] → CommandResult<> → JSON  │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │ pager.ts        │  Outputs via system pager or direct stdout  │
│  └─────────────────┘                                             │
│                                                                  │
└───────────────────────────────────────────────────────────────────┘
```

## Validation Rules

### Session Reference Validation

```typescript
/**
 * Parse session identifier from user input
 * Accepts: numeric index (0, 1, 2...) or UUID string (partial or full)
 */
function parseSessionRef(input: string): number | string {
  const numericIndex = parseInt(input, 10);
  if (!isNaN(numericIndex) && numericIndex >= 0) {
    return numericIndex;
  }
  // Treat as UUID (lib layer validates)
  return input;
}
```

### Path Validation

```typescript
/**
 * Validate data path exists and is a directory
 */
async function validateDataPath(path: string): Promise<void> {
  const stat = await fs.stat(path);
  if (!stat.isDirectory()) {
    throw new UsageError(`Not a directory: ${path}`);
  }
}
```

### Output Path Validation (Export)

```typescript
/**
 * Validate output path is writable
 */
async function validateOutputPath(path: string): Promise<void> {
  const dir = dirname(path);
  await fs.access(dir, fs.constants.W_OK);
}
```

## State Transitions

The CLI is stateless - each command is a single request/response cycle. No persistent state between invocations.

```
[Start] → [Parse Args] → [Validate] → [Execute] → [Format] → [Output] → [Exit]
                ↓              ↓           ↓
           ExitCode=2    ExitCode=2   ExitCode=1/3/4
           (usage err)   (validation) (runtime err)
```
