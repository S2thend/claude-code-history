# Quickstart: Optional API Limit for listSessions()

**Feature Branch**: `006-optional-api-limit`
**Date**: 2026-03-31

## Overview

This feature changes the library layer so that `listSessions()` (and all functions sharing `resolveConfig()`) returns **all results** when no `limit` is provided. The CLI layer is unaffected - it continues to default to 50 sessions.

## Files to Modify (in order)

### Step 1: Update types (src/lib/types.ts)

Update the JSDoc for `LibraryConfig.limit`:

```typescript
// Change line 22 from:
/** Maximum number of results to return. Default: 50 */
limit?: number;

// To:
/** Maximum number of results to return. When omitted or undefined, all results are returned. */
limit?: number;
```

### Step 2: Update config resolution (src/lib/config.ts)

This is the **primary change**. Five modifications:

**2a. Update `ResolvedConfig` interface (line 26):**
```typescript
// Change:
limit: number;
// To:
limit: number | undefined;
```

**2b. Update `DEFAULT_CONFIG` (lines 8-18):**
```typescript
// Remove 'limit: 50' from DEFAULT_CONFIG.
// Update the type annotation to reflect the removal.
export const DEFAULT_CONFIG: {
  dataPath: string;
  workspace: undefined;
  offset: number;
  context: number;
} = {
  dataPath: getDefaultDataPath(),
  workspace: undefined,
  offset: 0,
  context: 2,
};
```

**2c. Update `resolveConfig()` (line 40):**
```typescript
// Change:
limit: config?.limit ?? DEFAULT_CONFIG.limit,
// To:
limit: config?.limit,
```

Also update validation (line 46):
```typescript
// Change:
if (resolved.limit < 0) {
// To:
if (resolved.limit !== undefined && resolved.limit < 0) {
```

**2d. Update `paginate()` (line 66):**
```typescript
// Change:
return items.slice(config.offset, config.offset + config.limit);
// To:
if (config.limit === undefined) {
  return items.slice(config.offset);
}
return items.slice(config.offset, config.offset + config.limit);
```

**2e. Update `createPagination()` (lines 78-83):**
```typescript
// Change the return block to:
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

### Step 3: Simplify searchSessions() (src/lib/search.ts)

Remove the `Number.MAX_SAFE_INTEGER` workaround (~line 216):

```typescript
// Change:
const sessionsResult = await listSessions({
  dataPath: resolved.dataPath,
  workspace: resolved.workspace,
  limit: Number.MAX_SAFE_INTEGER,
  offset: 0,
});

// To:
const sessionsResult = await listSessions({
  dataPath: resolved.dataPath,
  workspace: resolved.workspace,
});
```

### Step 4: Add/update tests

**Unit tests (tests/unit/config.test.ts):**
- Test `resolveConfig()` with no config returns `limit: undefined`
- Test `resolveConfig({})` returns `limit: undefined`
- Test `resolveConfig({ limit: undefined })` returns `limit: undefined`
- Test `resolveConfig({ limit: 20 })` returns `limit: 20`
- Test `paginate()` with undefined limit returns all items from offset
- Test `createPagination()` with undefined limit returns correct metadata

**Integration tests (tests/integration/list-sessions.test.ts):**
- Test `listSessions()` with no config returns all sessions
- Test `listSessions({})` returns all sessions
- Test `listSessions({ offset: 10 })` returns all sessions from offset 10
- Test `listSessions({ limit: 20 })` returns exactly 20 sessions (backward compat)

**CLI integration tests (tests/integration/cli/list.test.ts):**
- Verify `cch list` still defaults to 50 sessions

### Step 5: No CLI changes needed

The CLI already passes `limit: parseInt('50', 10)` explicitly. No changes required.

## Verification Commands

```bash
# Type check
npm run typecheck

# Run all tests
npm test

# Run specific test files
npx vitest run tests/unit/config.test.ts
npx vitest run tests/integration/list-sessions.test.ts

# Lint
npm run lint
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Type error in consumers of `ResolvedConfig.limit` | Medium | Low | TypeScript strict mode will catch all usages at compile time |
| CLI default breaks | Low | Medium | CLI uses Commander string default + parseInt, completely independent path |
| Performance with many sessions | Low | Low | Listing is metadata-only; tested assumption in spec |
| searchSessions behavior change | Low | Medium | Remove workaround only; net behavior identical |
