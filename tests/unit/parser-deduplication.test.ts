import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  extractMetadata,
  parseJsonlFile,
  parseSessionFile,
  parseSessionFileWithMetadata,
  parseSessionMetadata,
  parseSessionSummary,
} from '../../src/lib/parser.js';
import {
  DuplicateMessageConflictError,
  isDuplicateMessageConflictError,
} from '../../src/lib/index.js';
import type { RawSessionEntry } from '../../src/lib/types.js';

const user: RawSessionEntry = {
  type: 'user',
  uuid: 'user-1',
  parentUuid: null,
  timestamp: '2026-09-01T00:00:00.000Z',
  sessionId: 'session-1',
  cwd: '/tmp/example',
  message: { role: 'user', content: 'Hello' },
};
const assistant: RawSessionEntry = {
  type: 'assistant',
  uuid: 'assistant-1',
  parentUuid: 'user-1',
  timestamp: '2026-09-01T00:00:01.000Z',
  sessionId: 'session-1',
  message: {
    role: 'assistant',
    model: 'test-model',
    content: [
      { type: 'tool_use', id: 'tool-1', name: 'Read', input: { path: '/tmp/file', limit: 1 } },
    ],
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  },
};
const tempDirs: string[] = [];
async function writeEntries(entries: RawSessionEntry[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cch-dedup-'));
  tempDirs.push(dir);
  const path = join(dir, 'session.jsonl');
  await writeFile(path, entries.map((entry) => JSON.stringify(entry)).join('\n'));
  return path;
}
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function expectCount(entries: RawSessionEntry[], count: number): Promise<void> {
  const path = await writeEntries(entries);
  const detail = await parseSessionFileWithMetadata(path);
  expect(detail.data.metadata.messageCount).toBe(count);
  expect((await parseSessionMetadata(path)).data.messageCount).toBe(count);
  expect((await parseSessionSummary(path)).data.metadata).toEqual(detail.data.metadata);
  expect(extractMetadata(entries)).toEqual(detail.data.metadata);
}

describe('session message deduplication', () => {
  it('keeps the first occurrence in order and leaves raw parsing unchanged', async () => {
    const progress = { ...user, type: 'progress', uuid: 'progress-1' };
    const entries = [user, assistant, user, progress, assistant, progress];
    const path = await writeEntries(entries);
    expect((await parseJsonlFile(path)).data).toEqual(entries);
    const parsed = await parseSessionFile(path);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.data.map((message) => message.uuid)).toEqual([
      'user-1',
      'assistant-1',
      'progress-1',
    ]);
    expect(await parseSessionFile(path)).toEqual(parsed);
    await expectCount(entries, 3);
  });

  it('ignores only top-level origin and object key order, including nested tool input', async () => {
    const repeated = JSON.parse(JSON.stringify(assistant));
    repeated.origin = { type: 'replay' };
    repeated.message.content[0].input = { limit: 1, path: '/tmp/file' };
    const entries = [assistant, repeated];
    await expectCount(entries, 1);
    expect((await parseSessionFile(await writeEntries(entries))).data).toHaveLength(1);
  });

  it('preserves identical text with different UUIDs', async () => {
    await expectCount([user, { ...user, uuid: 'user-2' }], 2);
  });

  it('does not collapse absent or empty UUIDs', async () => {
    const entries = [
      { ...user, uuid: undefined },
      { ...user, uuid: undefined },
      { ...user, uuid: '' },
      { ...user, uuid: '' },
    ];
    await expectCount(entries, 4);
    expect((await parseSessionFile(await writeEntries(entries))).data).toHaveLength(4);
  });

  it('deduplicates before generating fallback timestamps', async () => {
    await expectCount(
      [
        { ...user, timestamp: undefined },
        { ...user, timestamp: undefined },
      ],
      1
    );
  });

  it('preserves summary and snapshot updates without using their IDs as transcript UUIDs', async () => {
    const snapshot = {
      type: 'file-history-snapshot',
      uuid: user.uuid,
      messageId: user.uuid,
      snapshot: { messageId: user.uuid!, timestamp: user.timestamp!, trackedFileBackups: {} },
    };
    const entries = [
      user,
      { type: 'summary', uuid: user.uuid, summary: 'First' },
      snapshot,
      { type: 'summary', uuid: user.uuid, summary: 'Updated' },
      snapshot,
      user,
    ];
    const result = await parseSessionFileWithMetadata(await writeEntries(entries));
    expect(result.data.messages).toHaveLength(5);
    expect(result.data.metadata.summary).toBe('Updated');
    await expectCount(entries, 1);
  });

  it('preserves explicit agent links on duplicated records', async () => {
    const entry = { ...user, toolUseResult: { agentId: 'linked-agent' } };
    const path = await writeEntries([entry, entry]);
    expect((await parseSessionSummary(path)).data.explicitAgentIds).toEqual(['linked-agent']);
    expect((await parseSessionFileWithMetadata(path)).data.explicitAgentIds).toEqual([
      'linked-agent',
    ]);
  });

  it.each([
    ['content', { ...user, message: { role: 'user', content: 'Changed' } }],
    ['parent UUID', { ...user, parentUuid: 'different-parent' }],
    ['timestamp', { ...user, timestamp: '2026-09-02T00:00:00.000Z' }],
    ['message type', { ...user, type: 'progress' }],
    ['unknown semantic field', { ...user, customPayload: 'different' }],
    ['agent link', { ...user, toolUseResult: { agentId: 'different-agent' } }],
    [
      'content discarded by transformation',
      { ...user, message: { role: 'user', content: [{ type: 'image', source: 'different' }] } },
    ],
  ])('rejects conflicts in %s in every semantic parsing path', async (_field, changed) => {
    const entries = [user, changed as RawSessionEntry];
    const path = await writeEntries(entries);
    for (const parse of [
      parseSessionFile,
      parseSessionFileWithMetadata,
      parseSessionMetadata,
      parseSessionSummary,
    ]) {
      await expect(parse(path)).rejects.toMatchObject({
        name: 'DuplicateMessageConflictError',
        messageUuid: user.uuid,
        filePath: path,
      });
    }
    expect(() => extractMetadata(entries)).toThrow(DuplicateMessageConflictError);
  });

  it.each(['tool input', 'usage', 'model', 'nested origin', 'content order'])(
    'rejects assistant conflicts in %s',
    async (field) => {
      const changed = JSON.parse(JSON.stringify(assistant));
      if (field === 'tool input') changed.message.content[0].input.path = '/different';
      if (field === 'usage') changed.message.usage.output_tokens++;
      if (field === 'model') changed.message.model = 'other-model';
      if (field === 'nested origin') changed.message.content[0].input.origin = 'semantic input';
      if (field === 'content order')
        changed.message.content.unshift({ type: 'text', text: 'Additional content' });
      const path = await writeEntries([assistant, changed]);
      await expect(parseSessionFile(path)).rejects.toThrow(DuplicateMessageConflictError);
      await expect(parseSessionSummary(path)).rejects.toThrow(DuplicateMessageConflictError);
    }
  );

  it('scopes UUID tracking to each file', async () => {
    const first = await writeEntries([user, user]);
    const second = await writeEntries([
      { ...user, message: { role: 'user', content: 'Another session' } },
    ]);
    expect((await parseSessionFile(first)).data).toHaveLength(1);
    expect((await parseSessionFile(second)).data).toHaveLength(1);
  });

  it('exports a typed conflict error and guard', () => {
    const error = new DuplicateMessageConflictError('msg-1', '/tmp/session.jsonl');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('msg-1');
    expect(error.message).toContain('/tmp/session.jsonl');
    expect(isDuplicateMessageConflictError(error)).toBe(true);
    expect(isDuplicateMessageConflictError(new Error())).toBe(false);
    expect(isDuplicateMessageConflictError(null)).toBe(false);
  });

  it('detects conflicting fields even when transformation discards both payloads', async () => {
    const entries = ['first-image', 'second-image'].map((source) => ({
      ...user,
      message: { role: 'user', content: [{ type: 'image', source }] },
    }));
    const path = await writeEntries(entries);
    await expect(parseSessionFile(path)).rejects.toThrow(DuplicateMessageConflictError);
    await expect(parseSessionSummary(path)).rejects.toThrow(DuplicateMessageConflictError);
  });

  it('treats array order as meaningful', async () => {
    const content = [
      { type: 'text', text: 'First' },
      { type: 'text', text: 'Second' },
    ];
    const entries = [content, [...content].reverse()].map((blocks) => ({
      ...assistant,
      message: { ...assistant.message!, content: blocks },
    }));
    const path = await writeEntries(entries);
    await expect(parseSessionFile(path)).rejects.toThrow(DuplicateMessageConflictError);
    await expect(parseSessionMetadata(path)).rejects.toThrow(DuplicateMessageConflictError);
  });
});
