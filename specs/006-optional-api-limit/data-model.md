# Data Model: Optional API Limit for listSessions()

**Feature Branch**: `006-optional-api-limit`
**Date**: 2026-03-31

## Entity Changes

### 1. ResolvedConfig (src/lib/config.ts)

Internal configuration after merging defaults. The `limit` field changes to support "no limit."

| Field | Current Type | New Type | Change | Notes |
|-------|-------------|----------|--------|-------|
| `dataPath` | `string` | `string` | None | |
| `workspace` | `string \| undefined` | `string \| undefined` | None | |
| `limit` | `number` | `number \| undefined` | **MODIFIED** | `undefined` = return all results |
| `offset` | `number` | `number` | None | |
| `context` | `number` | `number` | None | |

**Validation rules**:
- `limit` when defined: must be `>= 0` (existing rule, unchanged)
- `limit` when `undefined`: no validation needed (means "no limit")
- `offset`: must be `>= 0` (unchanged)
- `context`: must be `>= 0` (unchanged)

---

### 2. LibraryConfig (src/lib/types.ts)

User-facing configuration. The **type does not change** - `limit` was already `number | undefined` (optional field). Only the **JsDoc** changes.

| Field | Current Type | New Type | Change | Notes |
|-------|-------------|----------|--------|-------|
| `limit?` | `number \| undefined` | `number \| undefined` | **JSDOC ONLY** | Old: "Default: 50". New: "No limit when omitted" |

**JsDoc update**:
```typescript
// Before:
/** Maximum number of results to return. Default: 50 */
limit?: number;

// After:
/** Maximum number of results to return. When omitted or undefined, all results are returned. */
limit?: number;
```

---

### 3. DEFAULT_CONFIG (src/lib/config.ts)

Default configuration constants. The `limit` field is removed.

| Field | Current Value | New Value | Change |
|-------|-------------|-----------|--------|
| `dataPath` | `getDefaultDataPath()` | `getDefaultDataPath()` | None |
| `workspace` | `undefined` | `undefined` | None |
| `limit` | `50` | *(removed)* | **REMOVED** |
| `offset` | `0` | `0` | None |
| `context` | `2` | `2` | None |

**Type change for DEFAULT_CONFIG**:
```typescript
// Before:
export const DEFAULT_CONFIG: Required<Omit<LibraryConfig, 'dataPath' | 'workspace'>> & {
  dataPath: string;
  workspace: undefined;
} = { ... };

// After:
export const DEFAULT_CONFIG: {
  dataPath: string;
  workspace: undefined;
  offset: number;
  context: number;
} = { ... };
```

---

### 4. Pagination (src/lib/types.ts)

Pagination metadata. **No type changes.** Behavioral change only.

| Field | Type | Change | Behavior When No Limit |
|-------|------|--------|----------------------|
| `total` | `number` | None | Total matching items (unchanged) |
| `limit` | `number` | **SEMANTIC** | Set to count of items returned |
| `offset` | `number` | None | Current offset (unchanged) |
| `hasMore` | `boolean` | **SEMANTIC** | Always `false` when no limit |

---

### 5. PaginatedResult<T> (src/lib/types.ts)

No changes. Wraps `data: T[]` and `pagination: Pagination`.

---

## State Transitions

This feature has no state transitions. All operations are stateless reads.

## Relationship Diagram

```text
LibraryConfig (user input)
  │
  ▼
resolveConfig() ──► ResolvedConfig (limit: number | undefined)
  │                    │
  │                    ├── paginate(items, config)
  │                    │     └── When limit undefined: items.slice(offset)
  │                    │     └── When limit defined:   items.slice(offset, offset + limit)
  │                    │
  │                    └── createPagination(total, config)
  │                          └── When limit undefined: { limit: total - offset, hasMore: false }
  │                          └── When limit defined:   { limit: limit, hasMore: offset + limit < total }
  │
  ▼
CLI Layer (src/cli/commands/list.ts)
  └── Always passes limit: parseInt('50', 10) from Commander default
      └── Library sees limit: 50 (explicit) ──► normal pagination
```

## Affected Functions

| Function | File | Impact |
|----------|------|--------|
| `resolveConfig()` | `src/lib/config.ts` | Don't default `limit` to 50 |
| `paginate()` | `src/lib/config.ts` | Handle `undefined` limit |
| `createPagination()` | `src/lib/config.ts` | Handle `undefined` limit |
| `listSessions()` | `src/lib/session.ts` | No code change (consumes updated config) |
| `searchSessions()` | `src/lib/search.ts` | Remove `MAX_SAFE_INTEGER` workaround |
| `getSession()` | `src/lib/session.ts` | No change (doesn't use limit for retrieval) |
| `searchInSession()` | `src/lib/search.ts` | No change (doesn't paginate internally) |
