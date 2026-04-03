# claude-code-history Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-01

## Active Technologies
- TypeScript 5.x with strict mode enabled, running on Node.js 20+ + Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`) (008-agent-session-linking)
- Local Claude Code JSONL session files under `~/.claude/projects/`, including both flat `agent-*.jsonl` files and nested `<main-session>/subagents/agent-*.jsonl` files (008-agent-session-linking)

- TypeScript 5.x with strict mode enabled + Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`) (007-support-progress-messages)

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
- 008-agent-session-linking: Added TypeScript 5.x with strict mode enabled, running on Node.js 20+ + Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`)

- 007-support-progress-messages: Added TypeScript 5.x with strict mode enabled + Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
