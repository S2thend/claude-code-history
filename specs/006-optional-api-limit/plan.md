# Implementation Plan: Optional API Limit for listSessions()

**Branch**: `006-optional-api-limit` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-optional-api-limit/spec.md`

## Summary

Make `listSessions()` and other session-enumerating library functions that rely on the shared configuration resolution return all results when no numeric `limit` is provided, instead of silently capping at 50. The library layer's `ResolvedConfig.limit` changes from `number` to `number | undefined`, where `undefined` means "no limit." The CLI layer retains its own default of 50 for terminal display. The `paginate()` and `createPagination()` helpers are updated to handle the unlimited case, and `searchSessions()` plus the export-all helpers are simplified to remove their `Number.MAX_SAFE_INTEGER` workarounds.

## Technical Context

**Language/Version**: TypeScript 5.3+ with strict mode (ES2022 target)
**Primary Dependencies**: Commander.js ^14.0.2 (CLI framework), Node.js built-ins (fs, path, readline)
**Storage**: Reads JSONL session files from `~/.claude/projects/` (no database)
**Testing**: Vitest ^2.0.0 (unit + integration + explicit coverage threshold validation), @vitest/coverage-v8
**Target Platform**: Node.js 20+ (macOS, Linux, Windows)
**Project Type**: Single project (library + CLI consumer)
**Performance Goals**: Listing is metadata-only; no full message parsing during `listSessions()`. Acceptable to return all sessions without a limit since the operation is lightweight.
**Constraints**: No new dependencies. Backward-compatible for explicit-limit callers. CLI display default unchanged.
**Scale/Scope**: Typical user has 10-500 sessions. Unlimited listing is safe at this scale.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | PASS | CLI retains `--limit 50` default. `--limit` flag remains functional. No CLI behavior change for terminal users. |
| II. Non-Destructive Operations | PASS | This is a read-only change. No data modification. |
| III. Cross-Platform Compatibility | PASS | No platform-specific changes. Path handling untouched. |
| IV. Library-First Architecture | PASS | Change is in `src/lib/config.ts` (library layer). CLI continues to consume library API. Library does not depend on CLI. |
| V. Data Fidelity | PASS | No export format or migration fidelity changes. Export helpers only change how omitted limits enumerate sessions; session data remains untouched. |
| Code Quality (no `any`) | PASS | Type change is `number` to `number \| undefined` - fully typed. |
| Testing (80% coverage) | PASS | New unit and integration tests plus explicit `npm run test:coverage` validation required for unlimited behavior. |
| Dependencies (minimal) | PASS | No new dependencies added. |

**Pre-design gate: PASSED** - No violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-optional-api-limit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── library-api.md   # Library API contract changes
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── config.ts        # PRIMARY: resolveConfig(), paginate(), createPagination(), DEFAULT_CONFIG, ResolvedConfig
│   ├── types.ts         # LibraryConfig interface (limit? JSDoc update), Pagination interface
│   ├── session.ts       # listSessions(), getSession() - consumers of resolveConfig()
│   ├── search.ts        # searchSessions() - simplify Number.MAX_SAFE_INTEGER workaround
│   ├── export.ts        # exportAllSessionsToJson()/exportAllSessionsToMarkdown() - simplify Number.MAX_SAFE_INTEGER workaround
│   └── index.ts         # Re-exports (no changes expected)
├── cli/
│   ├── commands/list.ts # CLI list command - retains '50' default, no functional change
│   └── commands/search.ts # CLI search command - no changes expected
│
tests/
├── unit/
│   └── config.test.ts   # MODIFY: Add unlimited config tests
├── integration/
│   ├── list-sessions.test.ts    # MODIFY: Add unlimited listing tests
│   ├── search-sessions.test.ts  # MODIFY: Add no-limit search coverage
│   ├── export-sessions.test.ts  # MODIFY: Add no-limit export coverage
│   └── cli/
│       └── list.test.ts         # VERIFY: CLI still defaults to 50
```

**Structure Decision**: Single project layout. All changes are within existing `src/lib/` and `tests/` directories. No new directories or files needed in `src/`.

## Complexity Tracking

> No constitution violations. This table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | | |
