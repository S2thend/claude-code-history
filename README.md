# Claude Code History

A CLI tool and TypeScript library for browsing, searching, exporting, and managing your Claude Code conversation history.

## Features

- **List Sessions** - View all your Claude Code sessions with summaries, timestamps, and message counts
- **View Conversations** - Read full session content with formatted messages and tool calls
- **Search** - Find specific content across all sessions or within a single session
- **Export** - Save sessions to JSON or Markdown format
- **Migrate** - Copy or move sessions between workspaces with automatic path rewriting

## Installation

```bash
# Install globally
npm install -g claude-code-history

# Or use npx
npx claude-code-history list
```

## Requirements

- Node.js 20 or higher
- Claude Code installed and used at least once (creates `~/.claude/projects/`)

## CLI Usage

### List Sessions

View all your Claude Code sessions:

```bash
# List all sessions (most recent first)
cch list

# Filter by workspace
cch list --workspace /path/to/project

# Paginate results
cch list --limit 10 --offset 20

# Output as JSON
cch list --json
```

**Output:**
```
┌───────┬─────────────────────┬─────────────────────────────────┬─────────────────────────────────────────────┬──────────┐
│ Index │ Timestamp           │ Project                         │ Summary                                     │ Messages │
├───────┼─────────────────────┼─────────────────────────────────┼─────────────────────────────────────────────┼──────────┤
│ 0     │ 2024-12-31 15:30:22 │ /Users/dev/my-project           │ Implement user authentication               │ 45       │
│ 1     │ 2024-12-31 14:15:10 │ /Users/dev/my-project           │ Fix database connection issue               │ 23       │
│ 2     │ 2024-12-30 09:45:33 │ /Users/dev/other-project        │ Add unit tests for API endpoints            │ 67       │
└───────┴─────────────────────┴─────────────────────────────────┴─────────────────────────────────────────────┴──────────┘
```

### View Session

Read the full content of a session:

```bash
# View by index (0 = most recent)
cch view 0

# View by UUID
cch view abc123-def456-...

# Output as JSON
cch view 0 --json
```

**Output:**
```
# Session: Implement user authentication

| Property   | Value                                    |
|------------|------------------------------------------|
| Session ID | abc123-def456-...                        |
| Project    | /Users/dev/my-project                    |
| Messages   | 45                                       |
| Created    | 2024-12-31T15:30:22Z                     |

---

## User
2024-12-31 15:30:22

Help me implement user authentication with JWT tokens.

---

## Assistant
2024-12-31 15:30:45

I'll help you implement JWT authentication. Let me start by...

### Tool: Read
**Input:**
- file_path: `/Users/dev/my-project/src/auth/index.ts`

→ Result:
```typescript
export function authenticate() { ... }
```
```

### Search Sessions

Find content across all sessions:

```bash
# Search all sessions
cch search "authentication"

# Search with context lines
cch search "error" --context 3

# Search within a specific session
cch search "bug fix" --session 0

# Limit results
cch search "TODO" --limit 20

# Output as JSON
cch search "query" --json
```

**Output:**
```
Found 3 matches in 2 sessions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Session: abc123... | /Users/dev/my-project | 2024-12-31 15:30:22

  [user] Help me implement user authentication with JWT tokens.
                              ^^^^^^^^^^^^^^

  [assistant] I'll help you implement JWT authentication. Let me...
                                      ^^^^^^^^^^^^^^
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Export Sessions

Save sessions to a file:

```bash
# Export to JSON (stdout)
cch export 0

# Export to Markdown
cch export 0 --format markdown

# Export to file
cch export 0 --output session.json
cch export 0 --format markdown --output session.md

# Export all sessions
cch export --all --output all-sessions.json
cch export --all --format markdown --output all-sessions.md
```

### Migrate Sessions

Copy or move sessions between workspaces:

```bash
# Copy session to new workspace
cch migrate 0 --destination /new/project/path

# Move session (removes from source)
cch migrate 0 --destination /new/project/path --mode move

# Migrate multiple sessions
cch migrate 0,1,2 --destination /new/project/path

