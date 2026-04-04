/**
 * Session discovery and retrieval for claude-code-history library.
 *
 * Provides functions to list, filter, and retrieve Claude Code sessions.
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import type {
  LibraryConfig,
  SessionSummary,
  Session,
  Message,
  PaginatedResult,
  FilterableMessageType,
  MessageFilterOptions,
  UserMessage,
  AssistantMessage,
  ToolResultContent,
} from './types.js';
import { resolveConfig, paginate, createPagination, type ResolvedConfig } from './config.js';
import {
  getProjectsPath,
  decodeProjectPath,
  discoverProjectSessionFiles,
  extractSessionIdFromPath,
  isUUID,
  getNestedOwnerSessionId,
  getAgentStorageLayout,
} from './platform.js';
import {
  parseSessionFileWithMetadata,
  parseSessionMetadata,
  parseSessionSummary,
  type SessionMetadata,
} from './parser.js';
import { AmbiguousAgentSessionError, DataNotFoundError, SessionNotFoundError } from './errors.js';

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
  storageLayout: 'flat' | 'nested';
  nestedOwnerSessionId: string | null;
  modifiedTime: Date;
}

interface MainSessionAnalysis {
  metadata: SessionMetadata;
  explicitAgentIds: string[];
}

interface LinkContext {
  analysisBySessionId: Map<string, MainSessionAnalysis>;
  agentSessionsById: Map<string, SessionInfo[]>;
  explicitAgentOwners: Map<string, Set<string>>;
  nestedAgentIdsByOwner: Map<string, Set<string>>;
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

  try {
    await stat(projectsPath);
  } catch {
    return [];
  }

  const projectDirs = await readdir(projectsPath);

  for (const encodedPath of projectDirs) {
    const projectDir = join(projectsPath, encodedPath);

    try {
      const dirStats = await stat(projectDir);
      if (!dirStats.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const projectPath = decodeProjectPath(encodedPath);
    if (config.workspace && projectPath !== config.workspace) {
      continue;
    }

    const filePaths = await discoverProjectSessionFiles(projectDir);

    for (const filePath of filePaths) {
      const sessionId = extractSessionIdFromPath(filePath);
      if (!sessionId) {
        continue;
      }

      const isAgent = sessionId.startsWith('agent-');
      const agentId = isAgent ? sessionId.slice(6) : null;

      try {
        const fileStats = await stat(filePath);

        sessions.push({
          id: sessionId,
          filePath,
          projectPath,
          encodedPath,
          isAgent,
          agentId,
          storageLayout: isAgent ? getAgentStorageLayout(projectDir, filePath) : 'flat',
          nestedOwnerSessionId: isAgent ? getNestedOwnerSessionId(projectDir, filePath) : null,
          modifiedTime: fileStats.mtime,
        });
      } catch {
        continue;
      }
    }
  }

  return sessions;
}

function pushToArrayMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }

  map.set(key, [value]);
}

function pushToSetMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.add(value);
    return;
  }

  map.set(key, new Set([value]));
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function sortSessionsByModifiedTime(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
}

async function analyzeMainSessions(
  mainSessions: SessionInfo[],
  preloadedAnalysisBySessionId = new Map<string, MainSessionAnalysis>()
): Promise<Map<string, MainSessionAnalysis>> {
  const analysisBySessionId = new Map<string, MainSessionAnalysis>(preloadedAnalysisBySessionId);

  for (const session of mainSessions) {
    if (analysisBySessionId.has(session.id)) {
      continue;
    }

    const { data } = await parseSessionSummary(session.filePath);
    analysisBySessionId.set(session.id, data);
  }

  return analysisBySessionId;
}

function buildLinkContext(
  projectSessions: SessionInfo[],
  analysisBySessionId: Map<string, MainSessionAnalysis>
): LinkContext {
  const agentSessionsById = new Map<string, SessionInfo[]>();
  const explicitAgentOwners = new Map<string, Set<string>>();
  const nestedAgentIdsByOwner = new Map<string, Set<string>>();

  for (const session of projectSessions) {
    if (!session.isAgent || !session.agentId) {
      continue;
    }

    pushToArrayMap(agentSessionsById, session.agentId, session);

    if (session.nestedOwnerSessionId) {
      pushToSetMap(nestedAgentIdsByOwner, session.nestedOwnerSessionId, session.agentId);
    }
  }

  for (const [sessionId, analysis] of analysisBySessionId.entries()) {
    for (const agentId of analysis.explicitAgentIds) {
      pushToSetMap(explicitAgentOwners, agentId, sessionId);
    }
  }

  return {
    analysisBySessionId,
    agentSessionsById,
    explicitAgentOwners,
    nestedAgentIdsByOwner,
  };
}

async function getLinkContextForProject(
  projectPath: string,
  allSessions: SessionInfo[],
  cache: Map<string, LinkContext>,
  preloadedAnalysisBySessionId = new Map<string, MainSessionAnalysis>()
): Promise<LinkContext> {
  const cached = cache.get(projectPath);
  if (cached) {
    return cached;
  }

  const projectSessions = allSessions.filter((session) => session.projectPath === projectPath);
  const mainSessions = projectSessions.filter((session) => !session.isAgent);
  const analysisBySessionId = await analyzeMainSessions(mainSessions, preloadedAnalysisBySessionId);
  const context = buildLinkContext(projectSessions, analysisBySessionId);
  cache.set(projectPath, context);
  return context;
}

function resolveAgentLinks(
  info: SessionInfo,
  context: LinkContext
): {
  agentIds: string[];
  unresolvedAgentIds: string[];
} {
  if (info.isAgent) {
    return { agentIds: [], unresolvedAgentIds: [] };
  }

  const explicitAgentIds = context.analysisBySessionId.get(info.id)?.explicitAgentIds ?? [];
  const agentIds = new Set<string>();
  const unresolvedAgentIds = new Set<string>();

  for (const agentId of explicitAgentIds) {
    if ((context.agentSessionsById.get(agentId) ?? []).length > 0) {
      agentIds.add(agentId);
      continue;
    }

    unresolvedAgentIds.add(agentId);
  }

  for (const agentId of context.nestedAgentIdsByOwner.get(info.id) ?? []) {
    const explicitOwners = context.explicitAgentOwners.get(agentId);
    if (explicitOwners && explicitOwners.size > 0 && !explicitOwners.has(info.id)) {
      continue;
    }

    agentIds.add(agentId);
    unresolvedAgentIds.delete(agentId);
  }

  return {
    agentIds: uniqueSorted(agentIds),
    unresolvedAgentIds: uniqueSorted(unresolvedAgentIds),
  };
}

function buildSessionRecord(
  info: SessionInfo,
  messages: Message[],
  metadata: SessionMetadata,
  links: { agentIds: string[]; unresolvedAgentIds: string[] }
): Session {
  return {
    id: info.id,
    encodedPath: info.encodedPath,
    projectPath: info.projectPath,
    summary: metadata.summary,
    preview: metadata.preview,
    timestamp: metadata.firstTimestamp ?? info.modifiedTime,
    lastActivityAt: metadata.lastTimestamp ?? info.modifiedTime,
    messageCount: metadata.messageCount,
    version: metadata.version,
    gitBranch: metadata.gitBranch,
    agentIds: links.agentIds,
    unresolvedAgentIds: links.unresolvedAgentIds,
    messages,
  };
}

async function buildSessionSummary(
  info: SessionInfo,
  allSessions: SessionInfo[],
  linkContextCache: Map<string, LinkContext>
): Promise<SessionSummary> {
  if (info.isAgent) {
    const { data } = await parseSessionSummary(info.filePath);

    return {
      id: info.id,
      projectPath: info.projectPath,
      gitBranch: data.metadata.gitBranch,
      summary: data.metadata.summary,
      preview: data.metadata.preview,
      timestamp: data.metadata.firstTimestamp ?? info.modifiedTime,
      lastActivityAt: data.metadata.lastTimestamp ?? info.modifiedTime,
      messageCount: data.metadata.messageCount,
      agentIds: [],
      unresolvedAgentIds: [],
    };
  }

  const context = await getLinkContextForProject(info.projectPath, allSessions, linkContextCache);
  const analysis = context.analysisBySessionId.get(info.id);
  const metadata = analysis?.metadata ?? (await parseSessionMetadata(info.filePath)).data;
  const links = resolveAgentLinks(info, context);

  return {
    id: info.id,
    projectPath: info.projectPath,
    gitBranch: metadata.gitBranch,
    summary: metadata.summary,
    preview: metadata.preview,
    timestamp: metadata.firstTimestamp ?? info.modifiedTime,
    lastActivityAt: metadata.lastTimestamp ?? info.modifiedTime,
    messageCount: metadata.messageCount,
    agentIds: links.agentIds,
    unresolvedAgentIds: links.unresolvedAgentIds,
  };
}

function normalizeAgentLookupId(agentId: string): string {
  return agentId.startsWith('agent-') ? agentId.slice(6) : agentId;
}

function findAgentSessionMatches(agentId: string, allSessions: SessionInfo[]): SessionInfo[] {
  const normalizedAgentId = normalizeAgentLookupId(agentId);
  return allSessions.filter((session) => session.isAgent && session.agentId === normalizedAgentId);
}

async function loadSessionRecord(info: SessionInfo, allSessions: SessionInfo[]): Promise<Session> {
  const { data } = await parseSessionFileWithMetadata(info.filePath);

  if (info.isAgent) {
    return buildSessionRecord(info, data.messages, data.metadata, {
      agentIds: [],
      unresolvedAgentIds: [],
    });
  }

  const context = await getLinkContextForProject(
    info.projectPath,
    allSessions,
    new Map(),
    new Map<string, MainSessionAnalysis>([
      [
        info.id,
        {
          metadata: data.metadata,
          explicitAgentIds: data.explicitAgentIds,
        },
      ],
    ])
  );

  return buildSessionRecord(
    info,
    data.messages,
    data.metadata,
    resolveAgentLinks(info, context)
  );
}

// =============================================================================
// Session Listing
// =============================================================================

/**
 * List all sessions with pagination.
 *
 * Sessions are sorted by most recent activity first (descending timestamp).
 * Main and agent sessions are both returned as top-level rows.
 */
