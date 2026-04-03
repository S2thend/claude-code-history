# Phase 0 Research: Memory-Safe Session Listing and Detail Loading

**Feature**: 010-stream-session-parsing  
**Date**: 2026-04-03

## Decision 1: Replace whole-file raw-entry accumulation with a one-pass session scanner

**Decision**: Introduce a reusable parser helper that reads one JSONL line at a time, parses it, and immediately forwards each valid `RawSessionEntry` to caller-provided accumulation logic instead of pushing every entry into a shared `entries[]` array. Build summary and full-detail parsers on top of that scanner so callers keep only their own aggregate state (`messages[]`, summary metadata, preview text, agent IDs, warnings).

**Rationale**: The current parser streams only at the I/O boundary but still retains the full raw object graph in memory. A one-pass scanner keeps line-by-line parsing and error recovery while making object lifetime explicit, which directly addresses the OOM path described in the spec.

**Alternatives considered**:
- Keep `parseJsonlFile()` returning `RawSessionEntry[]` and rely on garbage collection after transformation. Rejected because peak memory still includes all raw entries plus derived messages.
- Read each file into memory with `fs.readFile()` and parse a full buffer. Rejected because it worsens memory pressure on large transcripts.

## Decision 2: Parse `getSession()` detail and metadata in one pass

**Decision**: Replace the current parallel `parseSessionFile()` + `parseSessionMetadata()` workflow with a single detail parser that transforms messages and updates session metadata during the same transcript scan, returning one combined result per file.

**Rationale**: Parsing the same file twice concurrently can create two raw-entry aggregates and duplicate expensive JSON object graphs. A single-pass detail parser removes redundant work, lowers peak heap usage, and keeps full-fidelity `Session.messages` output.

**Alternatives considered**:
- Run metadata parse and full message parse sequentially instead of in parallel. Rejected because it still doubles file parsing and CPU work for every detail request.
- Keep the parallel approach but cache one parse result globally. Rejected because cache lifetime and invalidation add complexity and can retain large sessions longer than needed.

## Decision 3: Add a lightweight summary/link parser for `listSessions()`

**Decision**: Add a one-pass summary parser for main-session listing that extracts explicit titles, first/last activity timestamps, message counts, branch/version metadata, linked agent IDs, and a bounded fallback preview from the earliest user-authored string message. Use that parser in `analyzeMainSessions()` and summary construction instead of `parseJsonlFile()` + full-entry post-processing.

**Rationale**: `listSessions()` only needs compact summary fields and agent-link evidence for each row. Computing those fields incrementally avoids retaining complete transcripts for each listed session and eliminates the downstream need to open every untitled session just to derive fallback labels.

**Alternatives considered**:
- Continue deriving fallback preview text by calling `getSession()` from consumers. Rejected because that forces full-detail reads for many untitled sessions and reproduces OOM risk at the integration layer.
- Overwrite `summary` with fallback preview text when no explicit title exists. Rejected because it loses the distinction between authored titles and derived preview text.

## Decision 4: Expose fallback previews as an additive `SessionSummary.preview` field

**Decision**: Add `preview: string | null` to `SessionSummary`, inherited by `Session`, where `summary` remains the explicit title and `preview` is a bounded first-user fallback. Render `summary ?? preview ?? '(No summary)'` in `cch list` human-readable output and include `preview` in JSON list output.

**Rationale**: This preserves backward compatibility for existing consumers that rely on `summary`, gives downstream integrations the data needed to avoid full-detail fallback reads, and keeps title/preview semantics separate and explicit.

**Alternatives considered**:
- Rename or repurpose `summary` to hold either a title or preview. Rejected because it is behaviorally ambiguous and risks breaking consumers that distinguish authored summaries from derived text.
- Add preview data only to CLI output. Rejected because library consumers would still need `getSession()` for fallback labels.

## Decision 5: Bound preview text length during summary scans

**Decision**: Capture at most the first 200 visible characters of the earliest user-authored string message after trimming and whitespace normalization; return `null` when no user string message exists.

**Rationale**: A bounded preview prevents a single huge prompt from inflating every `SessionSummary`, while 200 characters is enough for fallback labels and aligns with existing display-preview scale elsewhere in the codebase.

**Alternatives considered**:
- Store the full first user message in `SessionSummary.preview`. Rejected because very large prompts would reintroduce summary-listing memory growth.
- Cap preview at the CLI table column width only. Rejected because JSON consumers need a more useful fallback string than a 30-column display snippet.

## Decision 6: Verify memory and one-pass behavior with dedicated regression tests

**Decision**: Add large synthetic JSONL fixtures and targeted instrumentation tests that prove `listSessions()` stays at or below 512 MiB peak memory on a high-volume fixture, `getSession()` scans its target transcript no more than once per request, malformed lines remain recoverable, and summary previews are available without per-session detail fetches.

**Rationale**: The bug is a performance and memory-lifetime regression class, so correctness tests alone are insufficient. Regression coverage must enforce the 512 MiB ceiling and protect the no-duplicate-parse invariant.

**Alternatives considered**:
- Rely on unit tests for parser output only. Rejected because they do not catch heap growth from large fixture shape or duplicate session scans in orchestration code.
- Measure memory informally during manual testing only. Rejected because the OOM risk can reappear silently without automated performance gates.
