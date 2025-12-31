/**
 * Migration functionality for claude-code-history library.
 *
 * Provides functions to copy/move sessions between workspaces
 * while preserving rollback functionality.
 */

import { readFile, writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import type {
  LibraryConfig,
  MigrateConfig,
  MigrateWorkspaceConfig,
  MigrateResult,
  MigrateError,
  RawSessionEntry,
  RawFileSnapshot,
} from './types.js';
import { resolveConfig } from './config.js';
import { getProjectsPath, encodeProjectPath } from './platform.js';
import { getSession } from './session.js';
import { WorkspaceNotFoundError } from './errors.js';

// =============================================================================
// Path Rewriting
// =============================================================================

/**
 * Rewrite a path from source workspace to destination workspace.
 * Only rewrites paths that start with the source workspace.
 */
function rewritePath(path: string, sourceWorkspace: string, destWorkspace: string): string {
  // Normalize paths (remove trailing slashes)
  const normalizedSource = sourceWorkspace.replace(/\/+$/, '');
  const normalizedDest = destWorkspace.replace(/\/+$/, '');

  if (path.startsWith(normalizedSource)) {
    return normalizedDest + path.slice(normalizedSource.length);
  }
  return path;
}

/**
 * Rewrite paths in tool_use input objects.
 */
function rewriteToolInput(
  input: Record<string, unknown>,
  sourceWorkspace: string,
  destWorkspace: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === 'file_path' && typeof value === 'string') {
      result[key] = rewritePath(value, sourceWorkspace, destWorkspace);
    } else if (key === 'path' && typeof value === 'string') {
      result[key] = rewritePath(value, sourceWorkspace, destWorkspace);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = rewriteToolInput(
        value as Record<string, unknown>,
        sourceWorkspace,
        destWorkspace
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Rewrite paths in message content.
 */
function rewriteMessageContent(
  content: unknown,
  sourceWorkspace: string,
  destWorkspace: string
): unknown {
  if (!Array.isArray(content)) {
    return content;
  }

  return content.map((block) => {
    if (typeof block !== 'object' || block === null) {
      return block;
    }

    const typed = block as Record<string, unknown>;

    // Rewrite tool_use inputs
    if (typed.type === 'tool_use' && typeof typed.input === 'object' && typed.input !== null) {
      return {
        ...typed,
        input: rewriteToolInput(
          typed.input as Record<string, unknown>,
          sourceWorkspace,
          destWorkspace
        ),
      };
    }

    return block;
  });
}

/**
 * Rewrite paths in trackedFileBackups.
 */
function rewriteTrackedFileBackups(
  backups: RawFileSnapshot['trackedFileBackups'],
  sourceWorkspace: string,
  destWorkspace: string
): RawFileSnapshot['trackedFileBackups'] {
  const result: RawFileSnapshot['trackedFileBackups'] = {};

  for (const [filePath, backup] of Object.entries(backups)) {
    const newPath = rewritePath(filePath, sourceWorkspace, destWorkspace);
    result[newPath] = backup;
  }

  return result;
}

/**
 * Rewrite all paths in a raw session entry.
 */
function rewriteEntryPaths(
  entry: RawSessionEntry,
  sourceWorkspace: string,
  destWorkspace: string
): RawSessionEntry {
  const result = { ...entry };

  // Rewrite cwd field
  if (result.cwd) {
    result.cwd = rewritePath(result.cwd, sourceWorkspace, destWorkspace);
  }

  // Rewrite message content (for tool_use inputs)
  if (result.message?.content !== undefined) {
    result.message = {
      ...result.message,
      content: rewriteMessageContent(result.message.content, sourceWorkspace, destWorkspace),
    };
  }

  // Rewrite file-history-snapshot paths
  if (result.type === 'file-history-snapshot' && result.snapshot) {
    result.snapshot = {
      ...result.snapshot,
      trackedFileBackups: rewriteTrackedFileBackups(
        result.snapshot.trackedFileBackups,
        sourceWorkspace,
        destWorkspace
      ),
    };
  }

  return result;
}

// =============================================================================
// Migration Implementation
// =============================================================================

/**
 * Read and parse a session file, rewrite paths, and return as JSONL string.
 */
async function readAndRewriteSession(
  filePath: string,
  sourceWorkspace: string,
  destWorkspace: string
): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  const rewrittenLines: string[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as RawSessionEntry;
      const rewritten = rewriteEntryPaths(entry, sourceWorkspace, destWorkspace);
      rewrittenLines.push(JSON.stringify(rewritten));
    } catch {
      // Keep original line if parse fails
      rewrittenLines.push(line);
    }
  }

  return rewrittenLines.join('\n') + '\n';
}

/**
 * Migrate a single session file.
 */
async function migrateSessionFile(
  sessionId: string,
  sourceFilePath: string,
  sourceWorkspace: string,
  destWorkspace: string,
  dataPath: string,
  mode: 'copy' | 'move'
): Promise<void> {
  // Compute destination path
  const destEncodedPath = encodeProjectPath(destWorkspace);
  const destProjectDir = join(getProjectsPath(dataPath), destEncodedPath);
  const destFilePath = join(destProjectDir, `${sessionId}.jsonl`);

  // Ensure destination directory exists
  await mkdir(destProjectDir, { recursive: true });

  // Read, rewrite paths, and write to destination
  const rewrittenContent = await readAndRewriteSession(
    sourceFilePath,
    sourceWorkspace,
    destWorkspace
  );
  await writeFile(destFilePath, rewrittenContent, 'utf-8');

  // Delete source if moving
  if (mode === 'move') {
    await unlink(sourceFilePath);
  }
}

/**
 * Migrate sessions to a different workspace.
 *
 * This function copies or moves session files while rewriting all
 * absolute paths to point to the new workspace location.
 *
 * @param config - Migration configuration
 * @returns Migration result with success/failure counts
 *
 * @example
 * ```typescript
 * // Copy a single session
 * const result = await migrateSession({
 *   sessions: 0,
 *   destination: '/new/project/path',
 * });
 *
 * // Move multiple sessions
 * const result = await migrateSession({
 *   sessions: [0, 1, 'abc123-...'],
 *   destination: '/new/project/path',
 *   mode: 'move',
 * });
 * ```
 */
export async function migrateSession(
  config: MigrateConfig,
  libraryConfig?: LibraryConfig
): Promise<MigrateResult> {
  const resolved = resolveConfig(libraryConfig);
  const mode = config.mode ?? 'copy';

  // Normalize sessions to array
  const sessionIds = Array.isArray(config.sessions) ? config.sessions : [config.sessions];

  const errors: MigrateError[] = [];
  let successCount = 0;

  for (const sessionId of sessionIds) {
    try {
      // Get session to find its file path and source workspace
      const session = await getSession(sessionId, {
        dataPath: resolved.dataPath,
        workspace: resolved.workspace,
      });

      const sourceFilePath = join(
        getProjectsPath(resolved.dataPath),
        session.encodedPath,
        `${session.id}.jsonl`
      );

      await migrateSessionFile(
        session.id,
        sourceFilePath,
        session.projectPath,
        config.destination,
        resolved.dataPath,
        mode
      );

      successCount++;
    } catch (error) {
      errors.push({
        sessionId: String(sessionId),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    successCount,
    failedCount: errors.length,
    errors,
  };
}

/**
 * Migrate all sessions from one workspace to another.
 *
 * @param config - Workspace migration configuration
 * @returns Migration result with success/failure counts
 *
 * @example
 * ```typescript
 * const result = await migrateWorkspace({
 *   source: '/old/project/path',
 *   destination: '/new/project/path',
 *   mode: 'move',
 * });
 * ```
 */
export async function migrateWorkspace(
  config: MigrateWorkspaceConfig,
  libraryConfig?: LibraryConfig
): Promise<MigrateResult> {
  const resolved = resolveConfig(libraryConfig);
  const mode = config.mode ?? 'copy';

  // Find all sessions in source workspace
  const sourceEncodedPath = encodeProjectPath(config.source);
  const sourceProjectDir = join(getProjectsPath(resolved.dataPath), sourceEncodedPath);

  // Check if source workspace exists
  let files: string[];
  try {
    files = await readdir(sourceProjectDir);
  } catch {
    throw new WorkspaceNotFoundError(config.source);
  }

  // Filter to session files only
  const sessionFiles = files.filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'));

  const errors: MigrateError[] = [];
  let successCount = 0;

  for (const filename of sessionFiles) {
    const sessionId = filename.replace('.jsonl', '');
    const sourceFilePath = join(sourceProjectDir, filename);

    try {
      await migrateSessionFile(
        sessionId,
        sourceFilePath,
        config.source,
        config.destination,
        resolved.dataPath,
        mode
      );
      successCount++;
    } catch (error) {
      errors.push({
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Also migrate agent sessions
  const agentFiles = files.filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'));

  for (const filename of agentFiles) {
    const agentId = filename.replace('.jsonl', '');
    const sourceFilePath = join(sourceProjectDir, filename);

    try {
      await migrateSessionFile(
        agentId,
        sourceFilePath,
        config.source,
        config.destination,
        resolved.dataPath,
        mode
      );
      successCount++;
    } catch (error) {
      errors.push({
        sessionId: agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    successCount,
    failedCount: errors.length,
    errors,
  };
}