export async function listSessions(
  config?: LibraryConfig
): Promise<PaginatedResult<SessionSummary>> {
  const resolved = resolveConfig(config);
  await validateDataPath(resolved.dataPath);

  const allSessions = await discoverSessions(resolved);
  const sortedSessions = sortSessionsByModifiedTime(allSessions);
  const paginatedInfos = paginate(sortedSessions, resolved);
  const linkContextCache = new Map<string, LinkContext>();
  const summaries: SessionSummary[] = [];

  for (const info of paginatedInfos) {
    summaries.push(await buildSessionSummary(info, allSessions, linkContextCache));
  }

  return {
    data: summaries,
    pagination: createPagination(sortedSessions.length, resolved),
  };
}

// =============================================================================
// Session Retrieval
// =============================================================================

/**
 * Get a session by index, UUID, partial UUID, or agent identifier.
 */
export async function getSession(
  identifier: number | string,
  config?: LibraryConfig
): Promise<Session> {
  const resolved = resolveConfig(config);
  await validateDataPath(resolved.dataPath);

  const allSessions = await discoverSessions(resolved);
  const mainSessions = sortSessionsByModifiedTime(
    allSessions.filter((session) => !session.isAgent)
  );

  if (typeof identifier === 'string' && identifier.startsWith('agent-')) {
    return getAgentSession(identifier, config);
  }

  let targetSession: SessionInfo | undefined;

  if (typeof identifier === 'number') {
    if (identifier < 0 || identifier >= mainSessions.length) {
      throw new SessionNotFoundError(identifier);
    }
    targetSession = mainSessions[identifier];
  } else if (isUUID(identifier)) {
    targetSession = mainSessions.find((session) => session.id === identifier);
    if (!targetSession) {
      throw new SessionNotFoundError(identifier);
    }
  } else {
    targetSession = mainSessions.find((session) => session.id.startsWith(identifier));
    if (!targetSession) {
      return getAgentSession(identifier, config);
    }
  }

  if (!targetSession) {
    throw new SessionNotFoundError(identifier);
  }

  return loadSessionRecord(targetSession, allSessions);
}

