/**
 * Export functionality for claude-code-history library.
 *
 * Provides functions to export sessions to JSON and Markdown formats.
 */

import type {
  LibraryConfig,
  Session,
  Message,
  UserMessage,
  AssistantMessage,
  AssistantContent,
  ToolResultContent,
} from './types.js';
import { resolveConfig } from './config.js';
import { getSession, listSessions } from './session.js';

// =============================================================================
// JSON Export
// =============================================================================

/**
 * Export a session to formatted JSON string.
 *
 * @param sessionId - Session ID or index to export
 * @param config - Optional configuration
 * @returns Formatted JSON string
 *
 * @example
 * ```typescript
 * const json = await exportSessionToJson(0);
 * await writeFile('session.json', json);
 * ```
 */
export async function exportSessionToJson(
  sessionId: string | number,
  config?: LibraryConfig
): Promise<string> {
  const resolved = resolveConfig(config);
  const session = await getSession(sessionId, {
    dataPath: resolved.dataPath,
    workspace: resolved.workspace,
  });

  return JSON.stringify(session, null, 2);
}

/**
 * Export all sessions to JSON.
 *
 * @param config - Optional configuration for filtering
 * @returns JSON string containing array of all sessions
 */
export async function exportAllSessionsToJson(config?: LibraryConfig): Promise<string> {
  const resolved = resolveConfig(config);

  const sessionsResult = await listSessions({
    dataPath: resolved.dataPath,
    workspace: resolved.workspace,
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0,
  });

  const sessions: Session[] = [];

  for (const summary of sessionsResult.data) {
    try {
      const session = await getSession(summary.id, {
        dataPath: resolved.dataPath,
      });
      sessions.push(session);
    } catch {
      // Skip sessions that fail to load
      continue;
    }
  }

  return JSON.stringify(sessions, null, 2);
}

// =============================================================================
// Markdown Export
// =============================================================================

/**
 * Format user message content for markdown.
 */
function formatUserContent(content: string | ToolResultContent[]): string {
  if (typeof content === 'string') {
    return content;
  }

  // Tool results
  const parts: string[] = [];
  for (const result of content) {
    parts.push(
      `<details>\n<summary>Tool Result (${result.tool_use_id})</summary>\n\n\`\`\`\n${result.content}\n\`\`\`\n\n</details>`
    );
  }
  return parts.join('\n\n');
}

/**
 * Format assistant content for markdown.
 */
function formatAssistantContent(content: AssistantContent[]): string {
  const parts: string[] = [];

  for (const block of content) {
    switch (block.type) {
      case 'text':
        parts.push(block.text);
        break;

      case 'thinking':
        parts.push(`<details>\n<summary>💭 Thinking</summary>\n\n${block.thinking}\n\n</details>`);
        break;

      case 'tool_use': {
        const inputStr = JSON.stringify(block.input, null, 2);
        parts.push(
          `<details>\n<summary>🔧 Tool: ${block.name}</summary>\n\n**Input:**\n\`\`\`json\n${inputStr}\n\`\`\`\n\n</details>`
        );
        break;
      }
    }
  }

  return parts.join('\n\n');
}

/**
 * Format a single message for markdown.
 */
function formatMessageMarkdown(message: Message): string | null {
  switch (message.type) {
    case 'user': {
      const userMsg = message as UserMessage;
      const content = formatUserContent(userMsg.content);
      return `## 👤 User\n\n${content}`;
    }

    case 'assistant': {
      const assistantMsg = message as AssistantMessage;
      const content = formatAssistantContent(assistantMsg.content);
      const model = assistantMsg.model ? ` (${assistantMsg.model})` : '';
      return `## 🤖 Assistant${model}\n\n${content}`;
    }

    case 'summary':
      // Skip summary in message output (it's in the header)
      return null;

    case 'file-history-snapshot':
      // Skip file history snapshots
      return null;
  }
}

/**
 * Format session metadata header for markdown.
 */
function formatSessionHeader(session: Session): string {
  const lines: string[] = [
    `# ${session.summary ?? 'Untitled Session'}`,
    '',
    '| Property | Value |',
    '|----------|-------|',
    `| Session ID | \`${session.id}\` |`,
    `| Project | \`${session.projectPath}\` |`,
    `| Started | ${session.timestamp.toISOString()} |`,
    `| Last Activity | ${session.lastActivityAt.toISOString()} |`,
    `| Messages | ${session.messageCount} |`,
  ];

  if (session.gitBranch) {
    lines.push(`| Git Branch | \`${session.gitBranch}\` |`);
  }

  if (session.version) {
    lines.push(`| Claude Code Version | ${session.version} |`);
  }

  if (session.agentIds.length > 0) {
    lines.push(`| Agent Sessions | ${session.agentIds.join(', ')} |`);
  }

  lines.push('', '---', '');

  return lines.join('\n');
}

/**
 * Export a session to Markdown format.
 *
 * @param sessionId - Session ID or index to export
 * @param config - Optional configuration
 * @returns Formatted Markdown string
 *
 * @example
 * ```typescript
 * const markdown = await exportSessionToMarkdown(0);
 * await writeFile('session.md', markdown);
 * ```
 */
export async function exportSessionToMarkdown(
  sessionId: string | number,
  config?: LibraryConfig
): Promise<string> {
  const resolved = resolveConfig(config);
  const session = await getSession(sessionId, {
    dataPath: resolved.dataPath,
    workspace: resolved.workspace,
  });

  const parts: string[] = [formatSessionHeader(session)];

  for (const message of session.messages) {
    const formatted = formatMessageMarkdown(message);
    if (formatted) {
      parts.push(formatted);
    }
  }

  return parts.join('\n\n');
}

/**
 * Export all sessions to Markdown.
 *
 * Each session is separated by a horizontal rule.
 *
 * @param config - Optional configuration for filtering
 * @returns Markdown string containing all sessions
 */
export async function exportAllSessionsToMarkdown(config?: LibraryConfig): Promise<string> {
  const resolved = resolveConfig(config);

  const sessionsResult = await listSessions({
    dataPath: resolved.dataPath,
    workspace: resolved.workspace,
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0,
  });

  const sessionMarkdowns: string[] = [];

  for (const summary of sessionsResult.data) {
    try {
      const markdown = await exportSessionToMarkdown(summary.id, {
        dataPath: resolved.dataPath,
      });
      sessionMarkdowns.push(markdown);
    } catch {
      // Skip sessions that fail to export
      continue;
    }
  }

  return sessionMarkdowns.join('\n\n---\n\n');
}

// =============================================================================
// Convenience Types
// =============================================================================

/** Export format options */
export type ExportFormat = 'json' | 'markdown';

/**
 * Export a session to the specified format.
 *
 * @param sessionId - Session ID or index
 * @param format - Export format ('json' or 'markdown')
 * @param config - Optional configuration
 * @returns Formatted string in the specified format
 */
export async function exportSession(
  sessionId: string | number,
  format: ExportFormat,
  config?: LibraryConfig
): Promise<string> {
  switch (format) {
    case 'json':
      return exportSessionToJson(sessionId, config);
    case 'markdown':
      return exportSessionToMarkdown(sessionId, config);
  }
}

/**
 * Export all sessions to the specified format.
 *
 * @param format - Export format ('json' or 'markdown')
 * @param config - Optional configuration
 * @returns Formatted string in the specified format
 */
export async function exportAllSessions(
  format: ExportFormat,
  config?: LibraryConfig
): Promise<string> {
  switch (format) {
    case 'json':
      return exportAllSessionsToJson(config);
    case 'markdown':
      return exportAllSessionsToMarkdown(config);
  }
}
