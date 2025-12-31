# Quickstart: Claude Code History Library

**Feature**: 001-core-lib
**Version**: 0.1.0 (planned)

---

## Installation

```bash
npm install claude-code-history
```

**Requirements**: Node.js 20+

---

## Basic Usage

### List Sessions

```typescript
import { listSessions } from 'claude-code-history';

// List all sessions (most recent first)
const result = await listSessions();
console.log(`Found ${result.pagination.total} sessions`);

for (const session of result.data) {
  console.log(`${session.id}: ${session.summary || 'No title'}`);
  console.log(`  Project: ${session.projectPath}`);
  console.log(`  Messages: ${session.messageCount}`);
}

// Paginate through results
const page2 = await listSessions({ limit: 10, offset: 10 });

// Filter by workspace
const projectSessions = await listSessions({
  workspace: '/Users/me/my-project'
});
```

### Get Session Details

```typescript
import { getSession } from 'claude-code-history';

// Get by index (0 = most recent)
const session = await getSession(0);
console.log(`Session: ${session.summary}`);
console.log(`Messages: ${session.messages.length}`);

// Get by UUID
const specific = await getSession('073ed9b5-2c60-486d-aa4f-20afd95ddd37');

// Iterate messages
for (const msg of session.messages) {
  if (msg.type === 'user') {
    console.log(`User: ${typeof msg.content === 'string' ? msg.content : '[tool result]'}`);
  } else if (msg.type === 'assistant') {
    for (const block of msg.content) {
      if (block.type === 'text') {
        console.log(`Assistant: ${block.text.substring(0, 100)}...`);
      } else if (block.type === 'tool_use') {
        console.log(`Tool: ${block.name}`);
      }
    }
  }
}
```

### Search Sessions

```typescript
import { searchSessions } from 'claude-code-history';

// Search for keyword
const matches = await searchSessions('authentication');

for (const match of matches) {
  console.log(`Found in session: ${match.sessionId}`);
  console.log(`  Match: ${match.match}`);
  console.log(`  Context: ${match.context.join('\n')}`);
}

// Search with more context lines
const detailed = await searchSessions('error', { context: 5 });
```

### Export Sessions

```typescript
import {
  exportSessionToMarkdown,
  exportSessionToJson,
  exportAllSessionsToMarkdown
} from 'claude-code-history';

// Export single session to Markdown
const markdown = await exportSessionToMarkdown(0);
await fs.writeFile('session.md', markdown);

// Export to JSON (full data)
const json = await exportSessionToJson(0);
await fs.writeFile('session.json', json);

// Export all sessions from a project
const allMd = await exportAllSessionsToMarkdown({
  workspace: '/Users/me/my-project'
});
```

### Migrate Sessions

```typescript
import { migrateSession, migrateWorkspace } from 'claude-code-history';

// Copy a session to another workspace
const result = await migrateSession({
  sessions: 0,  // index or UUID
  destination: '/Users/me/new-project'
});
console.log(`Migrated ${result.successCount} sessions`);

// Copy multiple sessions
const multi = await migrateSession({
  sessions: [0, 2, 4],
  destination: '/Users/me/archive',
  mode: 'copy'  // 'copy' (default) or 'move'
});

// Migrate entire workspace
const workspace = await migrateWorkspace({
  source: '/Users/me/old-project',
  destination: '/Users/me/new-project'
});
```

---

## Error Handling

```typescript
import {
  getSession,
  listSessions,
  isSessionNotFoundError,
  isWorkspaceNotFoundError,
  isDataNotFoundError
} from 'claude-code-history';

try {
  const session = await getSession(999);
} catch (err) {
  if (isSessionNotFoundError(err)) {
    console.error('Session not found');
  } else if (isDataNotFoundError(err)) {
    console.error('Claude Code data directory not found');
  } else {
    throw err;
  }
}

try {
  const sessions = await listSessions({ workspace: '/invalid/path' });
} catch (err) {
  if (isWorkspaceNotFoundError(err)) {
    console.error('Workspace not found - open project in Claude Code first');
  }
}
```

---

## Configuration

### Custom Data Path

```typescript
import { listSessions } from 'claude-code-history';

// Use custom data directory
const sessions = await listSessions({
  dataPath: '/custom/path/.claude'
});
```

### Get Default Path

```typescript
import { getDefaultDataPath } from 'claude-code-history';

const path = getDefaultDataPath();
// macOS/Linux: /Users/<name>/.claude
// Windows: C:\Users\<name>\.claude
```

---

## TypeScript Types

```typescript
import type {
  Session,
  SessionSummary,
  Message,
  UserMessage,
  AssistantMessage,
  SearchMatch,
  PaginatedResult,
  LibraryConfig
} from 'claude-code-history';

// All types are fully exported
const config: LibraryConfig = {
  limit: 20,
  offset: 0,
  workspace: '/path/to/project'
};

const result: PaginatedResult<SessionSummary> = await listSessions(config);
```

---

## Common Patterns

### Find Sessions by Date

```typescript
const sessions = await listSessions();
const today = new Date();
today.setHours(0, 0, 0, 0);

const todaySessions = sessions.data.filter(s =>
  new Date(s.timestamp) >= today
);
```

### Extract All Tool Calls

```typescript
const session = await getSession(0);
const toolCalls = session.messages
  .filter((m): m is AssistantMessage => m.type === 'assistant')
  .flatMap(m => m.content)
  .filter((c): c is ToolUseContent => c.type === 'tool_use');

for (const tool of toolCalls) {
  console.log(`${tool.name}: ${JSON.stringify(tool.input)}`);
}
```

### Export with Agent Sessions

```typescript
const session = await getSession(0);

// Check for linked agents
if (session.agentIds.length > 0) {
  console.log(`Session has ${session.agentIds.length} agent conversations`);

  // Agent sessions are exported inline in Markdown format
  const markdown = await exportSessionToMarkdown(0);
}
```
