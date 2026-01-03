# Quickstart: CLI UI Layer Implementation

**Feature**: 002-cli-ui-layer
**Date**: 2025-12-31
**Purpose**: Step-by-step guide to implement the CLI layer

## Prerequisites

- Node.js 20+ installed
- Existing `src/lib/` layer complete and tested
- Understanding of Commander.js basics

## Step 1: Install Dependencies

```bash
npm install commander
npm install --save-dev @types/commander  # If not included
```

Optional (for colors):
```bash
npm install chalk
```

## Step 2: Update package.json

Add the CLI binary entry point:

```json
{
  "bin": {
    "cch": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli/index.js"
  }
}
```

## Step 3: Create CLI Directory Structure

```bash
mkdir -p src/cli/commands src/cli/formatters src/cli/utils
```

## Step 4: Implement Entry Point

Create `src/cli/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerViewCommand } from './commands/view.js';
import { registerSearchCommand } from './commands/search.js';
import { registerExportCommand } from './commands/export.js';
import { registerMigrateCommand } from './commands/migrate.js';

const program = new Command();

program
  .name('cch')
  .description('Claude Code History CLI')
  .version('0.1.0')
  .option('-d, --data-path <path>', 'Custom data directory')
  .option('-j, --json', 'Output in JSON format', false)
  .option('-f, --full', 'Output full content without pagination', false);

// Register commands
registerListCommand(program);
registerViewCommand(program);
registerSearchCommand(program);
registerExportCommand(program);
registerMigrateCommand(program);

program.parse();
```

## Step 5: Implement Utility Functions

Create `src/cli/utils/config.ts`:

```typescript
import { LibraryConfig } from '../../lib/index.js';
import { getDefaultDataPath } from '../../lib/index.js';

export interface GlobalOptions {
  dataPath?: string;
  json: boolean;
  full: boolean;
}

export function resolveConfig(opts: GlobalOptions): LibraryConfig {
  return {
    dataPath: opts.dataPath || process.env.CCH_DATA_PATH || getDefaultDataPath(),
  };
}
```

Create `src/cli/utils/output.ts`:

```typescript
import { spawn } from 'child_process';

export function output(content: string, json: boolean, full: boolean): void {
  if (json) {
    console.log(content);
    return;
  }

  if (full || !process.stdout.isTTY) {
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

## Step 6: Implement List Command

Create `src/cli/commands/list.ts`:

```typescript
import { Command } from 'commander';
import { listSessions, SessionSummary } from '../../lib/index.js';
import { resolveConfig, GlobalOptions } from '../utils/config.js';
import { output } from '../utils/output.js';
import { formatSessionTable } from '../formatters/table.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all sessions')
    .option('-w, --workspace <path>', 'Filter by workspace')
    .option('-l, --limit <number>', 'Max sessions', '50')
    .option('-o, --offset <number>', 'Skip sessions', '0')
    .action(async (options) => {
      const globalOpts = program.opts() as GlobalOptions;
      const config = resolveConfig(globalOpts);

      const result = await listSessions({
        ...config,
        workspace: options.workspace,
        limit: parseInt(options.limit, 10),
        offset: parseInt(options.offset, 10),
      });

      if (globalOpts.json) {
        output(JSON.stringify({ success: true, data: result.data, pagination: result.pagination }, null, 2), true, true);
      } else {
        output(formatSessionTable(result.data, result.pagination), false, globalOpts.full);
      }
    });
}
```

## Step 7: Implement View Command

Create `src/cli/commands/view.ts`:

```typescript
import { Command } from 'commander';
import { getSession } from '../../lib/index.js';
import { resolveConfig, GlobalOptions } from '../utils/config.js';
import { output } from '../utils/output.js';
import { formatSession } from '../formatters/session.js';

export function registerViewCommand(program: Command): void {
  program
    .command('view <session>')
    .description('View session contents')
    .action(async (sessionRef) => {
      const globalOpts = program.opts() as GlobalOptions;
      const config = resolveConfig(globalOpts);

      const sessionId = parseSessionRef(sessionRef);
      const session = await getSession(sessionId, config);

      if (globalOpts.json) {
        output(JSON.stringify({ success: true, data: session }, null, 2), true, true);
      } else {
        output(formatSession(session), false, globalOpts.full);
      }
    });
}

function parseSessionRef(input: string): number | string {
  const num = parseInt(input, 10);
  return isNaN(num) ? input : num;
}
```

## Step 8: Build and Test

```bash
# Build
npm run build

# Test locally
node dist/cli/index.js list
node dist/cli/index.js view 0
node dist/cli/index.js search "query"

# Or link globally
npm link
cch list
```

## Step 9: Add Integration Tests

Create `tests/integration/cli/list.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';

describe('cch list', () => {
  it('should list sessions in JSON format', () => {
    const result = execSync('node dist/cli/index.js list --json', {
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(Array.isArray(parsed.data)).toBe(true);
  });
});
```

## Implementation Order

1. **Phase 1**: Core infrastructure
   - `src/cli/index.ts` - Entry point
   - `src/cli/utils/config.ts` - Configuration
   - `src/cli/utils/output.ts` - Output handling
   - `src/cli/utils/errors.ts` - Error handling

2. **Phase 2**: P1 Commands (list, view)
   - `src/cli/commands/list.ts`
   - `src/cli/commands/view.ts`
   - `src/cli/formatters/table.ts`
   - `src/cli/formatters/session.ts`

3. **Phase 3**: P2 Commands (search, export)
   - `src/cli/commands/search.ts`
   - `src/cli/commands/export.ts`
   - `src/cli/formatters/search.ts`

4. **Phase 4**: P3 Commands (migrate)
   - `src/cli/commands/migrate.ts`

5. **Phase 5**: Polish
   - Pagination/pager support
   - Colors (optional)
   - Comprehensive tests

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/cli/index.ts` | Entry point, command registration |
| `src/cli/commands/*.ts` | Individual command implementations |
| `src/cli/formatters/*.ts` | Output formatting for human-readable display |
| `src/cli/utils/config.ts` | Config resolution (env vars, options) |
| `src/cli/utils/output.ts` | Output handling (pager, stdout) |
| `src/cli/utils/errors.ts` | Error formatting and exit codes |
