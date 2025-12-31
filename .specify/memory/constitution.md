# Claude Code History CLI Constitution

<!--
Sync Impact Report:
- Version change: 0.0.0 → 1.0.0
- Modified principles: N/A (initial creation)
- Added sections: All (Core Principles, Technical Standards, Development Workflow, Governance)
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (compatible - no changes needed)
  - .specify/templates/spec-template.md ✅ (compatible - no changes needed)
  - .specify/templates/tasks-template.md ✅ (compatible - no changes needed)
- Follow-up TODOs: None
-->

## Core Principles

### I. CLI-First Design

Every feature MUST be accessible through a well-designed command-line interface.

- Commands follow the pattern: `cch <command> [subcommand] [options]`
- Text in/out protocol: arguments and stdin for input, stdout for results, stderr for errors
- Support both human-readable (default) and JSON (`--json`) output formats for all commands
- Exit codes MUST be meaningful: 0 for success, non-zero for specific error categories
- Help text MUST be comprehensive and accessible via `--help` for every command

**Rationale**: CLI tools excel when they can be composed with other tools and automated in scripts.

### II. Non-Destructive Operations

All operations on Claude Code history data MUST be non-destructive by default.

- Read operations (list, show, search, export) MUST NOT modify source data
- Write operations (migrate, backup) MUST copy data, never move or delete originals
- Any destructive operation MUST require explicit `--force` or `--destructive` flag
- Backup operations MUST verify integrity before reporting success

**Rationale**: Users' conversation history is valuable and irreplaceable. Safety is non-negotiable.

### III. Cross-Platform Compatibility

The tool MUST work consistently across macOS, Windows, and Linux.

- Use platform-agnostic path handling (no hardcoded path separators)
- Auto-detect Claude Code data directory per platform:
  - macOS/Linux: `~/.claude/`
  - Windows: `%USERPROFILE%\.claude\`
- Test on all three platforms before release
- Document any platform-specific behaviors explicitly

**Rationale**: Claude Code users exist across all major platforms; the tool must serve them all.

### IV. Library-First Architecture

Core functionality MUST be implemented as a library, with CLI as a consumer.

- `src/lib/` contains all business logic (parsing, searching, exporting)
- `src/cli/` contains only command parsing and output formatting
- Library functions MUST be independently importable and usable programmatically
- Library MUST NOT depend on CLI; CLI depends on library

**Rationale**: Enables future integrations (VS Code extension, web UI, other CLIs) without rewriting core logic.

### V. Data Fidelity

Exported and migrated data MUST preserve complete fidelity to the original.

- All message fields, metadata, and relationships MUST be preserved
- Agent/subagent session relationships MUST be maintained in exports
- Tool use details (inputs, outputs, timing) MUST be fully captured
- Round-trip test: export → re-import MUST produce identical data

**Rationale**: History data is structured and relational; lossy exports defeat the purpose.

## Technical Standards

### Language & Runtime

- **Language**: TypeScript 5.x with strict mode enabled
- **Runtime**: Node.js 20+ (LTS)
- **Package Manager**: npm (for widest compatibility)
- **Build**: TypeScript compiler (tsc) with ES modules output

### Code Quality

- ESLint with TypeScript rules enforced
- Prettier for consistent formatting
- No `any` types unless explicitly justified with `// eslint-disable-next-line` comment
- All public APIs MUST have JSDoc documentation

### Testing

- Vitest for unit and integration testing
- Minimum 80% code coverage for library code
- Contract tests for JSONL parsing (validate against real Claude Code data structures)
- Integration tests for CLI commands using actual (anonymized) test fixtures

### Dependencies

- Minimize external dependencies; prefer Node.js built-ins
- Required dependencies MUST be justified
- No dependencies with security vulnerabilities (audit on every CI run)
- Pin exact versions in package.json

## Development Workflow

### Git Conventions

- Branch naming: `<type>/<short-description>` (e.g., `feat/search-command`, `fix/windows-paths`)
- Commit messages follow Conventional Commits specification
- PRs require passing CI checks and code review
- Main branch is always deployable

### Release Process

- Semantic versioning (MAJOR.MINOR.PATCH)
- CHANGELOG.md maintained with every release
- npm publish for distribution
- GitHub Releases for tagged versions

### Documentation

- README.md with installation, quick start, and command reference
- `--help` output as the canonical command documentation
- Examples directory with common use cases
- Contributing guide for external contributors

## Governance

This constitution establishes the foundational principles and standards for the Claude Code History CLI project. All implementation decisions, code reviews, and feature proposals MUST align with these principles.

### Amendment Process

1. Propose amendment via GitHub Issue or PR
2. Document rationale and impact on existing code
3. Update constitution version according to semver rules
4. Propagate changes to affected templates and documentation

### Compliance

- All PRs MUST pass constitution check before merge
- Code reviewers MUST verify principle alignment
- Complexity additions require explicit justification in PR description

**Version**: 1.0.0 | **Ratified**: 2025-12-31 | **Last Amended**: 2025-12-31
