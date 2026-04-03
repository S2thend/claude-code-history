# Research: Full Content Library Output

**Feature**: 009-full-content-lib  
**Date**: 2026-04-03

## Overview

This document records implementation decisions for enforcing a strict full-fidelity library layer while keeping concise rendering as a CLI-only concern controlled by `--full/-f`.

## Research Areas

### 1. Library and Parser Fidelity Boundary

**Decision**: Remove all content-shortening logic from `src/lib/`, including the `parseJsonLine()` warning-content preview, and return exact tool/message/parser content to callers.

**Rationale**:
- The feature spec and constitution both require programmatic consumers to receive complete data and treat lossy shortening as a display concern only.
- `getSession()` and parser helpers should not silently alter payloads that downstream tools may export, diff, or audit.
- The existing parser warning snippet (`100 + "..."`) is a library-layer truncation path and must be replaced with the full invalid-line content.

**Alternatives considered**:
- Keep parser warning previews truncated for memory safety: Rejected because the acceptance criteria explicitly says no truncation logic in `src/lib/`.
- Preserve message/tool payloads only and leave parse warnings truncated: Rejected because it leaves one library function returning shortened caller-visible content.

### 2. CLI Formatter Full-Mode Contract

**Decision**: Extend the session formatter options with a `full` rendering flag and make every human-readable abbreviation branch conditional on `full === false`.

**Rationale**:
- `--full/-f` already exists and is the natural single "give me everything" control.
- Formatter-only conditionals preserve the current library/CLI separation and avoid contaminating session retrieval with presentation policy.
- Existing default previews remain useful for terminal readability, but full mode must bypass all formatter shortening for tool inputs, tool results, thinking blocks, and fallback tool-result previews.

**Alternatives considered**:
- Add a second CLI flag dedicated only to truncation: Rejected because the spec asks to extend the existing `--full/-f` switch and avoid split user controls.
- Remove default CLI abbreviation entirely: Rejected because the spec explicitly allows concise default viewing for readability.

### 3. Default Abbreviation Strategy

**Decision**: Keep default human-readable `cch view` concise by retaining the current formatter-local length caps of 300 characters for tool inputs, 500 for tool results, 100 for thinking text, and 200 for fallback tool-result previews, but isolate those caps behind one formatter helper that can be disabled by `full` and emits `[...truncated for display]` instead of plain `...`.

**Rationale**:
- Preserving default readability minimizes user-facing regressions for routine session scans.
- Centralizing formatter truncation makes it easy to prove no shortening exists in the library layer and to disable all abbreviation consistently in full mode.
- A helper-based design avoids repeated hardcoded `slice(...) + "..."` branches, uses a marker that is distinguishable from source-authored `...` text, and simplifies test coverage.

**Alternatives considered**:
- Keep each truncation branch hardcoded in-place: Rejected because it spreads presentation policy across formatter internals and makes `full` bypass coverage error-prone.
- Make truncation opt-in per field with separate limits in command code: Rejected because `view` should not own per-field rendering policy and would leak formatter details into command logic.

### 4. `cch view --full` Propagation

**Decision**: Pass the existing global `full` option from `src/cli/commands/view.ts` into `formatSession(...)` for human-readable output, while leaving `formatSessionForJson(...)` full-fidelity by default and independent of pager settings.

**Rationale**:
- The command already uses `options.full` to disable pagination; forwarding the same value to the formatter preserves a single user-facing switch.
- JSON output should continue returning structured data without display-specific abbreviation and should not require `--full` to be complete.
- Keeping the formatter API explicit avoids relying on hidden global state.

**Alternatives considered**:
- Infer full mode inside the formatter from process state: Rejected because the formatter should receive all rendering decisions explicitly and stay easy to test.
- Apply `full` only to pager behavior and not display abbreviation: Rejected because that is the current bug and violates the feature acceptance criteria.

### 5. Test and Fixture Strategy

**Decision**: Add regression tests that prove library retrieval and parser warnings preserve long content, default formatter output abbreviates visibly, `cch view --full` disables formatter truncation end-to-end, and running default/full `cch view` does not change later programmatic retrieval or exports.

**Rationale**:
- Existing formatter/parser tests currently assert truncation, so they need to be split into default-mode and full-mode expectations.
- Integration tests are required to prove the `--full` flag reaches the formatter and does not affect JSON/library payload fidelity.
- A post-view invariance regression is needed to prove display-only abbreviation does not mutate later `getSession()` retrieval or exported payloads.
- Long synthetic payloads over 1,000 characters are enough to exercise the acceptance criteria without introducing brittle external fixtures.

**Alternatives considered**:
- Cover only formatter unit tests: Rejected because command-level `--full` propagation and library retrieval fidelity must also be verified.
- Add large golden fixture files only: Rejected because generated long strings keep tests focused and easier to maintain for simple truncation boundaries.

## Integration Points

### Files to Modify

1. `src/lib/parser.ts`
   - Return full invalid-line warning content from `parseJsonLine()`.

2. `src/cli/formatters/session.ts`
   - Add a formatter-only full-mode option and centralize abbreviation behavior.

3. `src/cli/commands/view.ts`
   - Forward `options.full` into `formatSession(...)` for human-readable output.

4. `tests/unit/parser.test.ts`
   - Replace parser warning truncation expectations with full-content assertions.

5. `tests/unit/cli/formatters/session.test.ts`
   - Cover default concise output with `[...truncated for display]` and full-mode untruncated output for tool inputs, tool results, thinking blocks, and fallback tool-result previews.

6. `tests/integration/get-session.test.ts`
   - Verify long message/tool payloads returned by `getSession()` are complete.

7. `tests/integration/cli/view.test.ts`
   - Verify default `cch view` abbreviates visibly, `cch view --full` shows complete long content, and post-view retrieval/export results remain unchanged.

## Performance Considerations

- Full-fidelity library retrieval may increase returned payload size for large messages and invalid parser-warning lines, but that is intentional and delegated to callers.
- Default CLI display remains concise unless `--full` is requested, so routine terminal scans should stay readable.
- No additional traversal, parsing, or storage layers are introduced.

## Resolved Uncertainty

- The only library-side truncation found during planning is parse-warning content in `parseJsonLine()`, and that truncation is explicitly removed by this design.
- Formatter truncation is not removed entirely; it becomes conditional on formatter options, uses `[...truncated for display]` in default mode, and defaults to concise human-readable output unless `--full/-f` is enabled.
