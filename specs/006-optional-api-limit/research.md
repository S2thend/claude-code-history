# Research: Optional API Limit for listSessions()

**Feature Branch**: `006-optional-api-limit`
**Date**: 2026-03-31

## Research Questions

### RQ-1: How should `ResolvedConfig.limit` represent "no limit"?

**Decision**: Change `ResolvedConfig.limit` from `number` to `number | undefined`. When `undefined`, it means "return all results."

**Rationale**: Using `undefined` is the most idiomatic TypeScript approach and preserves type safety. It forces all consumers of `ResolvedConfig.limit` to explicitly handle the unlimited case via `typeof` or nullish checks, which the compiler will enforce in strict mode.

**Alternatives considered**:
- `Number.MAX_SAFE_INTEGER` sentinel: Already used as a workaround in `searchSessions()`. However, this is a leaky abstraction - it passes a large number through pagination metadata and `pagination.limit` would contain `9007199254740991`, which is meaningless to API consumers. It also requires magic-number checks to determine if the limit was "real."
- `limit: 0` meaning "all": Conflicts with the current semantic where `limit: 0` returns zero results (FR-009 implies `limit >= 0` is valid). Changing this would break backward compatibility.
- Separate `unlimited: boolean` flag: Adds unnecessary complexity and requires callers to manage two related properties.

---

### RQ-2: How should `DEFAULT_CONFIG` change?

**Decision**: Remove `limit: 50` from `DEFAULT_CONFIG` (or set it to `undefined`). The new default for the library layer is "no limit."

**Rationale**: The spec requires that `listSessions()` with no config returns all sessions (FR-001). The default must reflect this. The CLI layer already has its own default (`'50'` in Commander option definition), so the terminal user experience is unaffected.

**Alternatives considered**:
- Keep `limit: 50` in `DEFAULT_CONFIG` and add a separate "library default": Complicates config resolution with no benefit. The library and CLI already have separate default mechanisms.

---

### RQ-3: How should `paginate()` handle `undefined` limit?

**Decision**: When `config.limit` is `undefined`, return `items.slice(config.offset)` (all items from offset onward).

**Rationale**: `Array.prototype.slice(start)` with no second argument returns everything from `start` to the end, which is exactly the desired semantic. This is clean and requires minimal code change.

**Alternatives considered**:
- Defaulting limit to `items.length` inside `paginate()`: Works but adds an unnecessary step and mutates the effective limit, complicating `createPagination()` which needs to know if a limit was really set.

---

### RQ-4: How should `createPagination()` handle `undefined` limit?

**Decision**: When `config.limit` is `undefined`:
- `pagination.limit` = count of items actually returned (i.e., `total - offset`, clamped to 0)
- `pagination.hasMore` = `false` (since all remaining items are returned)
- `pagination.total` = total item count (unchanged)
- `pagination.offset` = config.offset (unchanged)

**Rationale**: The spec (FR-006) requires that `pagination.limit` reflects the actual number of items returned when no limit is provided. The `Pagination` type remains `number` (no type change). `hasMore: false` is correct since unlimited queries always return all remaining items.

---

### RQ-5: How should `searchSessions()` be simplified?

**Decision**: Replace the `limit: Number.MAX_SAFE_INTEGER` workaround in `searchSessions()` with omitting `limit` (relying on the new "no limit" default).

**Rationale**: The workaround (line ~216 in `src/lib/search.ts`) was necessary because `listSessions()` defaulted to 50. With the new behavior, omitting `limit` already means "get all sessions," which is what `searchSessions()` needs.

**Current workaround code**:
```typescript
const sessionsResult = await listSessions({
  dataPath: resolved.dataPath,
  workspace: resolved.workspace,
  limit: Number.MAX_SAFE_INTEGER,  // <-- remove this
  offset: 0,
});
```

**After fix**:
```typescript
const sessionsResult = await listSessions({
  dataPath: resolved.dataPath,
  workspace: resolved.workspace,
  // limit omitted: returns all sessions
});
```

---

### RQ-6: Impact on `Pagination` type's `limit` field?

**Decision**: Keep `Pagination.limit` as `number` (no type change). The clarification in the spec confirms that when no limit is applied, `limit` is set to the count of items returned.

**Rationale**: The spec explicitly states (FR-006): "The pagination metadata `limit` field MUST be set to the count of items actually returned when no explicit limit is provided. The `Pagination` type remains `number` with no type change."

---

### RQ-7: Should validation change for `limit`?

**Decision**: Keep the `limit < 0` validation, but only check when `limit` is defined. `undefined` limit skips validation (it means "no limit").

**Rationale**: FR-009 requires: "The library MUST continue to reject negative `limit` values with a validation error." This only applies when a numeric `limit` is provided. `undefined` is not negative - it means "no limit."

---

## Summary of Technical Decisions

| Decision | Choice |
|----------|--------|
| Representation of "no limit" | `undefined` in `ResolvedConfig.limit` |
| Library default | No limit (remove `limit: 50` from `DEFAULT_CONFIG`) |
| CLI default | Retain `'50'` Commander option default |
| Pagination.limit when unlimited | Count of items returned |
| Pagination.hasMore when unlimited | `false` |
| searchSessions() cleanup | Remove `MAX_SAFE_INTEGER` workaround |
| New dependencies | None |

All NEEDS CLARIFICATION items resolved. No outstanding unknowns.