/**
 * Get an agent session by ID.
 *
 * @param agentId - Agent ID (e.g., 'abc1234' or 'agent-abc1234')
 * @param config - Optional configuration
 * @returns Full agent session with all messages
 * @throws SessionNotFoundError if agent session doesn't exist
 * @throws AmbiguousAgentSessionError if more than one transcript matches the same agent ID
 */
export async function getAgentSession(agentId: string, config?: LibraryConfig): Promise<Session> {
  const resolved = resolveConfig(config);
  await validateDataPath(resolved.dataPath);

  const allSessions = await discoverSessions(resolved);
  const matches = findAgentSessionMatches(agentId, allSessions);

  if (matches.length === 0) {
    throw new SessionNotFoundError(agentId);
  }

  if (matches.length > 1) {
    throw new AmbiguousAgentSessionError(
      normalizeAgentLookupId(agentId),
      matches.map((session) => session.filePath)
    );
  }

  const agentSession = matches[0];
  if (!agentSession) {
    throw new SessionNotFoundError(agentId);
  }

  return loadSessionRecord(agentSession, allSessions);
}

// =============================================================================
// Message Filtering
// =============================================================================

/**
 * Classify a message into filterable types.
 *
 * @param message - Message to classify
 * @returns Array of applicable filter types for this message
 *
 * @remarks
 * A message can have multiple classifications (e.g., an assistant message
 * with both text and tool_use content will return ['assistant', 'tool']).
 *
 * Returns empty array for non-displayable messages (summary, file-history-snapshot).
 *
 * @example
 * ```typescript
 * import { classifyMessage } from 'claude-code-history';
 *
 * const types = classifyMessage(message);
 * // For user message: ['user']
 * // For assistant with text + tool: ['assistant', 'tool']
 * // For user with error result: ['error']
 * ```
 */
