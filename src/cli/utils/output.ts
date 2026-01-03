/**
 * CLI Output utilities
 *
 * Handles stdout/stderr output, JSON formatting, and command result structure.
 */

import type { Pagination } from '../../lib/index.js';
import {
  type CommandError,
  type CliError,
  ExitCode,
  toCliError,
  formatErrorHuman,
} from './errors.js';

/**
 * Pagination info for command results
 */
export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Standardized command result for JSON output
 */
export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: CommandError;
  pagination?: PaginationInfo;
}

/**
 * Convert lib Pagination to CLI PaginationInfo
 */
export function toPaginationInfo(pagination: Pagination): PaginationInfo {
  return {
    total: pagination.total,
    offset: pagination.offset,
    limit: pagination.limit,
    hasMore: pagination.hasMore,
  };
}

/**
 * Create a successful command result
 */
export function successResult<T>(
  data: T,
  pagination?: Pagination
): CommandResult<T> {
  return {
    success: true,
    data,
    ...(pagination && { pagination: toPaginationInfo(pagination) }),
  };
}

/**
 * Create a failed command result from an error
 */
export function errorResult(error: CliError): CommandResult<never> {
  return {
    success: false,
    error: error.toCommandError(),
  };
}

/**
 * Output content to stdout
 */
export function stdout(content: string): void {
  process.stdout.write(content);
  // Ensure newline at end if not present
  if (!content.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

/**
 * Output error to stderr
 */
export function stderr(content: string): void {
  process.stderr.write(content);
  if (!content.endsWith('\n')) {
    process.stderr.write('\n');
  }
}

/**
 * Output JSON to stdout
 */
export function outputJson<T>(result: CommandResult<T>): void {
  stdout(JSON.stringify(result, null, 2));
}

/**
 * Output result based on format preference
 *
 * @param result - Command result or formatted string
 * @param json - Whether to output as JSON
 * @param humanOutput - Human-readable string (used when json=false)
 */
export function output<T>(
  result: CommandResult<T>,
  json: boolean,
  humanOutput?: string
): void {
  if (json) {
    outputJson(result);
  } else if (humanOutput !== undefined) {
    stdout(humanOutput);
  } else if (result.data !== undefined) {
    // Fallback: stringify data if no human output provided
    stdout(JSON.stringify(result.data, null, 2));
  }
}

/**
 * Handle command error with appropriate output format
 *
 * @param error - The error that occurred
 * @param json - Whether to output as JSON
 * @returns Exit code for the error
 */
export function handleError(error: unknown, json: boolean): ExitCode {
  const cliError = toCliError(error);

  if (json) {
    outputJson(errorResult(cliError));
  } else {
    stderr(formatErrorHuman(cliError));
  }

  return cliError.exitCode;
}

/**
 * Format pagination hint for human output
 *
 * @param pagination - Pagination info
 * @param itemName - Name of items being paginated (e.g., "sessions", "matches")
 * @returns Human-readable pagination hint or empty string if not needed
 */
export function formatPaginationHint(
  pagination: PaginationInfo,
  itemName: string
): string {
  if (!pagination.hasMore) {
    return '';
  }

  const start = pagination.offset + 1;
  const end = Math.min(pagination.offset + pagination.limit, pagination.total);

  return `\nShowing ${start}-${end} of ${pagination.total} ${itemName}. Use --offset to see more.`;
}
