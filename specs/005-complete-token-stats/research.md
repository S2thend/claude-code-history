# Research: Complete Token Statistics

**Feature**: 005-complete-token-stats
**Date**: 2026-01-30

## Research Questions

### Q1: Does the core library correctly extract all four token fields?

**Decision**: Yes, verified.

**Evidence**:
- `src/lib/types.ts` lines 228-233 define `TokenUsage` with all four fields:
  ```typescript
  export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  }
  ```
- `src/lib/parser.ts` lines 110-117 correctly transforms raw JSONL to typed interface:
  ```typescript
  function transformTokenUsage(raw: RawTokenUsage | undefined): TokenUsage {
    return {
      inputTokens: raw?.input_tokens ?? 0,
      outputTokens: raw?.output_tokens ?? 0,
      cacheCreationInputTokens: raw?.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: raw?.cache_read_input_tokens ?? 0,
    };
  }
  ```
- Test fixture `tests/fixtures/sample-session.jsonl` contains all four fields in usage objects
- Unit test `tests/unit/parser.test.ts` lines 129-159 validates token parsing

**Alternatives considered**: None needed - implementation is correct.

---

### Q2: Where should token aggregation logic live?

**Decision**: New `src/lib/stats.ts` module.

**Rationale**:
- Constitution Principle IV requires library-first architecture
- Aggregation is business logic, not display formatting
- Keeps `session.ts` focused on discovery/retrieval
- Allows independent unit testing of aggregation functions
- CLI will import and call these functions, then format output

**Alternatives considered**:
- Add to `session.ts` - rejected: would bloat session module with unrelated concerns
- Add to `parser.ts` - rejected: parser is for JSONL transformation, not aggregation
- Add to CLI - rejected: violates library-first principle

---

### Q3: What's the best aggregation strategy for performance?

**Decision**: Single-pass aggregation over messages array.

**Rationale**:
- Messages are already loaded in memory when viewing a session
- O(n) single-pass sum is optimal
- No need for lazy/streaming - typical sessions have <1000 messages
- For `list --stats`, aggregate lazily only when flag is present

**Implementation**:
```typescript
export function aggregateTokenUsage(messages: Message[]): TokenUsage {
  return messages.reduce(
    (acc, msg) => {
      if (msg.type === 'assistant') {
        acc.inputTokens += msg.usage.inputTokens;
        acc.outputTokens += msg.usage.outputTokens;
        acc.cacheCreationInputTokens += msg.usage.cacheCreationInputTokens;
        acc.cacheReadInputTokens += msg.usage.cacheReadInputTokens;
      }
      return acc;
    },
    { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 }
  );
}
```

**Alternatives considered**:
- Per-message aggregation during parsing - rejected: unnecessary overhead when stats not needed
- Caching aggregates in session files - rejected: violates non-destructive principle

---

### Q4: How should token stats be displayed in CLI?

**Decision**: Footer summary after messages (per clarification session).

**Format for `cch view`**:
```
────────────────────────────────────────────────────────────────────────────────
Token Usage Summary
  Input tokens:          1,234
  Output tokens:         5,678
  Cache read tokens:    45,000
  Cache creation tokens: 2,500
  Total tokens:         54,412
────────────────────────────────────────────────────────────────────────────────
```

**Format for `cch list --stats` (aggregate)**:
- Add summary line after table showing totals across all listed sessions
- JSON output includes `statistics` object

**Rationale**:
- Footer mirrors typical CLI patterns (git, test runners)
- Doesn't interrupt message flow
- Works with paged output

---

### Q5: Should `SessionSummary` include token stats?

**Decision**: No, add optional stats via separate function.

**Rationale**:
- `listSessions()` is designed to be fast (metadata only)
- Loading full messages just for tokens would be slow
- Better to have explicit `getSessionStats()` or aggregate when needed
- `list --stats` can load sessions on-demand when flag is present

**Implementation approach**:
- Keep `SessionSummary` lean (no tokens)
- Add `computeSessionTokenStats(session: Session): TokenUsage` in lib
- CLI calls this when displaying session or with `--stats`

---

## Summary

| Question | Decision |
|----------|----------|
| Token extraction | Already correct in core |
| Aggregation location | New `src/lib/stats.ts` module |
| Aggregation strategy | Single-pass reduce over messages |
| Display location | Footer after messages |
| SessionSummary change | No - keep lean, aggregate on-demand |

All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design.
