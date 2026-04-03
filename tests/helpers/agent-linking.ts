import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';

export const FIXTURES_DIR = resolve(process.cwd(), 'tests', 'fixtures');

export interface TempClaudeData {
  dataPath: string;
  projectsPath: string;
}

export async function createTempClaudeData(prefix: string): Promise<TempClaudeData> {
  const dataPath = await mkdtemp(join(tmpdir(), prefix));
  const projectsPath = join(dataPath, 'projects');
  await mkdir(projectsPath, { recursive: true });
  return { dataPath, projectsPath };
}

export async function cleanupTempClaudeData(dataPath: string): Promise<void> {
  await rm(dataPath, { recursive: true, force: true });
}

export async function ensureProjectDir(
  projectsPath: string,
  encodedProjectPath: string
): Promise<string> {
  const projectDir = join(projectsPath, encodedProjectPath);
  await mkdir(projectDir, { recursive: true });
  return projectDir;
}

export async function writeProjectSessionFile(
  projectsPath: string,
  encodedProjectPath: string,
  relativePath: string,
  content: string
): Promise<string> {
  const targetPath = join(projectsPath, encodedProjectPath, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
  return targetPath;
}

export async function readFixture(relativePath: string): Promise<string> {
  return readFile(join(FIXTURES_DIR, relativePath), 'utf-8');
}

export function encodeProjectPathForTests(projectPath: string): string {
  return projectPath.replace(/\//g, '-');
}

export function buildSimpleSessionJson(
  sessionId: string,
  projectPath: string,
  summary: string,
  timestamp: string
): string {
  return [
    JSON.stringify({
      type: 'summary',
      summary,
      leafUuid: `${sessionId}-assistant`,
    }),
    JSON.stringify({
      type: 'user',
      uuid: `${sessionId}-user`,
      parentUuid: null,
      timestamp,
      sessionId,
      cwd: projectPath,
      gitBranch: 'main',
      version: '2.0.55',
      message: {
        role: 'user',
        content: `Prompt for ${summary}`,
      },
    }),
    JSON.stringify({
      type: 'assistant',
      uuid: `${sessionId}-assistant`,
      parentUuid: `${sessionId}-user`,
      timestamp,
      sessionId,
      message: {
        role: 'assistant',
        model: 'claude-opus-4-5-20251101',
        content: [{ type: 'text', text: `Response for ${summary}` }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    }),
  ].join('\n');
}
