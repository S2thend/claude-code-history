# Quickstart: Enhanced List Command with Project Details

**Branch**: `004-list-project-details` | **Date**: 2025-01-18

## Overview

This feature enhances `cch list` to show full project paths and git branch names, making it easier to identify sessions when working across multiple projects.

## Before & After

### Before (current)
```
 IDX  TIMESTAMP             PROJECT                       SUMMARY                                   MSGS
────  ────────────────────  ────────────────────────────  ────────────────────────────────────────  ─────
   0  2025-01-18 14:30:00   backend                       Fix authentication bug                       15
   1  2025-01-18 12:15:00   backend                       Implement login flow                         42
```

### After (with this feature)
```
 IDX  TIMESTAMP             PATH                            BRANCH           SUMMARY                         MSGS
────  ────────────────────  ──────────────────────────────  ───────────────  ──────────────────────────────  ─────
   0  2025-01-18 14:30:00   …/work/client-a/backend         main             Fix authentication bug              15
   1  2025-01-18 12:15:00   …/work/client-b/backend         feature/auth     Implement login flow                42
```

## Files to Modify

### 1. `src/lib/types.ts`
Add `gitBranch` field to `SessionSummary` interface:
```typescript
export interface SessionSummary {
  // ... existing fields ...
  gitBranch: string | null;  // ADD THIS
}
```

### 2. `src/lib/session.ts`
Update `buildSessionSummary()` to include gitBranch:
```typescript
return {
  id: info.id,
  projectPath: info.projectPath,
  gitBranch: metadata.gitBranch,  // ADD THIS
  summary: metadata.summary,
  // ... rest unchanged
};
```

### 3. `src/cli/formatters/table.ts`
- Update `COLUMN_WIDTHS` to add BRANCH and adjust widths
- Remove `getProjectName()` helper (no longer needed)
- Update `formatSessionTable()` to show PATH and BRANCH columns
- Add `truncatePath()` helper for left-truncation of paths

### 4. Tests
Update test fixtures to include `gitBranch` in mock data.

## Verification

```bash
# Build and test
npm run build
npm test

# Manual verification
cch list                    # Check table output shows PATH and BRANCH
cch list --json | jq '.'    # Verify gitBranch field in JSON
```

## Key Implementation Notes

1. **gitBranch source**: Already extracted in `parseSessionMetadata()` - just pass through to SessionSummary
2. **Path truncation**: Truncate from left, preserve project name (end of path)
3. **Missing branch**: Display `-` in table, `null` in JSON
4. **No new dependencies**: Uses existing infrastructure
