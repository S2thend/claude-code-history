/**
 * CLI Configuration utilities
 *
 * Handles global options, environment variables, and configuration resolution.
 */

import { LibraryConfig, getDefaultDataPath } from '../../lib/index.js';

/**
 * Environment variable names used by the CLI
 */
export const ENV_VARS = {
  DATA_PATH: 'CCH_DATA_PATH',
  NO_COLOR: 'NO_COLOR',
  PAGER: 'PAGER',
} as const;

/**
 * Global CLI options available to all commands
 */
export interface GlobalOptions {
  /** Custom Claude Code data directory */
  dataPath?: string;
  /** Output in JSON format instead of human-readable */
  json: boolean;
  /** Bypass pagination, output full content */
  full: boolean;
}

/**
 * Resolved configuration combining global options, env vars, and defaults
 */
export interface ResolvedCliConfig {
  dataPath: string;
  outputFormat: 'human' | 'json';
  paginate: boolean;
}

/**
 * Structured JSON error payload for direct agent lookup failures.
 */
export interface JsonLookupErrorResult {
  type: 'ambiguous-agent-id' | 'session-not-found';
  agentId: string;
  message: string;
}

/**
 * Resolve CLI configuration from global options, environment variables, and defaults.
 *
 * Priority order (highest to lowest):
 * 1. Command-line option (--data-path)
 * 2. Environment variable (CCH_DATA_PATH)
 * 3. Platform default (~/.claude/projects/)
 *
 * @param opts - Global options from command line
 * @returns Resolved configuration
 */
export function resolveConfig(opts: GlobalOptions): ResolvedCliConfig {
  const dataPath = opts.dataPath ?? process.env[ENV_VARS.DATA_PATH] ?? getDefaultDataPath();

  return {
    dataPath,
    outputFormat: opts.json ? 'json' : 'human',
    paginate: !opts.full,
  };
}

/**
 * Convert resolved CLI config to LibraryConfig for lib layer calls
 *
 * @param config - Resolved CLI configuration
 * @param overrides - Optional overrides for specific lib calls
 * @returns LibraryConfig compatible with lib layer functions
 */
export function toLibraryConfig(
  config: ResolvedCliConfig,
  overrides?: Partial<LibraryConfig>
): LibraryConfig {
  return {
    dataPath: config.dataPath,
    ...overrides,
  };
}

/**
 * Parse session reference from user input.
 * Accepts: numeric index (0, 1, 2...) or UUID string (partial or full)
 *
 * @param input - User-provided session identifier
 * @returns Numeric index if valid number >= 0, otherwise the string (treated as UUID)
 */
export function parseSessionRef(input: string): number | string {
  const trimmed = input.trim();
  const numericIndex = parseInt(trimmed, 10);

  // Only treat as numeric if it's a valid non-negative integer
  // and the entire string is numeric (not "123abc")
  if (!isNaN(numericIndex) && numericIndex >= 0 && /^\d+$/.test(trimmed)) {
    return numericIndex;
  }

  // Treat as UUID (lib layer will validate)
  return trimmed;
}

/**
 * Normalize a direct agent lookup identifier to its bare agent ID form.
 */
export function normalizeAgentLookupId(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith('agent-') ? trimmed.slice(6) : trimmed;
}

/**
 * Best-effort check for whether CLI input should be treated as a direct agent lookup.
 */
export function isDirectAgentLookupInput(input: string): boolean {
  const trimmed = input.trim();

  if (trimmed.startsWith('agent-')) {
    return true;
  }

  if (/^\d+$/.test(trimmed)) {
    return false;
  }

  return !trimmed.includes('-');
}

/**
 * Create a structured JSON error payload for direct agent lookup failures.
 */
export function createJsonLookupErrorResult(
  type: JsonLookupErrorResult['type'],
  input: string
): JsonLookupErrorResult {
  const agentId = normalizeAgentLookupId(input);

  return {
    type,
    agentId,
    message:
      type === 'ambiguous-agent-id'
        ? `Agent ID is ambiguous: ${agentId}`
        : `Session not found: ${agentId}`,
  };
}
