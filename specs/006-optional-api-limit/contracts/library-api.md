# API Contract: Library Layer Changes

**Feature Branch**: `006-optional-api-limit`
**Date**: 2026-03-31

## listSessions()

### Signature (unchanged)
```typescript
export async function listSessions(
  config?: LibraryConfig
): Promise<PaginatedResult<SessionSummary>>
```

### Behavior Changes

| Scenario | Before | After |
|----------|--------|-------|
| `listSessions()` | Returns first 50 sessions | Returns **all** sessions |
| `listSessions({})` | Returns first 50 sessions | Returns **all** sessions |
| `listSessions({ offset: 10 })` | Returns sessions 10-59 | Returns **all** sessions from index 10 |
| `listSessions({ limit: undefined })` | Returns first 50 sessions | Returns **all** sessions |
| `listSessions({ limit: 20 })` | Returns first 20 sessions | Returns first 20 sessions (unchanged) |
| `listSessions({ limit: 0 })` | Returns 0 sessions | Returns 0 sessions (unchanged) |

### Pagination Metadata Changes

#### When no limit is provided (new behavior)
```typescript
// Given 94 total sessions, no limit, no offset:
{
  data: SessionSummary[94],
  pagination: {
    total: 94,
    limit: 94,      // count of items returned
    offset: 0,
    hasMore: false   // all items returned
  }
}
```

#### When no limit with offset (new behavior)
```typescript
// Given 94 total sessions, no limit, offset: 10:
{
  data: SessionSummary[84],
  pagination: {
    total: 94,
    limit: 84,      // count of items returned (94 - 10)
    offset: 10,
    hasMore: false   // all remaining items returned
  }
}
```

#### When explicit limit is provided (unchanged)
```typescript
// Given 94 total sessions, limit: 20, no offset:
{
  data: SessionSummary[20],
  pagination: {
    total: 94,
    limit: 20,
    offset: 0,
    hasMore: true    // 80 + 20 < 94
  }
}
```

---

## searchSessions()

### Signature (unchanged)
```typescript
export async function searchSessions(
  query: string,
  config?: LibraryConfig
): Promise<PaginatedResult<SearchMatch>>
```

### Internal Change
- Removes `limit: Number.MAX_SAFE_INTEGER` workaround when calling `listSessions()` internally
- Now relies on the default "no limit" behavior to fetch all sessions for searching

### External Behavior
- No change to external consumers. Search already returns paginated results with its own limit/offset from the user config.

---

## resolveConfig()

### Signature (unchanged)
```typescript
export function resolveConfig(config?: LibraryConfig): ResolvedConfig
```

### Return Type Change
```typescript
// Before
export interface ResolvedConfig {
  dataPath: string;
  workspace: string | undefined;
  limit: number;        // always a number
  offset: number;
  context: number;
}

// After
export interface ResolvedConfig {
  dataPath: string;
  workspace: string | undefined;
  limit: number | undefined;  // undefined = no limit
  offset: number;
  context: number;
}
```

### Resolution Logic Change
```typescript
// Before
limit: config?.limit ?? DEFAULT_CONFIG.limit,  // falls back to 50

// After
limit: config?.limit,  // undefined when not provided = no limit
```

---

## paginate()

### Signature Change
```typescript
// Before
export function paginate<T>(items: T[], config: ResolvedConfig): T[]

// After (same signature, different behavior for undefined limit)
export function paginate<T>(items: T[], config: ResolvedConfig): T[]
```

### Behavior Change
```typescript
// Before
return items.slice(config.offset, config.offset + config.limit);

// After
if (config.limit === undefined) {
  return items.slice(config.offset);
}
return items.slice(config.offset, config.offset + config.limit);
```

---

## createPagination()

### Signature (unchanged)
```typescript
export function createPagination(
  total: number,
  config: ResolvedConfig
): { total: number; limit: number; offset: number; hasMore: boolean }
```

### Behavior Change
```typescript
// Before
return {
  total,
  limit: config.limit,
  offset: config.offset,
  hasMore: config.offset + config.limit < total,
};

// After
if (config.limit === undefined) {
  const returned = Math.max(0, total - config.offset);
  return {
    total,
    limit: returned,
    offset: config.offset,
    hasMore: false,
  };
}
return {
  total,
  limit: config.limit,
  offset: config.offset,
  hasMore: config.offset + config.limit < total,
};
```

---

## CLI Layer (No Contract Changes)

The CLI `list` command is **not affected**:
- Commander option default remains `'50'`
- `parseInt(options.limit, 10)` always produces a number
- `toLibraryConfig(config, { limit })` always passes an explicit number
- Library receives `limit: 50` and behaves as before

```typescript
// src/cli/commands/list.ts - NO CHANGES
.option('-l, --limit <number>', 'Maximum number of sessions to display', '50')
```

---

## Validation Changes

| Input | Before | After |
|-------|--------|-------|
| `limit: undefined` | Defaults to 50 | No limit (return all) |
| `limit: 0` | Returns 0 results | Returns 0 results (unchanged) |
| `limit: -1` | Throws "limit must be non-negative" | Throws "limit must be non-negative" (unchanged) |
| `limit: 20` | Returns up to 20 | Returns up to 20 (unchanged) |
