/**
 * Table formatter for session list display
 *
 * Formats SessionSummary arrays into human-readable tables.
 */

import type { SessionSummary } from '../../lib/index.js';

/**
 * Column widths for table display
 */
const COLUMN_WIDTHS = {
  idx: 4,
  timestamp: 20,
  project: 28,
  summary: 40,
  msgs: 5,
} as const;

/**
 * Truncate a string to a maximum length, adding ellipsis if needed
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
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
 * Extract just the project name from a full path
 */
function getProjectName(projectPath: string): string {
  // Get the last component of the path
  const parts = projectPath.split(/[/\\]/);
  return parts[parts.length - 1] || projectPath;
}

/**
 * Format session list as a table
 *
 * @param sessions - Array of session summaries
 * @param offset - Starting index offset for display
 * @returns Formatted table string
 */
export function formatSessionTable(
  sessions: SessionSummary[],
  offset: number = 0
): string {
  if (sessions.length === 0) {
    return 'No sessions found.';
  }

  const lines: string[] = [];

  // Header
  const header = [
    padLeft('IDX', COLUMN_WIDTHS.idx),
    padRight('TIMESTAMP', COLUMN_WIDTHS.timestamp),
    padRight('PROJECT', COLUMN_WIDTHS.project),
    padRight('SUMMARY', COLUMN_WIDTHS.summary),
    padLeft('MSGS', COLUMN_WIDTHS.msgs),
  ].join('  ');

  lines.push(header);

  // Separator
  const separator = [
    '─'.repeat(COLUMN_WIDTHS.idx),
    '─'.repeat(COLUMN_WIDTHS.timestamp),
    '─'.repeat(COLUMN_WIDTHS.project),
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
      padRight(
        truncate(getProjectName(session.projectPath), COLUMN_WIDTHS.project),
        COLUMN_WIDTHS.project
      ),
      padRight(
        truncate(getDisplaySummary(session), COLUMN_WIDTHS.summary),
        COLUMN_WIDTHS.summary
      ),
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
  offset: number = 0
): Array<SessionSummary & { index: number }> {
  return sessions.map((session, i) => ({
    index: offset + i,
    ...session,
  }));
}
