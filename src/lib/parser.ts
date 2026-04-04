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
  ProgressMessage,
  SummaryMessage,
  FileHistorySnapshotMessage,
  TextContent,
  ProgressTextContent,
  ToolUseContent,
  ThinkingContent,
  AssistantContent,
  ProgressContent,
  ToolResultContent,
  TokenUsage,
  FileSnapshot,
  FileBackup,
  ParseResult,
  ParseWarning,
} from './types.js';

const PREVIEW_MAX_LENGTH = 200;

type JsonlEntryVisitor<TState> = (entry: RawSessionEntry, state: TState) => void;

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
        content: trimmed,
      },
    };
  }
}

/**
 * Stream all valid JSONL entries through an accumulator callback.
 * @param filePath - Path to the JSONL session file
 * @param initialState - Mutable scan accumulator
 * @param visitEntry - Callback invoked for each valid parsed entry
 * @returns Final accumulator state and any parse warnings
 */
export async function scanJsonlFile<TState>(
  filePath: string,
  initialState: TState,
  visitEntry: JsonlEntryVisitor<TState>
): Promise<ParseResult<TState>> {
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
      visitEntry(result.entry, initialState);
    } else if (result.warning && result.warning.error !== 'Empty line') {
      // Only track non-empty line warnings
      warnings.push(result.warning);
    }
  }

  return { data: initialState, warnings };
}

/**
 * Parse all lines from a JSONL file.
 * @param filePath - Path to the JSONL session file
 * @returns Array of raw entries and any parse warnings
 */
