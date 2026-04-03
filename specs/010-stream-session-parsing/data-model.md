# Data Model: Memory-Safe Session Listing and Detail Loading

**Feature**: 010-stream-session-parsing  
**Date**: 2026-04-03

## Entity: Session Summary

Compact listing record for one main session or one directly requested agent session.

### Fields

- `id: string` - Session UUID for main sessions or `agent-<id>` for agent transcripts.
- `projectPath: string` - Decoded workspace path for the session.
- `gitBranch: string | null` - First discovered branch metadata, if present.
- `summary: string | null` - Explicit Claude summary/title entry, if present.
- `preview: string | null` - Derived fallback text from the earliest user-authored string message, capped at 200 visible characters after trimming and whitespace normalization.
- `timestamp: Date` - Earliest user/assistant/progress message timestamp, falling back to file mtime when absent.
- `lastActivityAt: Date` - Latest user/assistant/progress message timestamp, falling back to file mtime when absent.
- `messageCount: number` - Count of user, assistant, and progress messages only.
- `agentIds: string[]` - Discoverable linked child-agent IDs for main sessions.
- `unresolvedAgentIds: string[]` - Referenced child-agent IDs whose transcripts are not discoverable.

### Validation Rules

- `messageCount` must never include `summary` or `file-history-snapshot` entries.
- `preview` must be `null` when no user-authored string message exists.
- `agentIds` and `unresolvedAgentIds` must be unique and sorted, and a given agent ID must not appear in both arrays for the same session.
- Existing `summary` semantics remain unchanged; fallback text must not overwrite authored titles.

## Entity: Session Detail

Full session object returned by `getSession()` and `getAgentSession()`.

### Fields

- Inherits all `Session Summary` fields, including `preview`.
- `encodedPath: string` - Encoded project directory name under `projects/`.
- `version: string` - First discovered Claude Code version string, or empty string when absent.
- `messages: Message[]` - Full ordered transcript preserving user, assistant, progress, summary, and file-history-snapshot messages.

### Validation Rules

- `messages` must preserve full content fidelity, original order, timestamps, IDs, parent IDs, tool inputs/results, and thinking blocks.
- Detail parsing must process each transcript source no more than once per request.
- Agent session details must return empty `agentIds` and `unresolvedAgentIds` arrays.

## Entity: Session Transcript

One JSONL file representing a main or agent session.

### Fields

- `filePath: string` - Absolute path to the transcript file.
- `storageLayout: 'flat' | 'nested'` - Agent transcript location style.
- `nestedOwnerSessionId: string | null` - Parent main-session ID inferred from nested agent paths.
- `modifiedTime: Date` - Filesystem mtime used for sorting and fallback timestamps.
- `entries: RawSessionEntry stream` - Parsed line stream consumed incrementally rather than retained as an array.

### Validation Rules

- Malformed non-empty JSON lines must produce warnings but must not stop parsing later valid lines.
- Unreadable transcript files may be skipped during discovery or fail the specific request, but must not corrupt unrelated sessions.

## Entity: Agent Link Analysis

Derived relationship data that links main sessions to discoverable or unresolved agent transcripts.

### Fields

- `explicitAgentIds: string[]` - Agent IDs discovered from explicit task/tool-result evidence inside a main session transcript.
- `nestedAgentIdsByOwner: Map<mainSessionId, Set<agentId>>` - Agent IDs inferred from nested `subagents/` ownership.
- `agentSessionsById: Map<agentId, SessionTranscript[]>` - Discoverable agent transcripts by bare agent ID.
- `explicitAgentOwners: Map<agentId, Set<mainSessionId>>` - Main sessions that explicitly reference each agent ID.

### Validation Rules

- Explicit references remain authoritative when nested-path ownership conflicts with another main session.
- Project co-location alone is not enough to link an agent transcript.
- Missing referenced agent IDs must be surfaced through `unresolvedAgentIds` instead of silently dropped.

## Entity: Session Scan Result (Internal)

Internal one-pass parser output used to avoid whole-file raw-entry materialization.

### Fields

- `messages?: Message[]` - Present for full-detail scans.
- `metadata: SessionMetadata` - Summary/title, version, branch, first/last timestamps, count, session IDs, and preview.
- `explicitAgentIds?: string[]` - Present for summary/link scans over main sessions.
- `warnings: ParseWarning[]` - Recoverable parse warnings collected during the scan.

### State Transitions

1. Start with empty scan state.
2. For each valid parsed transcript entry, update only the selected accumulators (`messages`, `metadata`, `explicitAgentIds`, `preview`).
3. Drop the raw entry object after the visitor callback returns.
4. Emit final scan result after the stream ends.
