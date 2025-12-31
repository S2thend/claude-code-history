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
  SummaryMessage,
  FileHistorySnapshotMessage,
  Message,

  // Content types
  TextContent,
  ToolUseContent,
  ThinkingContent,
  AssistantContent,
  ToolResultContent,

  // Supporting types
  TokenUsage,
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
} from './types.js';

// =============================================================================
// Error Classes and Type Guards
// =============================================================================

export {
  SessionNotFoundError,
  WorkspaceNotFoundError,
  DataNotFoundError,
  isSessionNotFoundError,
  isWorkspaceNotFoundError,
  isDataNotFoundError,
} from './errors.js';

// =============================================================================
// Session Functions
// =============================================================================

export { listSessions, getSession, getAgentSession } from './session.js';

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