export async function parseJsonlFile(filePath: string): Promise<ParseResult<RawSessionEntry[]>> {
  return scanJsonlFile(filePath, [] as RawSessionEntry[], (entry, entries) => {
    entries.push(entry);
  });
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
 * Parse progress content from raw message.
 */
function parseProgressContent(rawContent: unknown): ProgressContent[] {
  if (typeof rawContent === 'string') {
    return rawContent.length > 0 ? [{ type: 'text', text: rawContent }] : [];
  }

  if (!Array.isArray(rawContent)) {
    return [];
  }

  return rawContent
    .map((item): ProgressContent | null => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const typed = item as Record<string, unknown>;

      if (typed.type !== 'text' || typeof typed.text !== 'string') {
        return null;
      }

      return {
        type: 'text',
        text: typed.text,
      } as ProgressTextContent;
    })
    .filter((item): item is ProgressContent => item !== null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizePreviewText(value: string): string | null {
  let preview = '';
  let hasContent = false;
  let pendingSpace = false;
  let visibleLength = 0;

  for (const char of value) {
    if (/\s/.test(char)) {
      if (hasContent) {
        pendingSpace = true;
      }
      continue;
    }

    if (pendingSpace) {
      if (visibleLength >= PREVIEW_MAX_LENGTH) {
        break;
      }
      preview += ' ';
      visibleLength++;
      pendingSpace = false;
    }

    if (visibleLength >= PREVIEW_MAX_LENGTH) {
      break;
    }

    preview += char;
    hasContent = true;
    visibleLength++;
  }

  const normalized = preview.trimEnd();
  return normalized.length > 0 ? normalized : null;
}

function extractPreview(entry: RawSessionEntry): string | null {
  if (entry.type !== 'user') {
    return null;
  }

  const message = entry.message as RawMessage | undefined;
  if (typeof message?.content !== 'string') {
    return null;
  }

  return normalizePreviewText(message.content);
}

function extractMessageContent(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const nestedMessage = asRecord(record.message);
  if (nestedMessage && 'content' in nestedMessage) {
    return nestedMessage.content;
  }

  if ('content' in record) {
    return record.content;
  }

  return undefined;
}

function extractProgressContent(entry: RawSessionEntry): ProgressContent[] {
  const directContent = parseProgressContent(entry.message?.content);
  if (directContent.length > 0) {
    return directContent;
  }

  const data = asRecord(entry.data);
  const nestedNormalizedMessages = Array.isArray(data?.normalizedMessages)
    ? data.normalizedMessages
    : [];
  const normalizedMessages = Array.isArray(entry.normalizedMessages)
    ? entry.normalizedMessages
    : nestedNormalizedMessages;
  const normalizedContent = normalizedMessages.flatMap((message) =>
    parseProgressContent(extractMessageContent(message))
  );
  if (normalizedContent.length > 0) {
    return normalizedContent;
  }

  const nestedContent = parseProgressContent(extractMessageContent(data?.message));
  if (nestedContent.length > 0) {
    return nestedContent;
  }

  return [];
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

    case 'progress': {
      return {
        type: 'progress',
        uuid,
        parentUuid,
        timestamp,
        content: extractProgressContent(entry),
        cwd: entry.cwd ?? '',
        gitBranch: entry.gitBranch ?? null,
        isSidechain: entry.isSidechain ?? false,
      } as ProgressMessage;
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
  const { data, warnings } = await parseSessionFileWithMetadata(filePath);
  return { data: data.messages, warnings };
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
  preview: string | null;
  version: string;
  gitBranch: string | null;
  sessionId: string | null;
  agentId: string | null;
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
  messageCount: number;
}

export interface SessionSummaryScanResult {
  metadata: SessionMetadata;
  explicitAgentIds: string[];
}

export interface SessionFileScanResult {
  messages: Message[];
  metadata: SessionMetadata;
  explicitAgentIds: string[];
}

function createEmptySessionMetadata(): SessionMetadata {
  return {
    summary: null,
    preview: null,
    version: '',
    gitBranch: null,
    sessionId: null,
    agentId: null,
    firstTimestamp: null,
    lastTimestamp: null,
    messageCount: 0,
  };
}

function updateMetadataFromEntry(metadata: SessionMetadata, entry: RawSessionEntry): void {
  if (entry.type === 'summary' && entry.summary) {
    metadata.summary = entry.summary;
  }

  if (entry.version && !metadata.version) {
    metadata.version = entry.version;
  }
  if (entry.gitBranch !== undefined && metadata.gitBranch === null) {
    metadata.gitBranch = entry.gitBranch;
  }
  if (entry.sessionId && !metadata.sessionId) {
    metadata.sessionId = entry.sessionId;
  }
  if (entry.agentId && !metadata.agentId) {
    metadata.agentId = entry.agentId;
  }

  if (entry.type !== 'user' && entry.type !== 'assistant' && entry.type !== 'progress') {
    return;
  }

  metadata.messageCount++;

  if (entry.timestamp) {
    const timestamp = new Date(entry.timestamp);
    if (!Number.isNaN(timestamp.getTime())) {
      if (!metadata.firstTimestamp || timestamp < metadata.firstTimestamp) {
        metadata.firstTimestamp = timestamp;
      }
      if (!metadata.lastTimestamp || timestamp > metadata.lastTimestamp) {
        metadata.lastTimestamp = timestamp;
      }
    }
  }

  if (metadata.preview === null) {
    const preview = extractPreview(entry);
    if (preview !== null) {
      metadata.preview = preview;
    }
  }
}

/**
 * Extract metadata from raw session entries.
 * @param entries - Raw parsed entries
 * @returns Session metadata
 */
export function extractMetadata(entries: RawSessionEntry[]): SessionMetadata {
  const metadata = createEmptySessionMetadata();

  for (const entry of entries) {
    updateMetadataFromEntry(metadata, entry);
  }

  return metadata;
}

/**
 * Quick parse to extract only session metadata (faster than full parse).
 * @param filePath - Path to the JSONL session file
 * @returns Session metadata and warnings
 */
export async function parseSessionMetadata(
  filePath: string
): Promise<ParseResult<SessionMetadata>> {
  return scanJsonlFile(filePath, createEmptySessionMetadata(), (entry, metadata) => {
    updateMetadataFromEntry(metadata, entry);
  });
}

// =============================================================================
// Agent Link Extraction
// =============================================================================

function collectToolUseResultAgentId(value: unknown, agentIds: Set<string>): void {
  const record = asRecord(value);
  const agentId = asNonEmptyString(record?.agentId);

  if (agentId) {
    agentIds.add(agentId);
  }
}

function collectExplicitAgentIdsFromEntry(entry: RawSessionEntry, agentIds: Set<string>): void {
  collectToolUseResultAgentId(entry.toolUseResult, agentIds);

  const data = asRecord(entry.data);
  collectToolUseResultAgentId(data?.toolUseResult, agentIds);

  const nestedMessages = Array.isArray(entry.normalizedMessages)
    ? entry.normalizedMessages
    : Array.isArray(data?.normalizedMessages)
      ? data.normalizedMessages
      : [];

  for (const nestedMessage of nestedMessages) {
    const messageRecord = asRecord(nestedMessage);
    collectToolUseResultAgentId(messageRecord?.toolUseResult, agentIds);
    collectToolUseResultAgentId(asRecord(messageRecord?.message)?.toolUseResult, agentIds);
  }
}

/**
 * Extract explicit agent IDs referenced by a main session's raw entries.
 *
 * The canonical Claude shape records Task/subagent results on `toolUseResult.agentId`.
 * Some nested progress shapes mirror the same payload under `data.toolUseResult`.
 */
export function extractExplicitAgentIds(entries: RawSessionEntry[]): string[] {
  const agentIds = new Set<string>();

  for (const entry of entries) {
    collectExplicitAgentIdsFromEntry(entry, agentIds);
  }

  return [...agentIds];
}

/**
 * Parse summary metadata and explicit agent links in one transcript scan.
 * @param filePath - Path to the JSONL session file
 * @returns Summary metadata, explicit agent IDs, and parse warnings
 */
export async function parseSessionSummary(
  filePath: string
): Promise<ParseResult<SessionSummaryScanResult>> {
  const initialState = {
    metadata: createEmptySessionMetadata(),
    explicitAgentIds: new Set<string>(),
  };

  const { data, warnings } = await scanJsonlFile(filePath, initialState, (entry, state) => {
    updateMetadataFromEntry(state.metadata, entry);
    collectExplicitAgentIdsFromEntry(entry, state.explicitAgentIds);
  });

  return {
    data: {
      metadata: data.metadata,
      explicitAgentIds: [...data.explicitAgentIds],
    },
    warnings,
  };
}

/**
 * Parse full messages, metadata, and explicit agent links in one transcript scan.
 * @param filePath - Path to the JSONL session file
 * @returns Full detail scan result and parse warnings
 */
export async function parseSessionFileWithMetadata(
  filePath: string
): Promise<ParseResult<SessionFileScanResult>> {
  const initialState = {
    messages: [] as Message[],
    metadata: createEmptySessionMetadata(),
    explicitAgentIds: new Set<string>(),
  };

  const { data, warnings } = await scanJsonlFile(filePath, initialState, (entry, state) => {
    updateMetadataFromEntry(state.metadata, entry);
    collectExplicitAgentIdsFromEntry(entry, state.explicitAgentIds);

    const message = transformEntry(entry);
    if (message) {
      state.messages.push(message);
    }
  });

  return {
    data: {
      messages: data.messages,
      metadata: data.metadata,
      explicitAgentIds: [...data.explicitAgentIds],
    },
    warnings,
  };
}
