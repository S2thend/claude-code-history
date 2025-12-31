/**
 * Session discovery and retrieval for claude-code-history library.
 *
 * Provides functions to list, filter, and retrieve Claude Code sessions.
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import type { LibraryConfig, SessionSummary, Session, Message, PaginatedResult } from './types.js';
import { resolveConfig, paginate, createPagination, type ResolvedConfig } from './config.js';
import {
  getProjectsPath,
  decodeProjectPath,
  extractSessionId,
  isAgentSessionFile,
  extractAgentId,
  isUUID,
} from './platform.js';
import { parseSessionFile, parseSessionMetadata } from './parser.js';
import { DataNotFoundError, SessionNotFoundError } from './errors.js';

// =============================================================================
// Types
// =============================================================================

/** Internal session info for sorting and filtering */
interface SessionInfo {
  id: string;
  filePath: string;
  projectPath: string;
  encodedPath: string;
  isAgent: boolean;
  agentId: string | null;
  modifiedTime: Date;
}

// =============================================================================
// Session Discovery
// =============================================================================

/**
 * Check if Claude Code data directory exists.
 * @param dataPath - Path to check
 * @throws DataNotFoundError if directory doesn't exist
 */
async function validateDataPath(dataPath: string): Promise<void> {
  try {
    const stats = await stat(dataPath);
    if (!stats.isDirectory()) {
      throw new DataNotFoundError(dataPath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new DataNotFoundError(dataPath);
    }
    throw error;
  }
}

/**
 * Discover all session files in the Claude Code data directory.
 * @param config - Resolved configuration
 * @returns Array of session info objects
 */
async function discoverSessions(config: ResolvedConfig): Promise<SessionInfo[]> {
  const projectsPath = getProjectsPath(config.dataPath);
  const sessions: SessionInfo[] = [];

  // Check if projects directory exists
  try {
    await stat(projectsPath);
  } catch {
    // No projects directory = no sessions
    return [];
  }

  // Read all project directories
  const projectDirs = await readdir(projectsPath);

  for (const encodedPath of projectDirs) {
    const projectDir = join(projectsPath, encodedPath);

    // Skip if not a directory
    try {
      const dirStats = await stat(projectDir);
      if (!dirStats.isDirectory()) continue;
    } catch {
      continue;
    }

    // Decode project path
    const projectPath = decodeProjectPath(encodedPath);

    // Apply workspace filter if specified
    if (config.workspace && projectPath !== config.workspace) {
      continue;
    }

    // Read session files in this project
    const files = await readdir(projectDir);

    for (const filename of files) {
      const sessionId = extractSessionId(filename);
      if (!sessionId) continue; // Skip non-session files

      const filePath = join(projectDir, filename);
      const isAgent = isAgentSessionFile(filename);
      const agentId = isAgent ? extractAgentId(filename) : null;

      // Get file modification time for sorting
      try {
        const fileStats = await stat(filePath);

        sessions.push({
          id: sessionId,
          filePath,
          projectPath,
          encodedPath,
          isAgent,
          agentId,
          modifiedTime: fileStats.mtime,
        });
      } catch {
        // Skip files we can't stat
        continue;
      }
    }
  }

  return sessions;
}

/**
 * Find agent sessions linked to a main session.
 * @param _mainSessionId - The main session ID (reserved for future use)
 * @param allSessions - All discovered sessions
 * @returns Array of agent IDs linked to this session
 */
function findLinkedAgentIds(_mainSessionId: string, allSessions: SessionInfo[]): string[] {
  // Agent sessions in the same project directory with matching patterns
  // For now, we return agent sessions from the same project
  // A more sophisticated approach would parse the main session to find Task tool results
  return allSessions
    .filter((s): s is SessionInfo & { agentId: string } => s.isAgent && s.agentId !== null)
    .map((s) => s.agentId);
}

// =============================================================================
// Session Listing
// =============================================================================

/**
 * Build a SessionSummary from session info and metadata.
 */
async function buildSessionSummary(
  info: SessionInfo,
  allSessions: SessionInfo[]
): Promise<SessionSummary> {
  const { data: metadata } = await parseSessionMetadata(info.filePath);

  // Find linked agent sessions (for main sessions only)
  const agentIds = info.isAgent ? [] : findLinkedAgentIds(info.id, allSessions);

  return {
    id: info.id,
    projectPath: info.projectPath,
    summary: metadata.summary,
    timestamp: metadata.firstTimestamp ?? info.modifiedTime,
    lastActivityAt: metadata.lastTimestamp ?? info.modifiedTime,
    messageCount: metadata.messageCount,
    agentIds,
  };
}

/**
 * List all sessions with pagination.
 *
 * Sessions are sorted by most recent activity first (descending timestamp).
 * Agent sessions are excluded from the main list (they're linked via agentIds).
 *
 * @param config - Optional configuration for filtering and pagination
 * @returns Paginated list of session summaries
 *
 * @example
 * ```typescript
 * // List first 10 sessions
 * const result = await listSessions({ limit: 10 });
 *
 * // List sessions for a specific workspace
 * const result = await listSessions({ workspace: '/path/to/project' });
 *
 * // Paginate through results
 * const page2 = await listSessions({ limit: 10, offset: 10 });
 * ```
 */
export async function listSessions(
  config?: LibraryConfig
): Promise<PaginatedResult<SessionSummary>> {
  const resolved = resolveConfig(config);

  // Validate data path exists
  await validateDataPath(resolved.dataPath);

  // Discover all sessions
  const allSessions = await discoverSessions(resolved);

  // Filter out agent sessions from main list (they're accessed via agentIds)
  const mainSessions = allSessions.filter((s) => !s.isAgent);

  // Sort by modification time descending (most recent first)
  mainSessions.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());

  // Build summaries for paginated subset
  const paginatedInfos = paginate(mainSessions, resolved);
  const summaries: SessionSummary[] = [];

  for (const info of paginatedInfos) {
    const summary = await buildSessionSummary(info, allSessions);
    summaries.push(summary);
  }

  return {
    data: summaries,
    pagination: createPagination(mainSessions.length, resolved),
  };
}

