# claude-code-history Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-31

## Active Technologies
- TypeScript 5.x with strict mode (matching lib layer) + Commander.js (CLI framework), chalk (terminal colors - optional), existing `src/lib/` exports (002-cli-ui-layer)
- N/A (reads from Claude Code's `~/.claude/projects/` via lib layer) (002-cli-ui-layer)

- TypeScript 5.x with strict mode enabled + Node.js built-ins (fs, path, os, readline); minimal external deps (001-core-lib)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x with strict mode enabled: Follow standard conventions

## Recent Changes
- 002-cli-ui-layer: Added TypeScript 5.x with strict mode (matching lib layer) + Commander.js (CLI framework), chalk (terminal colors - optional), existing `src/lib/` exports

- 001-core-lib: Added TypeScript 5.x with strict mode enabled + Node.js built-ins (fs, path, os, readline); minimal external deps

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
