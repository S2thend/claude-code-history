/**
 * Table formatter for session list display
 *
 * Formats SessionSummary arrays into human-readable tables.
 */

import type { SessionSummary, AggregateTokenStats } from '../../lib/index.js';

/**
 * Column widths for table display
 */
const COLUMN_WIDTHS = {
  idx: 4,
  timestamp: 20,
  path: 30,
  branch: 15,
  summary: 30,
  msgs: 5,
} as const;

/**
 * Truncate a string to a maximum length, adding ellipsis if needed (right truncation)
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate a path from the left, preserving the end (project name)
 * Uses … (ellipsis character) as truncation indicator
 */
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) {
    return path;
  }
  // Keep the end of the path (project name is most important)
  return '…' + path.slice(-(maxLength - 1));
}

/**
 * Pad a string to a fixed width (right-aligned for numbers)
 */
function padLeft(str: string, width: number): string {
  return str.padStart(width);
}

/**
 * Pad a string to a fixed width (left-aligned for text)
 */
function padRight(str: string, width: number): string {
  return str.padEnd(width);
}

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get a display summary for a session.
 * Uses the session summary if available, otherwise uses first user message.
 */
function getDisplaySummary(session: SessionSummary): string {
  if (session.summary) {
    return session.summary;
  }
  // The lib layer should provide a fallback summary
  // For now, return a placeholder
  return '(No summary)';
}

/**
 * Format session list as a table
 *
 * @param sessions - Array of session summaries
 * @param offset - Starting index offset for display
 * @returns Formatted table string
 */
export function formatSessionTable(sessions: SessionSummary[], offset = 0): string {
  if (sessions.length === 0) {
    return 'No sessions found.';
  }

  const lines: string[] = [];

  // Header
  const header = [
    padLeft('IDX', COLUMN_WIDTHS.idx),
    padRight('TIMESTAMP', COLUMN_WIDTHS.timestamp),
    padRight('PATH', COLUMN_WIDTHS.path),
    padRight('BRANCH', COLUMN_WIDTHS.branch),
    padRight('SUMMARY', COLUMN_WIDTHS.summary),
    padLeft('MSGS', COLUMN_WIDTHS.msgs),
  ].join('  ');

  lines.push(header);

  // Separator
  const separator = [
    '─'.repeat(COLUMN_WIDTHS.idx),
    '─'.repeat(COLUMN_WIDTHS.timestamp),
    '─'.repeat(COLUMN_WIDTHS.path),
    '─'.repeat(COLUMN_WIDTHS.branch),
    '─'.repeat(COLUMN_WIDTHS.summary),
    '─'.repeat(COLUMN_WIDTHS.msgs),
  ].join('  ');

  lines.push(separator);

  // Rows
  for (const session of sessions) {
    const displayIndex = offset + sessions.indexOf(session);

    const row = [
      padLeft(String(displayIndex), COLUMN_WIDTHS.idx),
      padRight(formatDate(session.timestamp), COLUMN_WIDTHS.timestamp),
      padRight(truncatePath(session.projectPath, COLUMN_WIDTHS.path), COLUMN_WIDTHS.path),
      padRight(truncate(session.gitBranch ?? '-', COLUMN_WIDTHS.branch), COLUMN_WIDTHS.branch),
      padRight(truncate(getDisplaySummary(session), COLUMN_WIDTHS.summary), COLUMN_WIDTHS.summary),
      padLeft(String(session.messageCount), COLUMN_WIDTHS.msgs),
    ].join('  ');

    lines.push(row);
  }

  return lines.join('\n');
}

/**
 * Format session list for JSON output
 *
 * @param sessions - Array of session summaries
 * @param offset - Starting index offset
 * @returns Array of formatted session objects with index
 */
export function formatSessionsForJson(
  sessions: SessionSummary[],
  offset = 0
): (SessionSummary & { index: number })[] {
  return sessions.map((session, i) => ({
    index: offset + i,
    ...session,
  }));
}

/**
 * Format aggregate token statistics for display.
 * Uses toLocaleString() for locale-appropriate number formatting per FR-005.
 *
 * @param stats - Aggregated token statistics
 * @returns Formatted statistics string
 */
export function formatAggregateStats(stats: AggregateTokenStats): string {
  const separator = '─'.repeat(80);
  const lines = [
    separator,
    'Aggregate Token Statistics',
    `  Input tokens:          ${stats.inputTokens.toLocaleString()}`,
    `  Output tokens:         ${stats.outputTokens.toLocaleString()}`,
    `  Cache read tokens:     ${stats.cacheReadInputTokens.toLocaleString()}`,
    `  Cache creation tokens: ${stats.cacheCreationInputTokens.toLocaleString()}`,
    `  Total tokens:          ${stats.totalTokens.toLocaleString()}`,
    separator,
  ];

  return lines.join('\n');
}
