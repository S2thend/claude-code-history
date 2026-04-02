/**
 * Unit tests for session module - classifyMessage and filterMessages.
 */

import { describe, it, expect } from 'vitest';
import { classifyMessage, filterMessages } from '../../src/lib/session.js';
import type {
  Message,
  UserMessage,
  AssistantMessage,
  ProgressMessage,
} from '../../src/lib/types.js';

describe('classifyMessage', () => {
  describe('user messages', () => {
    it('should classify string content as user', () => {
      const message: UserMessage = {
        type: 'user',
        uuid: 'msg-001',
        parentUuid: null,
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        cwd: '/test',
        content: 'Hello, how are you?',
      };

      const types = classifyMessage(message);
      expect(types).toEqual(['user']);
    });

    it('should classify tool result with error as error', () => {
      const message: UserMessage = {
        type: 'user',
        uuid: 'msg-002',
        parentUuid: 'msg-001',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        cwd: '/test',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_001',
            content: 'Command failed',
            is_error: true,
          },
        ],
      };

      const types = classifyMessage(message);
      expect(types).toEqual(['error']);
    });

    it('should classify tool result without error (no user type for pure tool results)', () => {
      const message: UserMessage = {
        type: 'user',
        uuid: 'msg-002',
        parentUuid: 'msg-001',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        cwd: '/test',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_001',
            content: 'File contents here',
          },
        ],
      };

      const types = classifyMessage(message);
      expect(types).toEqual([]);
    });

    it('should classify mixed content with non-tool-result items as user', () => {
      const message: UserMessage = {
        type: 'user',
        uuid: 'msg-002',
        parentUuid: 'msg-001',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        cwd: '/test',
        content: [
          { type: 'text', text: 'Some user text' },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_001',
            content: 'Result',
          },
        ] as unknown as UserMessage['content'],
      };

      const types = classifyMessage(message);
      expect(types).toContain('user');
    });
  });

  describe('assistant messages', () => {
    it('should classify text content as assistant', () => {
      const message: AssistantMessage = {
        type: 'assistant',
        uuid: 'msg-003',
        parentUuid: 'msg-002',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        content: [{ type: 'text', text: 'Hello! I can help you.' }],
      };

      const types = classifyMessage(message);
      expect(types).toEqual(['assistant']);
    });

    it('should classify tool_use content as tool', () => {
      const message: AssistantMessage = {
        type: 'assistant',
        uuid: 'msg-003',
        parentUuid: 'msg-002',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_001',
            name: 'Read',
            input: { file_path: '/test/file.ts' },
          },
        ],
      };

      const types = classifyMessage(message);
      expect(types).toEqual(['tool']);
    });

    it('should classify thinking content as thinking', () => {
      const message: AssistantMessage = {
        type: 'assistant',
        uuid: 'msg-003',
        parentUuid: 'msg-002',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        content: [{ type: 'thinking', thinking: 'Let me analyze this...' }],
      };

      const types = classifyMessage(message);
      expect(types).toEqual(['thinking']);
    });

    it('should classify mixed content with multiple types', () => {
      const message: AssistantMessage = {
        type: 'assistant',
        uuid: 'msg-003',
        parentUuid: 'msg-002',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        content: [
          { type: 'thinking', thinking: 'Let me think...' },
          { type: 'text', text: 'I will read the file.' },
          {
            type: 'tool_use',
            id: 'toolu_001',
            name: 'Read',
            input: { file_path: '/test/file.ts' },
          },
        ],
      };

      const types = classifyMessage(message);
      expect(types).toContain('thinking');
      expect(types).toContain('assistant');
      expect(types).toContain('tool');
      expect(types.length).toBe(3);
    });

    it('should not duplicate types for multiple text blocks', () => {
      const message: AssistantMessage = {
        type: 'assistant',
        uuid: 'msg-003',
        parentUuid: 'msg-002',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
        content: [
          { type: 'text', text: 'First paragraph.' },
          { type: 'text', text: 'Second paragraph.' },
        ],
      };

      const types = classifyMessage(message);
      expect(types).toEqual(['assistant']);
    });
  });

  describe('non-displayable messages', () => {
    it('should classify progress messages as progress', () => {
      const message: ProgressMessage = {
        type: 'progress',
        uuid: 'msg-progress',
        parentUuid: 'msg-001',
        timestamp: new Date(),
        content: [{ type: 'text', text: 'Scanning files' }],
        cwd: '/test',
        gitBranch: 'main',
        isSidechain: false,
      };

      const types = classifyMessage(message);
      expect(types).toEqual(['progress']);
    });

    it('should return empty array for summary messages', () => {
      const message = {
        type: 'summary',
        summary: 'Session summary',
        leafUuid: 'msg-005',
      } as Message;

      const types = classifyMessage(message);
      expect(types).toEqual([]);
    });

    it('should return empty array for file-history-snapshot messages', () => {
      const message = {
        type: 'file-history-snapshot',
        data: {},
      } as Message;

      const types = classifyMessage(message);
      expect(types).toEqual([]);
    });
  });
});

