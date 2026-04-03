# Quickstart: Memory-Safe Session Listing and Detail Loading

**Feature**: 010-stream-session-parsing  
**Date**: 2026-04-03

## Overview

This guide maps the OOM fix onto the current codebase so implementation can proceed without re-deriving parser/session responsibilities.

## What We’re Building

- `listSessions()` uses a lightweight one-pass summary/link scan, returns top-level rows for both main and agent sessions, and exposes `SessionSummary.preview` for untitled-session fallback labels.
- `getSession()` and `getAgentSession()` derive messages and metadata in one transcript pass and no longer parse the same file twice.
- Parser internals stop accumulating a whole-file raw-entry array when callers only need derived summary or message state.
- `cch list` displays `summary ?? preview ?? '(No summary)'`, includes agent sessions as top-level rows, and uses no new flags.
- Large-fixture regression tests enforce the 512 MiB session-listing ceiling and protect the no-duplicate-parse invariant.

## Key Files To Modify

| File | Purpose | Planned Change |
|------|---------|----------------|
| `src/lib/parser.ts` | JSONL parsing, message transforms, metadata/link extraction | Add reusable one-pass scan helpers, bounded preview extraction, and combined detail parse output |
| `src/lib/session.ts` | Session listing, link analysis, and session retrieval orchestration | Use summary scans for listing/link context and one-pass full-detail parsing for `getSession()` / `getAgentSession()` |
| `src/lib/types.ts` | Public summary/detail types | Add additive `preview: string \| null` to `SessionSummary` |
| `src/cli/formatters/table.ts` | Human-readable `cch list` rendering | Fall back from `summary` to `preview` before `(No summary)` |
| `tests/unit/parser.test.ts` | Parser unit coverage | Validate preview extraction, summary scan metadata, one-pass detail scan behavior, and malformed-line recovery |
| `tests/unit/session.test.ts` | Session orchestration coverage | Validate summary/list behavior, preview propagation, and one-pass detail parser usage |
| `tests/integration/list-sessions.test.ts` | End-to-end listing behavior | Verify fallback previews appear in summaries, agent sessions are top-level rows, and malformed large sessions remain listable |
| `tests/integration/get-session.test.ts` | End-to-end detail retrieval | Verify full-fidelity messages and no duplicate transcript parsing per request |
| `tests/integration/performance/session-lookup.test.ts` | Performance regressions | Verify large-fixture listing stays at or below 512 MiB peak memory |
| `tests/unit/cli/formatters/table.test.ts` | CLI table fallback rendering | Verify `summary`, then 200-character `preview`, then `(No summary)` fallback behavior |

## Suggested Implementation Order

### Step 1: Introduce One-Pass Parser Primitives

- Add a parser helper that streams JSONL lines and invokes a visitor/accumulator for each valid `RawSessionEntry`.
- Build summary metadata, first-user preview, and explicit agent-link extraction on top of that helper.
- Build a full-detail parser that transforms messages and updates metadata in the same scan.
- Keep malformed non-empty lines recoverable by collecting parse warnings and continuing.

### Step 2: Rewire Session Listing and Detail Retrieval

- Replace `analyzeMainSessions()` and summary construction so listing uses one-pass summary/link scans rather than `parseJsonlFile()` plus whole-entry post-processing, and return both main and agent sessions as top-level rows.
- Replace `loadSessionRecord()` so one `getSession()` request reads its target transcript once and returns messages plus metadata from the same scan.
- Preserve current sorting, pagination, workspace filtering, agent-link resolution, and not-found/ambiguity semantics.

### Step 3: Expose Summary Preview Fallbacks

- Add `preview` to `SessionSummary` and inherit it in `Session`.
- Populate `preview` from the earliest user-authored string message, trim and normalize whitespace, and cap to 200 visible characters.
- Update `formatSessionTable()` to render explicit `summary`, then `preview`, then `(No summary)`.
- Keep `summary` semantics unchanged and treat `preview` as an additive fallback field only.

### Step 4: Lock Behavior With Tests

- Add parser/session tests that prove malformed records are skipped, preview extraction is bounded, and one-pass helpers produce the expected metadata and messages.
- Add instrumentation coverage proving one `getSession()` call does not trigger duplicate target-file parses.
- Add large synthetic fixture coverage proving `listSessions()` completes at or below 512 MiB peak memory and still returns all expected main/agent summary rows and agent links.
- Add baseline-vs-new fallback-fetch regression coverage proving at least 90% fewer full detail reads are needed for untitled-session preview rendering.
- Run the full existing validation suite to protect compatibility.

## Verification Commands

```bash
npm run typecheck
npm test
npm run lint
node dist/cli/index.js list
node dist/cli/index.js list --json
node dist/cli/index.js view 0 --json
```

## Expected Outcomes

- `listSessions()` returns compact summaries with fallback `preview` text and no longer requires whole-session raw-entry arrays per listed session.
- `getSession()` and `getAgentSession()` return full-fidelity messages and metadata while parsing each target transcript once.
- `cch list` shows useful labels for untitled sessions without opening the full transcript.
- Large malformed or oversized transcripts remain listable and inspectable without OOM under the agreed regression fixture.
