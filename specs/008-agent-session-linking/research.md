# Research: Agent Session Linking

**Feature**: 008-agent-session-linking  
**Date**: 2026-04-02

## Overview

This document captures the decisions needed to support nested Claude subagent transcripts, accurate main-session linking, and safe direct agent lookup without breaking the current library-first CLI architecture.

## Research Areas

### 1. Session Discovery Strategy

**Decision**: Recursively discover session files within each Claude project directory and retain storage-layout context for each discovered agent transcript.

**Rationale**:
- Current discovery only scans the top level of each project directory, so nested `<main-session>/subagents/agent-*.jsonl` files are invisible.
- Recursive discovery is required to bring nested subagent transcripts into the supported lookup surface.
- Retaining path context allows the system to distinguish flat project-level agent files from nested child-agent files and use nested ownership as a fallback relationship signal.

**Alternatives Considered**:
- Continue scanning only the project root: Rejected because nested subagents remain undiscoverable.
- Recursively discover files without recording layout context: Rejected because fallback linkage and conflict handling need to know where the agent transcript was found.

### 2. Parent-to-Agent Link Resolution

**Decision**: Use explicit agent references recorded in the main session as the authoritative link source, and use nested subagent path ownership only when the explicit reference data is missing or incomplete.

**Rationale**:
- The clarified spec requires real `toolUseResult.agentId`-style evidence to replace the current project-wide guess.
- Explicit reference data best reflects the true conversation relationship and must win when it conflicts with path evidence.
- Nested storage remains valuable as a recovery path for incomplete histories or older variants that still preserve the parent-child folder shape.

**Alternatives Considered**:
- Treat nested path ownership as the primary source: Rejected because it can be wrong when explicit main-session evidence disagrees.
- Require explicit references in every case: Rejected because the clarified spec allows fallback linking when the explicit data is incomplete.

### 3. Representation of Missing Child Transcripts

**Decision**: Separate unresolved referenced agent IDs from discoverable linked agent IDs in session metadata.

**Rationale**:
- The clarified spec requires missing child references to remain visible to users instead of being silently discarded.
- Mixing broken references into `agentIds` would violate the promise that linked identifiers are immediately usable in a follow-up lookup.
- A dedicated unresolved-reference field preserves fidelity while keeping successful navigation targets reliable.

**Alternatives Considered**:
- Drop missing references entirely: Rejected because it hides incomplete linkage evidence from users.
- Include missing references inside the normal linked-agent list: Rejected because it turns broken IDs into misleading navigation targets.

### 4. Direct Agent Lookup Semantics

**Decision**: Allow direct lookup by both bare agent ID and `agent-<id>` form, but fail with an ambiguity error if more than one discoverable transcript matches that agent ID.

**Rationale**:
- The clarified spec explicitly prefers direct lookup by agent ID alone, without requiring parent-session context.
- Recursive nested discovery makes duplicate agent IDs possible across different transcript files.
- Returning an ambiguity error is safer than choosing an arbitrary transcript and silently misrouting the user.

**Alternatives Considered**:
- Assume agent IDs are globally unique: Rejected because the clarified spec already anticipates duplicate-ID scenarios.
- Require parent-session context for every direct agent lookup: Rejected by clarification in favor of direct ID-based lookup.

### 5. Lookup Surface and CLI Contract

**Decision**: Keep `list` focused on main sessions, but expand library and CLI contracts so exported linked identifiers are directly usable and ambiguity and not-found lookup failures are surfaced as structured JSON outcomes.

**Rationale**:
- The current public contract documents `getSession()`/`view` mainly as index-or-UUID lookups, while the feature requires direct navigation by linked agent ID.
- Top-level list behavior should remain stable; the richer agent metadata belongs in JSON/list summaries, session detail views, and exports.
- Distinguishing ambiguity from “not found” keeps troubleshooting actionable for users and testable for the CLI.
- JSON workflows need a structured error payload so automation can reliably tell ambiguity apart from a missing transcript.