// =============================================================================
// Session Retrieval
// =============================================================================

/**
 * Get a session by index or UUID.
 *
 * @param identifier - Zero-based index or session UUID
 * @param config - Optional configuration
 * @returns Full session with all messages
 * @throws SessionNotFoundError if session doesn't exist
 *
 * @example
 * ```typescript
 * // Get most recent session by index
 * const session = await getSession(0);
 *
 * // Get session by UUID
 * const session = await getSession('abc123-def456-...');
 *
 * // Get session from specific workspace
 * const session = await getSession(0, { workspace: '/path/to/project' });
 * ```
 */
export async function getSession(
  identifier: number | string,
  config?: LibraryConfig
): Promise<Session> {
  const resolved = resolveConfig(config);

  // Validate data path exists
  await validateDataPath(resolved.dataPath);

  // Discover all sessions
  const allSessions = await discoverSessions(resolved);

  // Filter out agent sessions
  const mainSessions = allSessions.filter((s) => !s.isAgent);

  // Sort by modification time descending (most recent first)
  mainSessions.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());

  let targetSession: SessionInfo | undefined;

  if (typeof identifier === 'number') {
    // Get by index
    if (identifier < 0 || identifier >= mainSessions.length) {
      throw new SessionNotFoundError(identifier);
    }
    targetSession = mainSessions[identifier];
  } else {
    // Get by UUID - auto-detect if it's a UUID or agent ID
    if (isUUID(identifier)) {
      targetSession = mainSessions.find((s) => s.id === identifier);
    } else if (identifier.startsWith('agent-')) {
      // Looking for an agent session
      targetSession = allSessions.find((s) => s.id === identifier);
    } else {
      // Try partial match on UUID
      targetSession = mainSessions.find((s) => s.id.startsWith(identifier));
    }
  }

  // Check if session was found
  if (!targetSession) {
    throw new SessionNotFoundError(identifier);
  }

  // Parse full session
  const { data: messages } = await parseSessionFile(targetSession.filePath);

  // Extract metadata from messages
  const metadata = extractSessionMetadataFromMessages(messages, targetSession);

  // Find linked agent IDs
  const agentIds = targetSession.isAgent ? [] : findLinkedAgentIds(targetSession.id, allSessions);

  return {
    id: targetSession.id,
    encodedPath: targetSession.encodedPath,
    projectPath: targetSession.projectPath,
    summary: metadata.summary,
    timestamp: metadata.timestamp,
    lastActivityAt: metadata.lastActivityAt,
    messageCount: messages.filter((m) => m.type === 'user' || m.type === 'assistant').length,
    version: metadata.version,
    gitBranch: metadata.gitBranch,
    agentIds,
    messages,
  };
}

/**
 * Extract metadata from parsed messages.
 */
function extractSessionMetadataFromMessages(
  messages: Message[],
  info: SessionInfo
): {
  summary: string | null;
  timestamp: Date;
  lastActivityAt: Date;
  version: string;
  gitBranch: string | null;
} {
  let summary: string | null = null;
  const version = '';
  let gitBranch: string | null = null;
  let firstTimestamp: Date | null = null;
  let lastTimestamp: Date | null = null;

  for (const msg of messages) {
    // Extract summary
    if (msg.type === 'summary') {
      summary = msg.summary;
    }

    // Track timestamps
    if (msg.type === 'user' || msg.type === 'assistant') {
      if (!firstTimestamp || msg.timestamp < firstTimestamp) {
        firstTimestamp = msg.timestamp;
      }
      if (!lastTimestamp || msg.timestamp > lastTimestamp) {
        lastTimestamp = msg.timestamp;
      }

      // Extract git branch from user messages
      if (msg.type === 'user') {
        gitBranch ??= msg.gitBranch;
      }
    }
  }

  return {
    summary,
    timestamp: firstTimestamp ?? info.modifiedTime,
    lastActivityAt: lastTimestamp ?? info.modifiedTime,
    version,
    gitBranch,
  };
}

/**
 * Get an agent session by ID.
 *
 * @param agentId - Agent ID (e.g., 'abc1234' or 'agent-abc1234')
 * @param config - Optional configuration
 * @returns Full agent session with all messages
 * @throws SessionNotFoundError if agent session doesn't exist
 */
export async function getAgentSession(agentId: string, config?: LibraryConfig): Promise<Session> {
  // Normalize agent ID format
  const normalizedId = agentId.startsWith('agent-') ? agentId : `agent-${agentId}`;

  const resolved = resolveConfig(config);
  await validateDataPath(resolved.dataPath);

  const allSessions = await discoverSessions(resolved);
  const agentSession = allSessions.find((s) => s.id === normalizedId);

  if (!agentSession) {
    throw new SessionNotFoundError(agentId);
  }

  // Parse full session
  const { data: messages } = await parseSessionFile(agentSession.filePath);
  const metadata = extractSessionMetadataFromMessages(messages, agentSession);

  return {
    id: agentSession.id,
    encodedPath: agentSession.encodedPath,
    projectPath: agentSession.projectPath,
    summary: metadata.summary,
    timestamp: metadata.timestamp,
    lastActivityAt: metadata.lastActivityAt,
    messageCount: messages.filter((m) => m.type === 'user' || m.type === 'assistant').length,
    version: metadata.version,
    gitBranch: metadata.gitBranch,
    agentIds: [],
    messages,
  };
}
