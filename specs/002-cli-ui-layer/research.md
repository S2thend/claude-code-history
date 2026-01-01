# Research: CLI UI Layer

**Feature**: 002-cli-ui-layer
**Date**: 2025-12-31
**Purpose**: Resolve technology choices and best practices for CLI implementation

## Research Topics

### 1. CLI Framework Selection

**Decision**: Commander.js

**Rationale**:
- Most popular Node.js CLI framework (40k+ GitHub stars)
- Excellent TypeScript support with `@types/commander`
- Built-in support for subcommands, options, and help generation
- Minimal footprint, well-maintained
- Follows Unix conventions naturally
- Used by major projects (npm, vue-cli, create-react-app)

**Alternatives Considered**:
| Framework | Pros | Cons | Rejected Because |
|-----------|------|------|------------------|
| yargs | Powerful, good TS support | Heavier, more complex API | Overkill for our needs |
| oclif | Enterprise-grade, plugin system | Heavy, Salesforce-owned, complex | Too much overhead for single CLI |
| clipanion | Modern, type-safe | Less ecosystem, fewer examples | Less mature, smaller community |
| meow | Minimal | Too minimal, no subcommands | Doesn't support our command structure |

### 2. Terminal Output Pagination

**Decision**: Use Node.js `child_process.spawn` with system pager (`less` on Unix, `more` on Windows) + `--full` flag for raw output

**Rationale**:
- Leverages existing system tools users are familiar with
- No additional dependencies
- Respects user's PAGER environment variable
- Fallback to raw output when stdout is not a TTY (piping)
- `--full` flag explicitly bypasses pagination for scripting

**Implementation Pattern**:
```typescript
function outputWithPager(content: string, full: boolean): void {
  if (full || !process.stdout.isTTY) {
    // Direct output for piping or --full flag
    process.stdout.write(content);
    return;
  }

  // Use system pager
  const pager = process.env.PAGER || (process.platform === 'win32' ? 'more' : 'less');
  const child = spawn(pager, [], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.write(content);
  child.stdin.end();
}
```

**Alternatives Considered**:
| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| Internal scrolling (blessed, ink) | Full control | Heavy dependencies, complex | Violates minimal deps principle |
| Just pipe to less manually | Zero code | Poor UX, user must know to pipe | Constitution requires good default UX |
| Truncate with prompt | Simple | Loses content, frustrating | Data fidelity concerns |

### 3. Table Formatting

**Decision**: Use native string formatting with fixed-width columns

**Rationale**:
- Zero dependencies
- Full control over output format
- Easily supports `--json` alternative output
- Works consistently across terminals
- Matches constitution's minimal dependencies principle

**Implementation Pattern**:
```typescript
function formatTable(sessions: SessionSummary[]): string {
  const header = 'IDX  TIMESTAMP            PROJECT                    SUMMARY';
  const separator = '───  ────────────────────  ─────────────────────────  ────────────────────';
  const rows = sessions.map((s, i) =>
    `${String(i).padStart(3)}  ${formatDate(s.timestamp)}  ${truncate(s.projectPath, 25)}  ${truncate(s.summary || getFirstMessage(s), 50)}`
  );
  return [header, separator, ...rows].join('\n');
}
```

**Alternatives Considered**:
| Library | Pros | Cons | Rejected Because |
|---------|------|------|------------------|
| cli-table3 | Easy, good defaults | Dependency, limited customization | Unnecessary dependency |
| columnify | Minimal | Still a dependency | Can do natively |
| chalk + manual | Colorful | chalk is optional, core shouldn't require it | Colors are enhancement only |

### 4. Color Support

**Decision**: Optional chalk dependency, graceful degradation to no colors

**Rationale**:
- Colors improve UX but aren't essential
- Chalk auto-detects color support and NO_COLOR env var
- Can be made optional (devDependency or peer)
- Fallback to plain text if not available

**Implementation Pattern**:
```typescript
// src/cli/utils/colors.ts
let chalk: typeof import('chalk') | null = null;
try {
  chalk = (await import('chalk')).default;
} catch {
  // chalk not available, use no-op
}

export const colors = {
  bold: (s: string) => chalk?.bold(s) ?? s,
  dim: (s: string) => chalk?.dim(s) ?? s,
  green: (s: string) => chalk?.green(s) ?? s,
  red: (s: string) => chalk?.red(s) ?? s,
  yellow: (s: string) => chalk?.yellow(s) ?? s,
};
```

### 5. Error Handling & Exit Codes

**Decision**: Structured exit codes following Unix conventions

**Exit Code Scheme**:
| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | Command completed successfully |
| 1 | General error | Unexpected runtime error |
| 2 | Usage error | Invalid arguments, missing required options |
| 3 | Data not found | Session not found, empty results |
| 4 | I/O error | Cannot write to file, permission denied |

**Rationale**:
- Follows Unix conventions (0=success, non-zero=error)
- Enables scripting with error detection
- Matches constitution requirement for meaningful exit codes

### 6. JSON Output Mode

**Decision**: `--json` global flag for machine-readable output

**Rationale**:
- Constitution requires JSON output for all commands
- Enables scripting and tool integration
- Outputs to stdout, errors to stderr (even in JSON mode)

**Implementation Pattern**:
```typescript
interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  pagination?: { total: number; offset: number; limit: number; hasMore: boolean };
}

function output<T>(result: CommandResult<T>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Human-readable formatting
  }
}
```

### 7. Environment Variable Support

**Decision**: `CCH_DATA_PATH` environment variable for custom data directory

**Rationale**:
- Allows persistent configuration without flags
- Follows 12-factor app principles
- Common pattern for CLI tools
- Overridden by explicit `--data-path` flag

**Priority Order**:
1. `--data-path` command-line option (highest)
2. `CCH_DATA_PATH` environment variable
3. Platform default (`~/.claude/projects/`) (lowest)

### 8. Binary/Entry Point Configuration

**Decision**: Add `bin` field to package.json pointing to compiled CLI entry

**Implementation**:
```json
{
  "bin": {
    "cch": "./dist/cli/index.js"
  }
}
```

**Rationale**:
- Standard npm convention for CLI tools
- Enables `npx cch` and global install via `npm install -g`
- Entry point must have shebang: `#!/usr/bin/env node`

## Summary

All research topics resolved. No NEEDS CLARIFICATION items remain. Ready to proceed to Phase 1 (Design & Contracts).

| Topic | Decision | Dependency Added |
|-------|----------|------------------|
| CLI Framework | Commander.js | Yes (commander) |
| Pagination | System pager (less/more) | No |
| Table Formatting | Native string formatting | No |
| Colors | Optional chalk | Optional (chalk) |
| Error Codes | Unix convention (0-4) | No |
| JSON Output | `--json` global flag | No |
| Environment | `CCH_DATA_PATH` | No |
| Entry Point | `bin` in package.json | No |

**New Dependencies**:
- `commander` (required) - CLI framework
- `chalk` (optional) - Terminal colors