**Alternatives Considered**:
- Add agent sessions as top-level rows in `list`: Rejected because the spec keeps top-level session lists focused on main conversations.
- Treat ambiguity as “not found”: Rejected because it hides a materially different failure mode.

### 6. Backward Compatibility and Test Strategy

**Decision**: Preserve flat project-level `agent-*.jsonl` support while combining synthetic fixtures, anonymized real Claude JSONL contract samples, and cross-platform path cases for nested subagents, fallback linkage, missing transcripts, conflict precedence, and duplicate-ID ambiguity.

**Rationale**:
- Existing tests cover only flat agent sessions and simple `getAgentSession()` success/failure, so they do not protect the new discovery and linkage behavior.
- The feature must support both older flat storage and newer nested storage without regressing current workflows.
- Synthetic fixture trees remain useful for targeted edge cases, but contract validation against anonymized real Claude JSONL structures is required to protect parser and discovery behavior.
- Cross-platform path cases must be exercised explicitly because recursive nested discovery is path-sensitive.

**Alternatives Considered**:
- Replace flat support with nested-only behavior: Rejected because the spec requires backward compatibility.
- Cover only library paths: Rejected because direct lookup and ambiguity messaging must also work through `cch view`.

### 7. Fidelity and Performance Validation

**Decision**: Add explicit round-trip export validation for linked and unresolved metadata, and repeatable performance validation for session listing and direct lookup over fixture sets containing at least 100 sessions.

**Rationale**:
- The constitution requires exported metadata and relationships to survive round-trip validation.
- The clarified spec adds a measurable under-1-second target for both list and direct lookup workflows.
- Recursive discovery broadens the search surface, so performance regression must be measured rather than assumed.

**Alternatives Considered**:
- Validate only correctness and skip round-trip/performance checks: Rejected because fidelity and speed are explicit acceptance criteria.
- Benchmark only `list`: Rejected because direct agent lookup is also part of the promised user workflow.

## Integration Points

### Files to Modify

1. `src/lib/types.ts`
   - Add additive session metadata for unresolved linked agent references.

2. `src/lib/errors.ts`
   - Add a dedicated ambiguity error for duplicate direct agent lookups.

3. `src/lib/parser.ts`
   - Extract explicit agent-link evidence from main-session raw entries.

4. `src/lib/platform.ts`
   - Add helpers for recursive discovery and nested-owner path parsing.

5. `src/lib/session.ts`
   - Implement recursive session discovery, precise per-session link resolution, unresolved-reference tracking, and ambiguity-safe direct lookup.

6. `src/lib/export.ts`
   - Include unresolved linked references in exported session metadata.

7. `src/lib/index.ts`
   - Re-export new metadata/error types.

8. `src/cli/commands/view.ts`
   - Clarify accepted identifiers and surface ambiguity errors distinctly from not-found errors.

9. `src/cli/formatters/session.ts`
   - Display linked and unresolved agent metadata in human-readable session detail output.

10. `tests/...`
    - Add nested, conflicting, unresolved, duplicate-ID, contract, round-trip, and performance coverage while retaining flat-agent regression tests.

## Performance Considerations

- Recursive discovery adds directory traversal depth but remains bounded by local project trees under `~/.claude/projects/`.
- Link resolution remains linear in the number of entries in the target main session file and the number of discovered agent transcripts in the same project.
- The acceptance target is under 1 second for both session listing and direct session lookup over fixture sets containing at least 100 sessions.

## Open Uncertainty Managed by Design

- Claude session histories may represent agent-link evidence in more than one raw entry shape.
- The design mitigates this by preferring explicit agent references when available, then falling back to nested ownership only when reference data is missing or incomplete.
- If additional Claude raw formats are observed later, they can extend the explicit-reference extractor without changing the higher-level linkage contract.
