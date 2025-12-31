/**
 * Platform detection and path utilities for claude-code-history library.
 */

import { homedir } from 'os';
import { join } from 'path';

/**
 * Get the default Claude Code data directory path for the current platform.
 * @returns Absolute path to ~/.claude/ directory
 */
export function getDefaultDataPath(): string {
  return join(homedir(), '.claude');
}

/**
 * Get the projects directory within Claude Code data.
 * @param dataPath - Base data directory path
 * @returns Path to projects directory
 */
export function getProjectsPath(dataPath: string): string {
  return join(dataPath, 'projects');
}

/**
 * Encode a project path to Claude Code's directory name format.
 * Replaces path separators with hyphens.
 * @example
 * encodeProjectPath('/Users/name/project') // '-Users-name-project'
 */
export function encodeProjectPath(projectPath: string): string {
  // Remove trailing slashes and encode
  const normalized = projectPath.replace(/\/+$/, '');
  // Replace all forward slashes with hyphens
  return normalized.replace(/\//g, '-');
}

/**
 * Decode a Claude Code encoded directory name back to a project path.
 * @example
 * decodeProjectPath('-Users-name-project') // '/Users/name/project'
 */
export function decodeProjectPath(encodedPath: string): string {
  // Handle the leading hyphen which represents root /
  if (encodedPath.startsWith('-')) {
    return encodedPath.replace(/-/g, '/');
  }
  // Windows paths don't start with /
  return encodedPath.replace(/-/g, '/');
}

/**
 * Check if a string is a valid UUID format.
 * @param value - String to check
 * @returns true if the string matches UUID format
 */
export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Extract session ID from a session filename.
 * @param filename - Filename like 'uuid.jsonl' or 'agent-id.jsonl'
 * @returns Session ID or null if not a valid session file
 */
export function extractSessionId(filename: string): string | null {
  if (!filename.endsWith('.jsonl')) {
    return null;
  }

  const baseName = filename.slice(0, -6); // Remove .jsonl

  // Check if it's an agent session
  if (baseName.startsWith('agent-')) {
    return baseName; // Return full 'agent-xxx' as ID
  }

  // Check if it's a UUID session
  if (isUUID(baseName)) {
    return baseName;
  }

  return null;
}

/**
 * Check if a filename is an agent session file.
 * @param filename - Filename to check
 */
export function isAgentSessionFile(filename: string): boolean {
  return filename.startsWith('agent-') && filename.endsWith('.jsonl');
}

/**
 * Extract agent ID from an agent session filename.
 * @param filename - Filename like 'agent-abc1234.jsonl'
 * @returns Agent ID or null
 */
export function extractAgentId(filename: string): string | null {
  if (!isAgentSessionFile(filename)) {
    return null;
  }
  // Remove 'agent-' prefix and '.jsonl' suffix
  return filename.slice(6, -6);
}
