/**
 * JSONL parser for Claude Code session files.
 *
 * Provides stream-based parsing with error recovery:
 * - Skips invalid JSON lines and continues processing
 * - Tracks parse warnings for reporting
 * - Transforms raw entries into typed Message objects
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type {
  RawSessionEntry,
  RawMessage,
  RawTokenUsage,
  RawFileSnapshot,
  Message,
  UserMessage,
  AssistantMessage,
  SummaryMessage,
  FileHistorySnapshotMessage,
  TextContent,
  ToolUseContent,
  ThinkingContent,
  AssistantContent,
  ToolResultContent,
  TokenUsage,
  FileSnapshot,
  FileBackup,
  ParseResult,
  ParseWarning,
} from './types.js';

// =============================================================================
// Raw Entry Parsing
// =============================================================================

/**
 * Parse a single JSONL line into a raw session entry.
 * @param line - Raw JSON line from session file
 * @param lineNumber - Line number for error reporting
 * @returns Parsed entry or null if invalid
 */
export function parseJsonLine(
  line: string,
  lineNumber: number
): { entry: RawSessionEntry; warning: null } | { entry: null; warning: ParseWarning } {
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) {
    return { entry: null, warning: { line: lineNumber, error: 'Empty line' } };
  }

  try {
    const entry = JSON.parse(trimmed) as RawSessionEntry;
    return { entry, warning: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
    return {
      entry: null,
      warning: {
        line: lineNumber,
        error: `Invalid JSON: ${errorMessage}`,
        content: trimmed.length > 100 ? trimmed.slice(0, 100) + '...' : trimmed,
      },
    };
  }
}

/**
 * Parse all lines from a JSONL file.
 * @param filePath - Path to the JSONL session file
 * @returns Array of raw entries and any parse warnings
 */
export async function parseJsonlFile(filePath: string): Promise<ParseResult<RawSessionEntry[]>> {
  const entries: RawSessionEntry[] = [];
  const warnings: ParseWarning[] = [];

  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    const result = parseJsonLine(line, lineNumber);

    if (result.entry) {
      entries.push(result.entry);
    } else if (result.warning && result.warning.error !== 'Empty line') {
      // Only track non-empty line warnings
      warnings.push(result.warning);
    }
  }

  return { data: entries, warnings };
}

// =============================================================================
// Message Transformation
// =============================================================================

/**
 * Transform raw token usage to typed TokenUsage.
 */
function transformTokenUsage(raw: RawTokenUsage | undefined): TokenUsage {
  return {
    inputTokens: raw?.input_tokens ?? 0,
    outputTokens: raw?.output_tokens ?? 0,
    cacheCreationInputTokens: raw?.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: raw?.cache_read_input_tokens ?? 0,
  };
}

/**
 * Transform raw file snapshot to typed FileSnapshot.
 */
function transformFileSnapshot(raw: RawFileSnapshot): FileSnapshot {
  const trackedFileBackups: Record<string, FileBackup> = {};

  for (const [path, backup] of Object.entries(raw.trackedFileBackups)) {
    trackedFileBackups[path] = {
      backupFileName: backup.backupFileName,
      version: backup.version,
      backupTime: new Date(backup.backupTime),
    };
  }

  return {
    messageId: raw.messageId,
    timestamp: new Date(raw.timestamp),
    trackedFileBackups,
  };
}

/**
 * Parse assistant content from raw message.
 */
function parseAssistantContent(rawContent: unknown): AssistantContent[] {
  if (!Array.isArray(rawContent)) {
    // Handle string content (rare but possible)
    if (typeof rawContent === 'string') {
      return [{ type: 'text', text: rawContent }];
    }
    return [];
  }

  return rawContent
    .map((item): AssistantContent | null => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const typed = item as Record<string, unknown>;

      switch (typed.type) {
        case 'text':
          return {
            type: 'text',
            text: String(typed.text ?? ''),
          } as TextContent;

        case 'tool_use':
          return {
            type: 'tool_use',
            id: String(typed.id ?? ''),
            name: String(typed.name ?? ''),
            input: (typed.input as Record<string, unknown>) ?? {},
          } as ToolUseContent;

        case 'thinking':
          return {
            type: 'thinking',
            thinking: String(typed.thinking ?? ''),
          } as ThinkingContent;

        default:
          return null;
      }
    })
    .filter((item): item is AssistantContent => item !== null);
}

/**
 * Parse user content from raw message.
 */
function parseUserContent(rawContent: unknown): string | ToolResultContent[] {
  // String content (normal user message)
  if (typeof rawContent === 'string') {
    return rawContent;
  }

  // Array content (tool results)
  if (Array.isArray(rawContent)) {
    return rawContent
      .map((item): ToolResultContent | null => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const typed = item as Record<string, unknown>;

        if (typed.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: String(typed.tool_use_id ?? ''),
            content: String(typed.content ?? ''),
            is_error: typed.is_error === true ? true : undefined,
          };
        }

        return null;
      })
      .filter((item): item is ToolResultContent => item !== null);
  }

  return '';
}