# Migrate all sessions from a workspace
cch migrate --all --source /old/project --destination /new/project
```

Migration automatically rewrites all absolute paths in the session (tool call inputs, cwd, file snapshots) to point to the new workspace location.

### Global Options

```bash
# Use custom Claude Code data directory
cch --data-path /custom/path list

# Output as JSON (for scripting)
cch --json list

# Disable pagination (full output)
cch --full view 0

# Short forms
cch -d /custom/path list
cch -j list
cch -f view 0
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CCH_DATA_PATH` | Custom Claude Code data directory (overridden by `--data-path`) |
| `PAGER` | Custom pager command (default: `less` on Unix, `more` on Windows) |
| `NO_COLOR` | Disable colored output |

## Library Usage

Use as a TypeScript/JavaScript library:

```typescript
import {
  listSessions,
  getSession,
  searchSessions,
  exportSession,
  migrateSession,
} from 'claude-code-history';

// List all sessions
const { data: sessions, pagination } = await listSessions({
  limit: 10,
  offset: 0,
  workspace: '/path/to/project', // optional filter
});

console.log(sessions);
// [
//   {
//     id: 'abc123-...',
//     projectPath: '/Users/dev/project',
//     summary: 'Implement feature X',
//     messageCount: 45,
//     lastActivity: '2024-12-31T15:30:22Z',
//     ...
//   },
//   ...
// ]

// Get full session content
const session = await getSession(0); // by index
const session = await getSession('abc123-...'); // by UUID

console.log(session.messages);
// [
//   { type: 'user', content: 'Help me...', timestamp: '...' },
//   { type: 'assistant', content: [...], timestamp: '...' },
//   ...
// ]

// Search across sessions
const matches = await searchSessions('authentication', {
  limit: 20,
  contextLines: 2,
});

// Search within a session
const matches = await searchInSession(0, 'error');

// Export to JSON or Markdown
const json = await exportSession(0, 'json');
const markdown = await exportSession(0, 'markdown');

// Export all sessions
const allJson = await exportAllSessions('json');

// Migrate sessions
const result = await migrateSession({
  sessions: [0, 1], // indices or UUIDs
  destination: '/new/workspace',
  mode: 'copy', // or 'move'
});

console.log(result);
// { successCount: 2, failedCount: 0, errors: [] }
```

### Custom Data Path

```typescript
import { listSessions } from 'claude-code-history';

const sessions = await listSessions({
  dataPath: '/custom/claude/data/path',
});
```

### Type Definitions

The library exports full TypeScript types:

```typescript
import type {
  Session,
  SessionSummary,
  Message,
  UserMessage,
  AssistantMessage,
  SearchMatch,
  MigrateResult,
  LibraryConfig,
  Pagination,
  PaginatedResult,
} from 'claude-code-history';
```

## Project Structure

```
claude-code-history/
├── src/
│   ├── cli/                    # CLI implementation
│   │   ├── commands/           # Command handlers (list, view, search, export, migrate)
│   │   ├── formatters/         # Output formatters (table, session, search)
│   │   └── utils/              # CLI utilities (config, errors, output)
│   └── lib/                    # Core library
│       ├── index.ts            # Public API exports
│       ├── session.ts          # Session listing and retrieval
│       ├── search.ts           # Search functionality
│       ├── export.ts           # Export to JSON/Markdown
│       ├── migrate.ts          # Session migration
│       └── types.ts            # TypeScript type definitions
├── tests/
│   ├── integration/            # Integration tests
│   │   └── cli/                # CLI integration tests
│   └── unit/                   # Unit tests
└── dist/                       # Compiled output
```

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-code-history.git
cd claude-code-history

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Lint
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## How It Works

Claude Code stores conversation history in `~/.claude/projects/` as JSONL files. Each project directory contains session files named by UUID:

```
~/.claude/projects/
├── -Users-dev-my-project/
│   ├── abc123-def456-....jsonl
│   └── def456-ghi789-....jsonl
└── -Users-dev-other-project/
    └── xyz789-...jsonl
```

Each session file contains JSON entries for:
- **Summary entries** - Session title/summary
- **User messages** - User inputs
- **Assistant messages** - Claude's responses with tool calls
- **File snapshots** - Backup snapshots of modified files

This tool reads these files to provide browsing, search, and export capabilities.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
