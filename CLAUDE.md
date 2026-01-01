# claude-code-history Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-31

## Active Technologies
- TypeScript 5.x with strict mode (matching lib layer) + Commander.js (CLI framework), chalk (terminal colors - optional), existing `src/lib/` exports (002-cli-ui-layer)
- N/A (reads from Claude Code's `~/.claude/projects/` via lib layer) (002-cli-ui-layer)

- TypeScript 5.x with strict mode enabled + Node.js built-ins (fs, path, os, readline); minimal external deps (001-core-lib)

## Project Structure

```text
src/
  cli/          # CLI UI layer
    commands/   # Command implementations (list, view, search, export, migrate)
    formatters/ # Output formatting (table, session, search)
    utils/      # Config, errors, output utilities
  lib/          # Core library layer
tests/
  integration/  # Integration tests
    cli/        # CLI integration tests
  unit/         # Unit tests
    cli/        # CLI unit tests
```

## Commands

npm test && npm run lint

## CLI Usage Examples

```bash
# List all sessions
cch list
cch list --workspace /path/to/project
cch list --limit 10 --offset 20
cch list --json

# View session content
cch view 0                    # By index (most recent)
cch view abc123-def456       # By UUID
cch view 0 --json            # JSON output

# Search across sessions
cch search "query"
cch search "error" --context 3
cch search "fix" --session 0  # Search within specific session
cch search "bug" --json

# Export sessions
cch export 0                      # Export to JSON (stdout)
cch export 0 --format markdown    # Export to Markdown
cch export 0 -o session.json      # Export to file
cch export --all -o all.json      # Export all sessions

# Migrate sessions
cch migrate 0 --destination /new/project
cch migrate 0,1,2 -D /new/project --mode move
cch migrate --all --source /old/project --destination /new/project

# Global options
cch --data-path /custom/path list    # Custom data directory
cch -j list                          # JSON output shorthand
cch -f view 0                        # Full output (no paging)
```

## Code Style

TypeScript 5.x with strict mode enabled: Follow standard conventions

## Recent Changes
- 002-cli-ui-layer: Added TypeScript 5.x with strict mode (matching lib layer) + Commander.js (CLI framework), chalk (terminal colors - optional), existing `src/lib/` exports

- 001-core-lib: Added TypeScript 5.x with strict mode enabled + Node.js built-ins (fs, path, os, readline); minimal external deps

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
