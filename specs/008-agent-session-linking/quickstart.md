# Quickstart: Agent Session Linking

**Feature**: 008-agent-session-linking  
**Date**: 2026-04-02

## Overview

This guide maps the agent-session-linking feature onto the existing Claude Code History codebase so implementation can proceed without re-discovering the current discovery and lookup limitations.

## What We’re Building

Support for nested Claude child-agent transcripts so they:

- are discovered even when stored under `<main-session>/subagents/`,
- link back only to the main session that actually spawned them,
- surface unresolved referenced agent IDs separately from usable linked agent IDs,
- open through direct library and CLI lookup by agent identifier,
- and fail safely when duplicate agent IDs make direct lookup ambiguous.

## Key Files To Modify

| File | Purpose | Planned Change |
|------|---------|----------------|
| `src/lib/types.ts` | Public session types | Add `unresolvedAgentIds` to summary/session metadata |
| `src/lib/errors.ts` | Library error model | Add ambiguity error and type guard for duplicate agent lookups |
| `src/lib/platform.ts` | Path helpers | Add recursive discovery helpers and nested-owner path parsing |
| `src/lib/parser.ts` | Raw JSONL inspection | Extract explicit child-agent reference evidence from main-session entries |
| `src/lib/session.ts` | Discovery and lookup | Replace flat discovery with recursive discovery, resolve per-session links, surface unresolved refs, and support direct agent lookup |
| `src/lib/export.ts` | Export fidelity | Include unresolved referenced agent IDs in Markdown/JSON export metadata |
| `src/lib/index.ts` | Public API surface | Re-export additive types and ambiguity error helpers |
| `src/cli/commands/view.ts` | View command | Accept/document agent identifiers and handle ambiguity errors distinctly |
| `src/cli/formatters/session.ts` | Detail rendering | Show linked and unresolved agent metadata in human-readable session views |
| `tests/integration/list-sessions.test.ts` | Session summaries | Verify nested linking, fallback behavior, and main-session-only list rows |
| `tests/integration/get-session.test.ts` | Session retrieval | Verify direct lookup by bare/prefixed agent ID, nested discovery, unresolved refs, and ambiguity handling |
| `tests/integration/export-sessions.test.ts` | Export surfaces | Verify linked and unresolved agent metadata are preserved |
| `tests/integration/cli/view.test.ts` | CLI view flow | Verify direct child-agent lookup, usage/help text, and ambiguity messaging |
| `tests/unit/platform.test.ts` | Path parsing | Verify nested owner extraction and recursive session file handling |
| `tests/unit/parser.test.ts` | Raw reference parsing | Verify explicit agent reference extraction and fallback conditions |
| `tests/unit/session.test.ts` | Resolution rules | Verify precedence, unresolved references, and duplicate-ID behavior |

## Suggested Implementation Order

### Step 1: Extend Discovery Metadata

- Add internal discovery context for flat vs nested agent transcripts.
- Implement recursive file discovery beneath each Claude project directory.
- Keep existing flat `agent-*.jsonl` handling intact.

### Step 2: Extract Link Evidence

- Parse main-session raw entries for explicit child-agent identifiers.
- Separate discoverable linked child agents from unresolved referenced IDs.
- Apply fallback path ownership only when explicit data is missing or incomplete.

### Step 3: Update Direct Lookup Semantics

- Let direct lookup accept both bare agent IDs and `agent-<id>` form.
- Return the matching child transcript when unique.
- Raise a dedicated ambiguity error when duplicate agent IDs exist.

### Step 4: Surface Metadata in CLI and Exports

- Keep `cch list` human-readable output focused on main-session rows.
- Expose `agentIds` and `unresolvedAgentIds` in JSON summaries and session detail/export metadata.
- Update `cch view` usage/help text and ambiguity error handling.

### Step 5: Lock Behavior With Regression Tests

- Add nested fixture trees under `tests` with:
  - explicit main-session references,
  - missing child transcripts,
  - fallback-only nested ownership,
  - explicit-vs-path conflicts,
  - duplicate agent IDs,
  - legacy flat agent files.

## Example Synthetic Fixture Tree

```text
projects/
└── -test-project/
    ├── 11111111-1111-1111-1111-111111111111.jsonl
    ├── agent-flat123.jsonl
    └── 11111111-1111-1111-1111-111111111111/
        └── subagents/
            ├── agent-nested456.jsonl
            └── agent-duplicate999.jsonl
```

## Example Main Session Evidence

Use a main-session raw entry set that includes:

- an explicit child-agent reference for `nested456`,
- a missing referenced child-agent ID such as `missing777`,
- and, in a separate conflict fixture, explicit evidence that disagrees with a nested path so the explicit reference remains authoritative.

## Verification Commands

```bash
npm run typecheck
npm test
node dist/cli/index.js --data-path <test-data-dir> list --json
node dist/cli/index.js --data-path <test-data-dir> view nested456 --full
node dist/cli/index.js --data-path <test-data-dir> view duplicate999 --full
```

## Expected Outcomes

- Nested child-agent transcripts become discoverable through the library.
- Main sessions expose only their true child-agent links.
- Missing child transcripts appear as unresolved references instead of broken linked IDs.
- Direct child-agent lookup works through both library and CLI when unique.
- Duplicate agent-ID lookup returns ambiguity instead of an arbitrary transcript.
- Legacy flat agent-session behavior continues to pass regression tests.