/**
 * Transform a raw session entry into a typed Message.
 * @param entry - Raw parsed entry from JSONL
 * @returns Typed Message or null if not a message entry
 */
export function transformEntry(entry: RawSessionEntry): Message | null {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
  const uuid = entry.uuid ?? '';
  const parentUuid = entry.parentUuid ?? null;

  switch (entry.type) {
    case 'user': {
      const message = entry.message as RawMessage | undefined;
      return {
        type: 'user',
        uuid,
        parentUuid,
        timestamp,
        role: 'user',
        content: parseUserContent(message?.content),
        cwd: entry.cwd ?? '',
        gitBranch: entry.gitBranch ?? null,
        isSidechain: entry.isSidechain ?? false,
      } as UserMessage;
    }

    case 'assistant': {
      const message = entry.message as RawMessage | undefined;
      return {
        type: 'assistant',
        uuid,
        parentUuid,
        timestamp,
        role: 'assistant',
        model: message?.model ?? '',
        content: parseAssistantContent(message?.content),
        stopReason: message?.stop_reason ?? null,
        usage: transformTokenUsage(message?.usage),
      } as AssistantMessage;
    }

    case 'summary': {
      return {
        type: 'summary',
        uuid,
        parentUuid,
        timestamp,
        summary: entry.summary ?? '',
        leafUuid: entry.leafUuid ?? '',
      } as SummaryMessage;
    }

    case 'file-history-snapshot': {
      if (!entry.snapshot) {
        return null;
      }
      return {
        type: 'file-history-snapshot',
        uuid,
        parentUuid,
        timestamp,
        messageId: entry.messageId ?? '',
        snapshot: transformFileSnapshot(entry.snapshot),
      } as FileHistorySnapshotMessage;
    }

    default:
      // Unknown entry type - skip
      return null;
  }
}

/**
 * Parse a JSONL session file into typed Messages.
 * @param filePath - Path to the JSONL session file
 * @returns Parsed messages and warnings
 */
export async function parseSessionFile(filePath: string): Promise<ParseResult<Message[]>> {
  const { data: entries, warnings } = await parseJsonlFile(filePath);

  const messages: Message[] = [];

  for (const entry of entries) {
    const message = transformEntry(entry);
    if (message) {
      messages.push(message);
    }
  }

  return { data: messages, warnings };
}

// =============================================================================
// Session Metadata Extraction
// =============================================================================

/**
 * Extract session metadata from raw entries (summary, version, etc.).
 * Reads only the necessary fields without full message parsing.
 */
export interface SessionMetadata {
  summary: string | null;
  version: string;
  gitBranch: string | null;
  sessionId: string | null;
  agentId: string | null;
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
  messageCount: number;
}

/**
 * Extract metadata from raw session entries.
 * @param entries - Raw parsed entries
 * @returns Session metadata
 */
export function extractMetadata(entries: RawSessionEntry[]): SessionMetadata {
  let summary: string | null = null;
  let version = '';
  let gitBranch: string | null = null;
  let sessionId: string | null = null;
  let agentId: string | null = null;
  let firstTimestamp: Date | null = null;
  let lastTimestamp: Date | null = null;
  let messageCount = 0;

  for (const entry of entries) {
    // Extract summary from summary entry
    if (entry.type === 'summary' && entry.summary) {
      summary = entry.summary;
    }

    // Extract version and git branch from any entry that has them
    if (entry.version && !version) {
      version = entry.version;
    }
    if (entry.gitBranch !== undefined && gitBranch === null) {
      gitBranch = entry.gitBranch;
    }
    if (entry.sessionId && !sessionId) {
      sessionId = entry.sessionId;
    }
    if (entry.agentId && !agentId) {
      agentId = entry.agentId;
    }

    // Track timestamps for user/assistant messages only
    if (entry.type === 'user' || entry.type === 'assistant') {
      messageCount++;

      if (entry.timestamp) {
        const ts = new Date(entry.timestamp);
        if (!firstTimestamp || ts < firstTimestamp) {
          firstTimestamp = ts;
        }
        if (!lastTimestamp || ts > lastTimestamp) {
          lastTimestamp = ts;
        }
      }
    }
  }

  return {
    summary,
    version,
    gitBranch,
    sessionId,
    agentId,
    firstTimestamp,
    lastTimestamp,
    messageCount,
  };
}

/**
 * Quick parse to extract only session metadata (faster than full parse).
 * @param filePath - Path to the JSONL session file
 * @returns Session metadata and warnings
 */
export async function parseSessionMetadata(
  filePath: string
): Promise<ParseResult<SessionMetadata>> {
  const { data: entries, warnings } = await parseJsonlFile(filePath);
  const metadata = extractMetadata(entries);
  return { data: metadata, warnings };
}
