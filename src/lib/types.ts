/**
 * Core Library Types
 *
 * TypeScript interfaces for claude-code-history library.
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration options for library functions.
 */
export interface LibraryConfig {
  /** Custom Claude Code data directory path. Auto-detected if not provided. */
  dataPath?: string;

  /** Filter sessions by workspace/project path. */
  workspace?: string;

  /** Maximum number of results to return. Default: 50 */
  limit?: number;

  /** Number of results to skip (for pagination). Default: 0 */
  offset?: number;

  /** Number of context lines for search results. Default: 2 */
  context?: number;
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Lightweight session metadata for listing.
 */
export interface SessionSummary {
  /** Session UUID */
  id: string;

  /** Decoded project path (e.g., /Users/name/project) */
  projectPath: string;

  /** Human-readable session title */
  summary: string | null;

  /** Session start time */
  timestamp: Date;

  /** Most recent message time */
  lastActivityAt: Date;

  /** Total message count */
  messageCount: number;

  /** Linked agent session IDs */
  agentIds: string[];
}

/**
 * Full session with all messages.
 */
export interface Session extends SessionSummary {
  /** Encoded directory name */
  encodedPath: string;

  /** Claude Code version */
  version: string;

  /** Git branch at session start */
  gitBranch: string | null;

  /** All messages in the session */
  messages: Message[];
}

// =============================================================================
// Message Types
// =============================================================================

/** Message type discriminator */
export type MessageType = 'user' | 'assistant' | 'summary' | 'file-history-snapshot';

/**
 * Base message structure.
 */
export interface BaseMessage {
  /** Unique message identifier */
  uuid: string;

  /** Parent message UUID (for threading) */
  parentUuid: string | null;

  /** Message type discriminator */
  type: MessageType;

  /** When message was created */
  timestamp: Date;
}

/**
 * User message or tool result.
 */
export interface UserMessage extends BaseMessage {
  type: 'user';
  role: 'user';
  content: string | ToolResultContent[];
  cwd: string;
  gitBranch: string | null;
  isSidechain: boolean;
}

/**
 * Assistant (Claude) response.
 */
export interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  role: 'assistant';
  model: string;
  content: AssistantContent[];
  stopReason: string | null;
  usage: TokenUsage;
}

/**
 * Session summary entry.
 */
export interface SummaryMessage extends BaseMessage {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

/**
 * File history snapshot entry.
 */
export interface FileHistorySnapshotMessage extends BaseMessage {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: FileSnapshot;
}

/** Union of all message types */
export type Message = UserMessage | AssistantMessage | SummaryMessage | FileHistorySnapshotMessage;

// =============================================================================
// Content Types
// =============================================================================

/** Text content block */
export interface TextContent {
  type: 'text';
  text: string;
}

/** Tool use (invocation) content */
export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Thinking/reasoning content */
export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

/** Union of assistant content types */
export type AssistantContent = TextContent | ToolUseContent | ThinkingContent;

/** Tool result content */
export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// =============================================================================
// Supporting Types
// =============================================================================

/** Token usage metrics */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

/** File snapshot for history tracking */
export interface FileSnapshot {
  messageId: string;
  timestamp: Date;
  trackedFileBackups: Record<string, FileBackup>;
}

/** Individual file backup entry */
export interface FileBackup {
  backupFileName: string;
  version: number;
  backupTime: Date;
}

// =============================================================================
// Pagination
// =============================================================================

/** Pagination metadata */
export interface Pagination {
  /** Total number of matching items */
  total: number;

  /** Items per page */
  limit: number;

  /** Current offset */
  offset: number;

  /** Whether more results exist */
  hasMore: boolean;
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  /** Result items */
  data: T[];

  /** Pagination metadata */
  pagination: Pagination;
}

// =============================================================================
// Search Types
// =============================================================================

/** Search result match */
export interface SearchMatch {
  /** Session containing the match */
  sessionId: string;

  /** Session summary for context */
  sessionSummary: string | null;

  /** Project path */
  projectPath: string;

  /** Message UUID containing match */
  messageUuid: string;

  /** Message type (user/assistant) */
  messageType: 'user' | 'assistant';

  /** Matched text */
  match: string;

  /** Surrounding context lines */
  context: string[];

  /** Line number in message content */
  lineNumber: number;
}

// =============================================================================
// Migration Types
// =============================================================================

/** Migration configuration for specific sessions */
export interface MigrateConfig {
  /** Session(s) to migrate - index or UUID, single or array */
  sessions: number | string | (number | string)[];

  /** Destination workspace path */
  destination: string;

  /** Migration mode. Default: 'copy' */
  mode?: 'copy' | 'move';
}

/** Migration configuration for entire workspace */
export interface MigrateWorkspaceConfig {
  /** Source workspace path */
  source: string;

  /** Destination workspace path */
  destination: string;

  /** Migration mode. Default: 'copy' */
  mode?: 'copy' | 'move';
}

/** Migration error detail */
export interface MigrateError {
  sessionId: string;
  error: string;
}

/** Migration result */
export interface MigrateResult {
  /** Number of successfully migrated sessions */
  successCount: number;

  /** Number of failed migrations */
  failedCount: number;

  /** Error details for failed migrations */
  errors: MigrateError[];
}

// =============================================================================
// Internal Types (for parsing)
// =============================================================================

/** Raw JSONL entry from Claude Code session file */
export interface RawSessionEntry {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  agentId?: string;
  cwd?: string;
  gitBranch?: string | null;
  version?: string;
  userType?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  message?: RawMessage;
  summary?: string;
  leafUuid?: string;
  messageId?: string;
  snapshot?: RawFileSnapshot;
}

/** Raw message from JSONL */
export interface RawMessage {
  role: string;
  model?: string;
  id?: string;
  type?: string;
  content: unknown;
  stop_reason?: string | null;
  usage?: RawTokenUsage;
}

/** Raw token usage from JSONL */
export interface RawTokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

/** Raw file snapshot from JSONL */
export interface RawFileSnapshot {
  messageId: string;
  timestamp: string;
  trackedFileBackups: Record<
    string,
    {
      backupFileName: string;
      version: number;
      backupTime: string;
    }
  >;
}

/** Parse result with warnings */
export interface ParseResult<T> {
  data: T;
  warnings: ParseWarning[];
}

/** Parse warning for invalid lines */
export interface ParseWarning {
  line: number;
  error: string;
  content?: string;
}
