/**
 * Search result formatter for CLI display
 *
 * Formats SearchMatch arrays into human-readable search results.
 */

import type { SearchMatch } from '../../lib/index.js';

/**
 * Get a short display name for the project path
 */
function getProjectName(projectPath: string): string {
  const parts = projectPath.split(/[/\\]/);
  return parts[parts.length - 1] || projectPath;
}

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format context lines with line numbers and highlighting
 */
function formatContext(
  context: string[],
  matchLineNumber: number,
  contextLines: number
): string {
  if (context.length === 0) {
    return '';
  }

  const lines: string[] = [];
  const startLine = Math.max(1, matchLineNumber - contextLines);

  for (let i = 0; i < context.length; i++) {
    const lineNum = startLine + i;
    const lineContent = context[i] ?? '';
    const isMatchLine = lineNum === matchLineNumber;
    const prefix = isMatchLine ? '>' : ' ';
    const lineNumStr = String(lineNum).padStart(4, ' ');

    // Truncate very long lines
    const displayContent = truncate(lineContent, 120);
    lines.push(`${prefix} ${lineNumStr} │ ${displayContent}`);
  }

  return lines.join('\n');
}

/**
 * Format a single search match
 */
function formatMatch(match: SearchMatch, contextLines: number): string {
  const lines: string[] = [];

  // Header: session info
  const project = getProjectName(match.projectPath);
  const summary = match.sessionSummary
    ? truncate(match.sessionSummary, 50)
    : '(no summary)';
  const role = match.messageType.toUpperCase();

  lines.push(`[${project}] ${summary}`);
  lines.push(`  Session: ${match.sessionId}`);
  lines.push(`  ${role} message, line ${match.lineNumber}`);
  lines.push('');

  // Context with the match highlighted
  const contextStr = formatContext(match.context, match.lineNumber, contextLines);
  if (contextStr) {
    lines.push(contextStr);
  }

  return lines.join('\n');
}

/**
 * Create a separator line
 */
function separator(): string {
  return '─'.repeat(80);
}

/**
 * Format search results for human-readable display
 *
 * @param matches - Array of search matches
 * @param query - The search query (for display)
 * @param contextLines - Number of context lines shown
 * @param pagination - Pagination info
 * @returns Formatted search results string
 */
export function formatSearchResults(
  matches: SearchMatch[],
  query: string,
  contextLines: number,
  pagination: { total: number; offset: number; limit: number; hasMore: boolean }
): string {
  if (matches.length === 0) {
    return `No matches found for "${query}".`;
  }

  const parts: string[] = [];

  // Header
  const showing =
    pagination.total > matches.length
      ? `Showing ${pagination.offset + 1}-${pagination.offset + matches.length} of ${pagination.total}`
      : `Found ${pagination.total}`;
  parts.push(`${showing} matches for "${query}":`);
  parts.push('');
  parts.push(separator());

  // Matches
  for (const match of matches) {
    parts.push('');
    parts.push(formatMatch(match, contextLines));
    parts.push('');
    parts.push(separator());
  }

  // Pagination hint
  if (pagination.hasMore) {
    parts.push('');
    parts.push(
      `Use --offset ${pagination.offset + pagination.limit} to see more results.`
    );
  }

  return parts.join('\n');
}

/**
 * Format search results for JSON output
 *
 * @param matches - Array of search matches
 * @param pagination - Pagination info
 * @returns Structured data for JSON serialization
 */
export function formatSearchResultsForJson(
  matches: SearchMatch[],
  pagination: { total: number; offset: number; limit: number; hasMore: boolean }
): { matches: SearchMatch[]; pagination: typeof pagination } {
  return {
    matches,
    pagination,
  };
}
