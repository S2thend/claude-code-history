/**
 * Session formatter for detailed view display
 *
 * Formats Session objects into human-readable conversation view.
 * Tool calls are paired with their results for better readability.
 */

import type {
  Session,
  Message,
  UserMessage,
  AssistantMessage,
  AssistantContent,
  ToolUseContent,
  TextContent,
  ThinkingContent,
  ToolResultContent,
} from '../../lib/index.js';

/**
 * Map of tool_use_id to tool result content
 */
type ToolResultMap = Map<string, ToolResultContent>;

/**
 * Format a date for display
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format a full date for display
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} ${formatTime(date)}`;
}

/**
 * Format token usage for display
 */
function formatTokenUsage(usage: {
  inputTokens: number;
  outputTokens: number;
}): string {
  const total = usage.inputTokens + usage.outputTokens;
  return `[${total.toLocaleString()} tokens]`;
}

/**
 * Format tool result content with proper indentation
 */
function formatToolResult(result: ToolResultContent): string {
  const lines: string[] = [];

  // Add error indicator if applicable
  if (result.is_error) {
    lines.push('  ⚠ ERROR:');
  } else {
    lines.push('  → Result:');
  }

  // Format the content with indentation
  const content = result.content;
  if (content.length > 500) {
    // Truncate long results but show more than before
    const truncated = content.slice(0, 497) + '...';
    const indented = truncated.split('\n').map(line => '    ' + line).join('\n');
    lines.push(indented);
  } else {
    const indented = content.split('\n').map(line => '    ' + line).join('\n');
    lines.push(indented);
  }

  return lines.join('\n');
}

/**
 * Format tool use content with its result (if available)
 */
function formatToolUseWithResult(
  content: ToolUseContent,
  toolResults: ToolResultMap
): string {
  const lines: string[] = [];

  // Format the tool call
  const inputStr = JSON.stringify(content.input, null, 2);
  const truncatedInput =
    inputStr.length > 300 ? inputStr.slice(0, 297) + '...' : inputStr;

  lines.push(`[Tool: ${content.name}]`);

  // Add input parameters with indentation
  const indentedInput = truncatedInput.split('\n').map(line => '  ' + line).join('\n');
  lines.push(indentedInput);

  // Add the result if we have it
  const result = toolResults.get(content.id);
  if (result) {
    lines.push('');
    lines.push(formatToolResult(result));
  }

  return lines.join('\n');
}

/**
 * Format a single content item from assistant message
 */
function formatContentItem(
  item: AssistantContent,
  toolResults: ToolResultMap
): string {
  if (item.type === 'text') {
    return (item as TextContent).text;
  }

  if (item.type === 'tool_use') {
    return formatToolUseWithResult(item as ToolUseContent, toolResults);
  }

  if (item.type === 'thinking') {
    const thinking = (item as ThinkingContent).thinking;
    const preview =
      thinking.length > 100 ? thinking.slice(0, 97) + '...' : thinking;
    return `[Thinking] ${preview}`;
  }

  return '[Unknown content type]';
}

/**
 * Check if a user message is purely tool results
 */
function isToolResultMessage(msg: UserMessage): boolean {
  if (typeof msg.content === 'string') {
    return false;
  }
  if (!Array.isArray(msg.content)) {
    return false;
  }
  // Check if all content items are tool results
  return msg.content.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      'type' in item &&
      item.type === 'tool_result'
  );
}

/**
 * Format user message content (only for non-tool-result messages)
 */
function formatUserContent(content: string | ToolResultContent[]): string {
  if (typeof content === 'string') {
    return content;
  }

  // This shouldn't happen for regular user messages
  // Tool results are now handled separately
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (item.type === 'tool_result') {
          // Fallback formatting if we somehow get here
          const preview =
            item.content.length > 200
              ? item.content.slice(0, 197) + '...'
              : item.content;
          return `[Tool Result] ${preview}`;
        }
        return JSON.stringify(item);
      })
      .join('\n');
  }

  return String(content);
}

/**
 * Format a user message for display
 */
function formatUserMessage(msg: UserMessage): string {
  const time = formatTime(msg.timestamp);
  const content = formatUserContent(msg.content);
  return `[${time}] USER\n${content}`;
}

/**
 * Format an assistant message for display
 */
function formatAssistantMessage(
  msg: AssistantMessage,
  toolResults: ToolResultMap
): string {
  const time = formatTime(msg.timestamp);
  const model = msg.model || 'assistant';
  const tokens = formatTokenUsage(msg.usage);

  const contentParts = msg.content.map((item) =>
    formatContentItem(item, toolResults)
  );
  const content = contentParts.join('\n\n');

  return `[${time}] ASSISTANT (${model}) ${tokens}\n${content}`;
}

/**
 * Build a map of tool_use_id to tool results from all messages
 */
function buildToolResultMap(messages: Message[]): ToolResultMap {
  const map: ToolResultMap = new Map();

  for (const msg of messages) {
    if (msg.type === 'user') {
      const userMsg = msg as UserMessage;
      if (Array.isArray(userMsg.content)) {
        for (const item of userMsg.content) {
          if (item.type === 'tool_result') {
            map.set(item.tool_use_id, item);
          }
        }
      }
    }
  }

  return map;
}

/**
 * Create a separator line
 */
function separator(): string {
  return '─'.repeat(80);
}

/**
 * Format session header
 */
function formatSessionHeader(session: Session): string {
  const lines = [
    `Session: ${session.id}`,
    `Project: ${session.projectPath}`,
    `Started: ${formatDate(session.timestamp)}`,
    `Messages: ${session.messageCount}`,
  ];

  if (session.gitBranch) {
    lines.push(`Branch: ${session.gitBranch}`);
  }

  if (session.summary) {
    lines.push(`Summary: ${session.summary}`);
  }

  return lines.join('\n');
}

/**
 * Format a session for detailed view
 *
 * Tool calls are paired with their results for better readability.
 * Messages that are purely tool results are skipped since their
 * content is shown inline with the tool call.
 *
 * @param session - Full session object with messages
 * @returns Formatted session string
 */
export function formatSession(session: Session): string {
  const parts: string[] = [];

  // Build tool result map for pairing
  const toolResults = buildToolResultMap(session.messages);

  // Header
  parts.push(formatSessionHeader(session));
  parts.push('');
  parts.push(separator());

  // Messages
  for (const msg of session.messages) {
    // Skip summary and file-history-snapshot messages
    if (msg.type !== 'user' && msg.type !== 'assistant') {
      continue;
    }

    // Skip pure tool result messages (they're shown inline with tool calls)
    if (msg.type === 'user' && isToolResultMessage(msg as UserMessage)) {
      continue;
    }

    let formatted: string;
    if (msg.type === 'user') {
      formatted = formatUserMessage(msg as UserMessage);
    } else {
      formatted = formatAssistantMessage(msg as AssistantMessage, toolResults);
    }

    parts.push('');
    parts.push(formatted);
    parts.push('');
    parts.push(separator());
  }

  return parts.join('\n');
}

/**
 * Format session for JSON output
 * Returns the session as-is since it's already structured
 */
export function formatSessionForJson(session: Session): Session {
  return session;
}
