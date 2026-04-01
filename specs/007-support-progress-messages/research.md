# Research: Support Progress Messages

**Feature**: 007-support-progress-messages  
**Date**: 2026-04-01

## Overview

This document captures the decisions needed to add first-class `progress` message support to Claude Code History while preserving the project’s existing library-first and CLI-first architecture.

## Research Areas

### 1. Canonical Representation of Progress Entries

**Decision**: Represent `progress` as a distinct top-level session message type rather than coercing it into `assistant` or `tool`.

**Rationale**:
- The feature spec requires progress entries to remain identifiable in search, view, JSON output, and filtering.
- The current bug exists because unknown entry types are discarded before later layers can reason about them.
- A dedicated message type avoids ambiguous behavior in filters, match labels, and counts.

**Alternatives Considered**:
- Treat progress as `assistant`: Rejected because it hides the distinction the user explicitly asked to preserve.
- Treat progress as `tool`: Rejected because progress text is not a tool invocation and should not be conflated with tool-use blocks.
- Leave progress as untyped raw JSON: Rejected because search, filtering, and formatting rely on typed message unions.

### 2. Raw Payload Handling Strategy

**Decision**: Parse progress entries defensively using the same human-readable block extraction approach already used for assistant content, while ignoring unknown or non-readable blocks safely.

**Rationale**:
- The repository does not include a real Claude Code fixture with `type: "progress"`, so payload variants cannot be exhaustively enumerated from local fixtures alone.
- The reported bug and local reproduction both show a top-level `type: "progress"` entry containing user-visible content that must be searchable and renderable.
- Defensive parsing lets the library preserve readable progress text now without breaking if progress payloads vary slightly across Claude Code versions.

**Alternatives Considered**:
- Refuse support until a real fixture is checked in: Rejected because the feature can be designed safely with defensive parsing plus targeted regression tests.
- Serialize raw progress payloads directly into output: Rejected because it would degrade readability and search context quality.

### 3. Filtering Semantics

**Decision**: Add a dedicated `progress` filter value and include it in mixed filter combinations.

**Rationale**:
- The clarification session resolved this explicitly.
- Dedicated filtering keeps acceptance tests straightforward and prevents users from guessing whether progress belongs to `assistant` or `tool`.
- The existing filter model already supports additive filter categories, so this is a natural extension.

**Alternatives Considered**:
- Fold progress into `assistant`: Rejected because progress is operational state, not assistant prose.
- Fold progress into `tool`: Rejected because progress is not a tool invocation result category.
- Show progress by default but make it unfilterable: Rejected because troubleshooting workflows need isolation.

### 4. Search Result Semantics

**Decision**: Extend search matching and result labeling to recognize `progress` as a searchable message type with the same session/message/context metadata as existing matches.

**Rationale**:
- The feature’s primary user value is that terms appearing only in progress entries become discoverable through normal search flows.
- Search results are already organized around message source and context; adding `progress` preserves that pattern with minimal conceptual change.
- Dedicated labeling avoids falsely reporting progress matches as user or assistant matches.

**Alternatives Considered**:
- Search progress but label it as assistant: Rejected because it obscures where the match came from.
- Search progress only in session-scoped searches: Rejected because the bug affects both global and scoped search paths.

### 5. Counts and Displayable Message Rules

**Decision**: Treat progress messages as displayable session messages for transcript output, filtered counts, and session message totals shown to users.

**Rationale**:
- Once progress becomes visible in the transcript, counts that exclude it would be misleading.
- Current message totals and filtered totals are hard-coded around `user` and `assistant`, which is one of the concrete places the bug persists.
- Summary and file-history entries remain non-displayable, so the existing distinction between transcript content and metadata-only entries remains intact.

**Alternatives Considered**:
- Keep session totals limited to user and assistant: Rejected because it would undercount displayed transcript items.
- Count all raw entry types: Rejected because summary and file-history snapshot entries are still not transcript messages.

### 6. Export Surface Behavior

**Decision**: Preserve progress messages in exported session data, with JSON export including them automatically through the session model and Markdown export rendering them explicitly.

**Rationale**:
- Data fidelity is a constitutional principle; once the parser preserves progress messages, exports should not silently drop them.
- JSON export already serializes `Session.messages`, so supporting progress there is a direct consequence of the corrected model.
- Markdown export currently formats messages by explicit type and would otherwise remain incomplete or become non-exhaustive.

**Alternatives Considered**:
- Limit support to search and view only: Rejected because it would reintroduce silent omission on another user-facing surface.
- Exclude progress from Markdown export: Rejected because it would create inconsistent transcript fidelity across outputs.

### 7. Test Strategy

**Decision**: Add synthetic progress fixtures and regression coverage across parser, session retrieval, search, view, and export tests.

**Rationale**:
- No current fixture covers `progress`, so the bug is untested today.
- A synthetic fixture is sufficient to lock in the intended behavior even before a sanitized real-world progress fixture is available.
- The existing test suite already separates library and CLI integration paths, which matches the architectural split of the feature.

**Alternatives Considered**:
- Only add parser tests: Rejected because the bug spans multiple layers after parsing.
- Only add CLI tests: Rejected because the root cause begins in the typed message model and parser.

## Integration Points

### Files to Modify

1. `src/lib/types.ts`
   - Add a `ProgressMessage` type and extend relevant unions.
   - Extend searchable/filterable message-type unions to include progress where appropriate.

2. `src/lib/parser.ts`
   - Transform raw `type: "progress"` entries into typed messages.
   - Update metadata counting rules for displayable messages.

3. `src/lib/session.ts`
   - Update session message counts and displayable-message filtering.
   - Extend classification logic for the dedicated `progress` filter.

4. `src/lib/search.ts`
   - Include progress text in search extraction and search match metadata.

5. `src/lib/export.ts`
   - Render progress entries in Markdown exports.

6. `src/lib/index.ts`
   - Export any new public types or constants added for progress support.

7. `src/cli/commands/view.ts`
   - Accept and validate `progress` in `--only`.
   - Ensure filtered counts align with the updated displayable-message rules.

8. `src/cli/formatters/session.ts`
   - Format progress entries distinctly in human-readable view output.

9. `src/cli/formatters/search.ts`
   - Label progress search matches correctly.

10. `tests/...`
    - Add regression coverage across parser, session retrieval, search, view, and export.

## Performance Considerations

- The feature does not add new I/O passes; it only stops discarding an existing entry type.
- Search and filtering remain linear in the number of parsed messages.
- The main performance requirement is to avoid measurable user-visible regression when sessions contain progress entries.

## Open Uncertainty Managed by Design

- No checked-in fixture currently demonstrates the exact raw progress payload from Claude Code.
- The chosen mitigation is defensive parsing of readable content plus synthetic regression fixtures.
- If a real anonymized progress fixture becomes available later, it should be added as a follow-up test asset rather than blocking this feature.