describe('filterMessages', () => {
  const createUserMessage = (id: string, content: string): UserMessage => ({
    type: 'user',
    uuid: id,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    sessionId: 'session-001',
    cwd: '/test',
    content,
  });

  const createAssistantMessage = (id: string, text: string): AssistantMessage => ({
    type: 'assistant',
    uuid: id,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    sessionId: 'session-001',
    content: [{ type: 'text', text }],
  });

  const createToolMessage = (id: string): AssistantMessage => ({
    type: 'assistant',
    uuid: id,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    sessionId: 'session-001',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_001',
        name: 'Read',
        input: { file_path: '/test/file.ts' },
      },
    ],
  });

  const createErrorMessage = (id: string): UserMessage => ({
    type: 'user',
    uuid: id,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    sessionId: 'session-001',
    cwd: '/test',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_001',
        content: 'Error occurred',
        is_error: true,
      },
    ],
  });

  const createProgressMessage = (id: string, text = 'Progress update'): ProgressMessage => ({
    type: 'progress',
    uuid: id,
    parentUuid: null,
    timestamp: new Date(),
    content: [{ type: 'text', text }],
    cwd: '/test',
    gitBranch: 'main',
    isSidechain: false,
  });

  const createSummaryMessage = (): Message =>
    ({
      type: 'summary',
      summary: 'Test session',
      leafUuid: 'msg-005',
    }) as Message;

  it('should return all displayable messages when no filter is specified', () => {
    const messages: Message[] = [
      createSummaryMessage(),
      createUserMessage('msg-001', 'Hello'),
      createAssistantMessage('msg-002', 'Hi there'),
      createProgressMessage('msg-003', 'Scanning files'),
    ];

    const filtered = filterMessages(messages);
    expect(filtered.length).toBe(3);
    expect(filtered.map((m) => m.uuid)).toEqual(['msg-001', 'msg-002', 'msg-003']);
  });

  it('should return all displayable messages with empty options', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createAssistantMessage('msg-002', 'Hi there'),
      createProgressMessage('msg-003'),
    ];

    const filtered = filterMessages(messages, {});
    expect(filtered.length).toBe(3);
  });

  it('should return all displayable messages with empty only array', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createAssistantMessage('msg-002', 'Hi there'),
      createProgressMessage('msg-003'),
    ];

    const filtered = filterMessages(messages, { only: [] });
    expect(filtered.length).toBe(3);
  });

  it('should filter to only user messages', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createAssistantMessage('msg-002', 'Hi there'),
      createUserMessage('msg-003', 'Thanks'),
    ];

    const filtered = filterMessages(messages, { only: ['user'] });
    expect(filtered.length).toBe(2);
    expect(filtered.every((m) => m.type === 'user')).toBe(true);
  });

  it('should filter to only assistant messages', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createAssistantMessage('msg-002', 'Hi there'),
      createToolMessage('msg-003'),
    ];

    const filtered = filterMessages(messages, { only: ['assistant'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].uuid).toBe('msg-002');
  });

  it('should filter to only tool messages', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createAssistantMessage('msg-002', 'Hi there'),
      createToolMessage('msg-003'),
    ];

    const filtered = filterMessages(messages, { only: ['tool'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].uuid).toBe('msg-003');
  });

  it('should filter to only progress messages', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createProgressMessage('msg-002', 'Scanning files'),
      createAssistantMessage('msg-003', 'Hi there'),
    ];

    const filtered = filterMessages(messages, { only: ['progress'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.uuid).toBe('msg-002');
  });

  it('should filter to only error messages', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createErrorMessage('msg-002'),
      createAssistantMessage('msg-003', 'Let me try again'),
    ];

    const filtered = filterMessages(messages, { only: ['error'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].uuid).toBe('msg-002');
  });

  it('should filter with multiple types (OR logic)', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createAssistantMessage('msg-002', 'Hi there'),
      createToolMessage('msg-003'),
      createErrorMessage('msg-004'),
    ];

    const filtered = filterMessages(messages, { only: ['user', 'error'] });
    expect(filtered.length).toBe(2);
    expect(filtered.map((m) => m.uuid)).toEqual(['msg-001', 'msg-004']);
  });

  it('should exclude summary and file-history-snapshot messages', () => {
    const messages: Message[] = [
      createSummaryMessage(),
      { type: 'file-history-snapshot', data: {} } as Message,
      createUserMessage('msg-001', 'Hello'),
    ];

    const filtered = filterMessages(messages, { only: ['user'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].uuid).toBe('msg-001');
  });

  it('should include message if ANY content block matches filter', () => {
    const mixedMessage: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: new Date().toISOString(),
      sessionId: 'session-001',
      content: [
        { type: 'text', text: 'I will read the file.' },
        {
          type: 'tool_use',
          id: 'toolu_001',
          name: 'Read',
          input: { file_path: '/test/file.ts' },
        },
      ],
    };

    const messages: Message[] = [mixedMessage];

    // Should match 'assistant' filter
    const filteredAssistant = filterMessages(messages, { only: ['assistant'] });
    expect(filteredAssistant.length).toBe(1);

    // Should also match 'tool' filter
    const filteredTool = filterMessages(messages, { only: ['tool'] });
    expect(filteredTool.length).toBe(1);
  });

  it('should preserve transcript order when progress messages are included', () => {
    const messages: Message[] = [
      createUserMessage('msg-001', 'Hello'),
      createProgressMessage('msg-002', 'Scanning files'),
      createAssistantMessage('msg-003', 'Done'),
    ];

    const filtered = filterMessages(messages);
    expect(filtered.map((message) => message.uuid)).toEqual(['msg-001', 'msg-002', 'msg-003']);
  });
});
