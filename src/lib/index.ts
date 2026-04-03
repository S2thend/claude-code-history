/**
 * Claude Code History Library
 *
 * A TypeScript library for reading, searching, exporting, and migrating
 * Claude Code conversation history.
 *
 * @packageDocumentation
 */

// =============================================================================
// Core Types
// =============================================================================

export type {
  // Configuration
  LibraryConfig,

  // Session types
  SessionSummary,
  Session,

  // Message types
  MessageType,
  BaseMessage,
  UserMessage,
  AssistantMessage,
  ProgressMessage,
  SummaryMessage,
  FileHistorySnapshotMessage,
  Message,

  // Content types
  TextContent,
  ProgressTextContent,
  ToolUseContent,
  ThinkingContent,
  AssistantContent,
  ProgressContent,
  ToolResultContent,

  // Supporting types
  TokenUsage,
  AggregateTokenStats,
  SessionWithStats,
  ListStatsResult,
  FileSnapshot,
  FileBackup,

  // Pagination
  Pagination,
  PaginatedResult,

  // Search
  SearchMatch,

  // Migration
  MigrateConfig,
  MigrateWorkspaceConfig,
  MigrateError,
  MigrateResult,

  // Message Filtering
  FilterableMessageType,
  MessageFilterOptions,
} from './types.js';

export { VALID_FILTER_TYPES } from './types.js';

// =============================================================================
// Error Classes and Type Guards
// =============================================================================

export {
  SessionNotFoundError,
  AmbiguousAgentSessionError,
  WorkspaceNotFoundError,
  DataNotFoundError,
  isAmbiguousAgentSessionError,
  isSessionNotFoundError,
  isWorkspaceNotFoundError,
  isDataNotFoundError,
} from './errors.js';

// =============================================================================
// Session Functions
// =============================================================================

export {
  listSessions,
  getSession,
  getAgentSession,
  classifyMessage,
  filterMessages,
} from './session.js';

// =============================================================================
// Search Functions
// =============================================================================

export { searchSessions, searchInSession } from './search.js';

// =============================================================================
// Export Functions
// =============================================================================

export {
  exportSessionToJson,
  exportSessionToMarkdown,
  exportAllSessionsToJson,
  exportAllSessionsToMarkdown,
  exportSession,
  exportAllSessions,
  type ExportFormat,
} from './export.js';

// =============================================================================
// Migration Functions
// =============================================================================

export { migrateSession, migrateWorkspace } from './migrate.js';

// =============================================================================
// Utility Functions
// =============================================================================

export { getDefaultDataPath, getProjectsPath } from './platform.js';

// =============================================================================
// Token Statistics Functions
// =============================================================================

export { computeTokenStats, createEmptyStats, addStats } from './stats.js';
