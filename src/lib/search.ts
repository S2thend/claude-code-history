/**
 * Search functionality for claude-code-history library.
 *
 * Provides text search across all sessions with context.
 */

import type {
  LibraryConfig,
  SearchMatch,
  Message,
  AssistantContent,
  ToolResultContent,
  PaginatedResult,
} from './types.js';
import { resolveConfig, paginate, createPagination } from './config.js';
import { listSessions, getSession } from './session.js';

// =============================================================================
// Text Extraction
// =============================================================================

/**
 * Extract searchable text from assistant content.
 */
function extractAssistantText(content: AssistantContent[]): string[] {
  const texts: string[] = [];

  for (const block of content) {
    switch (block.type) {
      case 'text':
        texts.push(block.text);
        break;
      case 'thinking':
        texts.push(block.thinking);
        break;
      case 'tool_use':
        // Include tool name and stringified input for searchability
        texts.push(`Tool: ${block.name}`);
        texts.push(JSON.stringify(block.input));
        break;
    }
  }

  return texts;
}

/**
 * Extract searchable text from user content.
 */
function extractUserText(content: string | ToolResultContent[]): string[] {
  if (typeof content === 'string') {
    return [content];
  }

  // Tool results
  return content.map((result) => result.content);
}

/**
 * Extract all searchable text from a message.
 */
function extractMessageText(message: Message): string[] {
  switch (message.type) {
    case 'user':
      return extractUserText(message.content);
    case 'assistant':
      return extractAssistantText(message.content);
    case 'summary':
      return [message.summary];
    case 'file-history-snapshot':
      // Not searchable
      return [];
  }
}

// =============================================================================
// Context Extraction
// =============================================================================

/**
 * Extract context lines around a match.
 * @param text - Full text to search in
 * @param matchIndex - Character index of match start
 * @param contextLines - Number of lines before/after to include
 * @returns Array of context lines and line number of match
 */
function extractContext(
  text: string,
  matchIndex: number,
  contextLines: number
): { context: string[]; lineNumber: number } {
  const lines = text.split('\n');
  let charCount = 0;
  let matchLineIndex = 0;

  // Find which line contains the match
  for (let i = 0; i < lines.length; i++) {
    const lineLength = (lines[i]?.length ?? 0) + 1; // +1 for newline
    if (charCount + lineLength > matchIndex) {
      matchLineIndex = i;
      break;
    }
    charCount += lineLength;
  }

  // Extract context lines
  const startLine = Math.max(0, matchLineIndex - contextLines);
  const endLine = Math.min(lines.length - 1, matchLineIndex + contextLines);

  const context = lines.slice(startLine, endLine + 1);

  return {
    context,
    lineNumber: matchLineIndex + 1, // 1-based line number
  };
}

// =============================================================================
// Search Implementation
// =============================================================================

/**
 * Search for matches within a single message.
 */
function searchInMessage(
  message: Message,
  query: string,
  sessionId: string,
  sessionSummary: string | null,
  projectPath: string,
  contextLines: number
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lowerQuery = query.toLowerCase();

  // Only search user and assistant messages
  if (message.type !== 'user' && message.type !== 'assistant') {
    return matches;
  }

  const textBlocks = extractMessageText(message);

  for (const text of textBlocks) {
    const lowerText = text.toLowerCase();
    let searchIndex = 0;

    // Find all occurrences
    while (true) {
      const matchIndex = lowerText.indexOf(lowerQuery, searchIndex);
      if (matchIndex === -1) break;

      // Extract the actual matched text (preserving case)
      const matchedText = text.slice(matchIndex, matchIndex + query.length);

      // Extract context
      const { context, lineNumber } = extractContext(text, matchIndex, contextLines);

      matches.push({
        sessionId,
        sessionSummary,
        projectPath,
        messageUuid: message.uuid,
        messageType: message.type,
        match: matchedText,
        context,
        lineNumber,
      });

      searchIndex = matchIndex + 1;
    }
  }

  return matches;
}

/**
 * Search across all sessions for a query string.
 *
 * Performs case-insensitive substring search across all message content.
 * Returns matches with surrounding context lines.
 *
 * @param query - Search query (case-insensitive)
 * @param config - Optional configuration for context lines and pagination
 * @returns Paginated list of search matches
 *
 * @example
 * ```typescript
 * // Basic search
 * const results = await searchSessions('TypeScript');
 *
 * // Search with more context
 * const results = await searchSessions('error', { context: 5 });
 *
 * // Search in specific workspace
 * const results = await searchSessions('bug', { workspace: '/my/project' });
 * ```
 */
export async function searchSessions(
  query: string,
  config?: LibraryConfig
): Promise<PaginatedResult<SearchMatch>> {
  const resolved = resolveConfig(config);

  if (!query || query.trim().length === 0) {
    return {
      data: [],
      pagination: createPagination(0, resolved),
    };
  }

  const allMatches: SearchMatch[] = [];

  // Get all sessions (without pagination to search all)
  const sessionsResult = await listSessions({
    dataPath: resolved.dataPath,
    workspace: resolved.workspace,
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0,
  });

  // Search each session
  for (const sessionSummary of sessionsResult.data) {
    try {
      const session = await getSession(sessionSummary.id, {
        dataPath: resolved.dataPath,
      });

      for (const message of session.messages) {
        const matches = searchInMessage(
          message,
          query,
          session.id,
          session.summary,
          session.projectPath,
          resolved.context
        );
        allMatches.push(...matches);
      }
    } catch {
      // Skip sessions that fail to parse
      continue;
    }
  }

  // Apply pagination to results
  const paginatedMatches = paginate(allMatches, resolved);

  return {
    data: paginatedMatches,
    pagination: createPagination(allMatches.length, resolved),
  };
}

/**
 * Search within a single session.
 *
 * @param sessionId - Session ID or index to search
 * @param query - Search query (case-insensitive)
 * @param config - Optional configuration
 * @returns Array of matches within the session
 */
export async function searchInSession(
  sessionId: string | number,
  query: string,
  config?: LibraryConfig
): Promise<SearchMatch[]> {
  const resolved = resolveConfig(config);

  if (!query || query.trim().length === 0) {
    return [];
  }

  const session = await getSession(sessionId, {
    dataPath: resolved.dataPath,
    workspace: resolved.workspace,
  });

  const matches: SearchMatch[] = [];

  for (const message of session.messages) {
    const messageMatches = searchInMessage(
      message,
      query,
      session.id,
      session.summary,
      session.projectPath,
      resolved.context
    );
    matches.push(...messageMatches);
  }

  return matches;
}
