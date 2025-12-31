/**
 * Custom error classes and type guards for claude-code-history library.
 */

/**
 * Error thrown when a session is not found by index or UUID.
 */
export class SessionNotFoundError extends Error {
  readonly name = 'SessionNotFoundError' as const;
  readonly sessionId: string | number;

  constructor(sessionId: string | number) {
    super(`Session not found: ${sessionId}`);
    this.sessionId = sessionId;
    Object.setPrototypeOf(this, SessionNotFoundError.prototype);
  }
}

/**
 * Error thrown when a workspace path does not exist.
 */
export class WorkspaceNotFoundError extends Error {
  readonly name = 'WorkspaceNotFoundError' as const;
  readonly workspace: string;

  constructor(workspace: string) {
    super(`Workspace not found: ${workspace}`);
    this.workspace = workspace;
    Object.setPrototypeOf(this, WorkspaceNotFoundError.prototype);
  }
}

/**
 * Error thrown when Claude Code data directory is not found.
 */
export class DataNotFoundError extends Error {
  readonly name = 'DataNotFoundError' as const;
  readonly dataPath: string;

  constructor(dataPath: string) {
    super(`Claude Code data directory not found: ${dataPath}`);
    this.dataPath = dataPath;
    Object.setPrototypeOf(this, DataNotFoundError.prototype);
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if error is a SessionNotFoundError.
 */
export function isSessionNotFoundError(error: unknown): error is SessionNotFoundError {
  return error instanceof SessionNotFoundError;
}

/**
 * Check if error is a WorkspaceNotFoundError.
 */
export function isWorkspaceNotFoundError(error: unknown): error is WorkspaceNotFoundError {
  return error instanceof WorkspaceNotFoundError;
}

/**
 * Check if error is a DataNotFoundError.
 */
export function isDataNotFoundError(error: unknown): error is DataNotFoundError {
  return error instanceof DataNotFoundError;
}
