# Data Model: Enhanced List Command with Project Details

**Branch**: `004-list-project-details` | **Date**: 2025-01-18

## Entity Changes

### SessionSummary (Modified)

**Location**: `src/lib/types.ts`

**Current Definition**:
```typescript
interface SessionSummary {
  id: string;
  projectPath: string;
  summary: string | null;
  timestamp: Date;
  lastActivityAt: Date;
  messageCount: number;
  agentIds: string[];
}
```

**Updated Definition**:
```typescript
interface SessionSummary {
  id: string;
  projectPath: string;
  gitBranch: string | null;  // NEW FIELD
  summary: string | null;
  timestamp: Date;
  lastActivityAt: Date;
  messageCount: number;
  agentIds: string[];
}
```

**Field Details**:

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `gitBranch` | `string \| null` | Git branch at session start | `SessionMetadata.gitBranch` from parser |

**Validation Rules**:
- `null` when session has no recorded git branch
- Non-empty string when branch is available
- No transformation applied (raw value from session file)

## Data Flow

```
JSONL Session File
       │
       ▼
parseSessionMetadata()  ─────► SessionMetadata { gitBranch }
       │                              │
       ▼                              │
buildSessionSummary() ◄───────────────┘
       │
       ▼
SessionSummary { projectPath, gitBranch, ... }
       │
       ├──► formatSessionTable() ──► TABLE OUTPUT
       │         PATH column: projectPath (truncated)
       │         BRANCH column: gitBranch or "-"
       │
       └──► formatSessionsForJson() ──► JSON OUTPUT
                 Includes both fields directly
```

## Column Layout

### Table Output Format

```
 IDX  TIMESTAMP             PATH                            BRANCH           SUMMARY                         MSGS
────  ────────────────────  ──────────────────────────────  ───────────────  ──────────────────────────────  ─────
   0  2025-01-18 14:30:00   …/work/client-a/backend         main             Fix authentication bug              15
   1  2025-01-18 12:15:00   /home/user/project              feature/auth     Implement login flow                42
   2  2025-01-17 09:00:00   …/repos/api-server              -                Setup initial structure              8
```

### Column Widths

| Column | Width | Alignment | Truncation |
|--------|-------|-----------|------------|
| IDX | 4 | Right | None |
| TIMESTAMP | 20 | Left | None |
| PATH | 30 | Left | Left (preserve end) |
| BRANCH | 15 | Left | Right (standard) |
| SUMMARY | 30 | Left | Right (standard) |
| MSGS | 5 | Right | None |

**Total**: 104 characters + 10 separators = 114 characters (fits 120-col terminal)

## JSON Output Format

```json
{
  "success": true,
  "data": [
    {
      "index": 0,
      "id": "abc123-def456-...",
      "projectPath": "/home/user/work/client-a/backend",
      "gitBranch": "main",
      "summary": "Fix authentication bug",
      "timestamp": "2025-01-18T14:30:00.000Z",
      "lastActivityAt": "2025-01-18T15:45:00.000Z",
      "messageCount": 15,
      "agentIds": []
    }
  ],
  "pagination": { ... }
}
```

## Backward Compatibility

- **Library consumers**: Must handle new `gitBranch` field (always present, nullable)
- **JSON output consumers**: New field added; existing fields unchanged
- **Table output**: Column layout changed; scripts parsing table output may need updates