export function classifyMessage(message: Message): FilterableMessageType[] {
  const types: FilterableMessageType[] = [];

  // Skip non-displayable message types
  if (message.type === 'summary' || message.type === 'file-history-snapshot') {
    return types;
  }

  if (message.type === 'progress') {
    types.push('progress');
    return types;
  }

  if (message.type === 'user') {
    const userMsg = message as UserMessage;

    // Check if content is a string (regular user message)
    if (typeof userMsg.content === 'string') {
      types.push('user');
    } else if (Array.isArray(userMsg.content)) {
      // Check for error results in tool result content
      const toolResults = userMsg.content as ToolResultContent[];
      const hasError = toolResults.some((item) => item.type === 'tool_result' && item.is_error);

      if (hasError) {
        types.push('error');
      }

      // Only add 'user' if not purely tool results (tool results are shown inline with tool calls)
      const isPurelyToolResults = toolResults.every((item) => item.type === 'tool_result');
      if (!isPurelyToolResults) {
        types.push('user');
      }
    }
  }

  if (message.type === 'assistant') {
    const assistantMsg = message as AssistantMessage;

    for (const item of assistantMsg.content) {
      if (item.type === 'text') {
        if (!types.includes('assistant')) {
          types.push('assistant');
        }
      }
      if (item.type === 'tool_use') {
        if (!types.includes('tool')) {
          types.push('tool');
        }
      }
      if (item.type === 'thinking') {
        if (!types.includes('thinking')) {
          types.push('thinking');
        }
      }
    }
  }

  return types;
}

/**
 * Filter messages by type.
 *
 * @param messages - Array of messages to filter
 * @param options - Filter options specifying which types to include
 * @returns Filtered array of messages
 *
 * @remarks
 * - If `options.only` is empty or undefined, returns all displayable messages
 * - Messages with mixed content (e.g., text + tool_use) are included
 *   if ANY content block matches the filter
 * - Order and timestamps are preserved
 * - Summary and file-history-snapshot messages are always excluded
 *
 * @example
 * ```typescript
 * import { filterMessages } from 'claude-code-history';
 *
 * // Filter to only user messages
 * const userMessages = filterMessages(session.messages, { only: ['user'] });
 *
 * // Filter to tools and errors
 * const toolsAndErrors = filterMessages(session.messages, { only: ['tool', 'error'] });
 *
 * // No filter (returns all displayable messages)
 * const allMessages = filterMessages(session.messages, {});
 * ```
 */
export function filterMessages(messages: Message[], options?: MessageFilterOptions): Message[] {
  // First, filter out non-displayable messages (summary, file-history-snapshot)
  const displayableMessages = messages.filter(
    (m) => m.type === 'user' || m.type === 'assistant' || m.type === 'progress'
  );

  // If no filter specified or empty filter, return all displayable messages
  if (!options?.only || options.only.length === 0) {
    return displayableMessages;
  }

  // Filter messages based on classification
  const filterTypes = options.only;
  return displayableMessages.filter((message) => {
    const messageTypes = classifyMessage(message);
    // Include message if ANY of its types match the filter
    return messageTypes.some((type) => filterTypes.includes(type));
  });
}
