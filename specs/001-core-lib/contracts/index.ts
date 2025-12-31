/**
 * Public API Export Contract
 *
 * This file defines what should be exported from the library's main entry point.
 */

// Types
export type {
  // Configuration
  LibraryConfig,

  // Session types
  Session,
  SessionSummary,

  // Message types
  Message,
  MessageType,
  UserMessage,
  AssistantMessage,
  SummaryMessage,
  FileHistorySnapshotMessage,

  // Content types
  AssistantContent,
  TextContent,
  ToolUseContent,
  ThinkingContent,
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
  MigrateResult,
  MigrateError,
} from './types';

// Functions (implementations to be provided)
export declare const listSessions: import('./types').ListSessionsFn;
export declare const getSession: import('./types').GetSessionFn;
export declare const searchSessions: import('./types').SearchSessionsFn;
export declare const getDefaultDataPath: import('./types').GetDefaultDataPathFn;
export declare const exportSessionToJson: import('./types').ExportSessionToJsonFn;
export declare const exportSessionToMarkdown: import('./types').ExportSessionToMarkdownFn;
export declare const exportAllSessionsToJson: import('./types').ExportAllSessionsToJsonFn;
export declare const exportAllSessionsToMarkdown: import('./types').ExportAllSessionsToMarkdownFn;
export declare const migrateSession: import('./types').MigrateSessionFn;
export declare const migrateWorkspace: import('./types').MigrateWorkspaceFn;

// Error type guards
export declare const isSessionNotFoundError: import('./types').IsSessionNotFoundErrorFn;
export declare const isWorkspaceNotFoundError: import('./types').IsWorkspaceNotFoundErrorFn;
export declare const isDataNotFoundError: import('./types').IsDataNotFoundErrorFn;
