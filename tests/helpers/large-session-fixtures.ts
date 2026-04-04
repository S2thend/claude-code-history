const DEFAULT_VERSION = '2.0.55';
const DEFAULT_MODEL = 'claude-opus-4-5-20251101';

export interface LargeSessionFixtureOptions {
  sessionId: string;
  projectPath: string;
  timestamp: string;
  summary?: string | null;
  agentId?: string;
  gitBranch?: string | null;
  version?: string;
  userPayloadSize?: number;
  assistantPayloadSize?: number;
  toolResultPayloadSize?: number;
  userMessageCount?: number;
  malformedLine?: string;
}

export function buildPayload(prefix: string, targetLength: number): string {
  if (targetLength <= prefix.length) {
    return prefix.slice(0, targetLength);
  }

  const repeated = 'x'.repeat(targetLength - prefix.length);
  return `${prefix}${repeated}`;
}

function buildUserEntry(
  sessionId: string,
  projectPath: string,
  timestamp: string,
  content: string,
  options: Pick<LargeSessionFixtureOptions, 'agentId' | 'gitBranch' | 'version'>
): string {
  return JSON.stringify({
    type: 'user',
    uuid: `${sessionId}-user`,
    parentUuid: null,
    timestamp,
    sessionId,
    ...(options.agentId ? { agentId: options.agentId } : {}),
    cwd: projectPath,
    gitBranch: options.gitBranch ?? null,
    version: options.version ?? DEFAULT_VERSION,
    isSidechain: options.agentId ? true : false,
    message: {
      role: 'user',
      content,
    },
  });
}

function buildAssistantEntry(
  sessionId: string,
  timestamp: string,
  content: string,
  options: Pick<LargeSessionFixtureOptions, 'agentId'>
): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: `${sessionId}-assistant`,
    parentUuid: `${sessionId}-user`,
    timestamp,
    sessionId,
    ...(options.agentId ? { agentId: options.agentId } : {}),
    message: {
      role: 'assistant',
      model: DEFAULT_MODEL,
      content: [{ type: 'text', text: content }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  });
}

function buildToolResultEntry(
  sessionId: string,
  projectPath: string,
  timestamp: string,
  content: string,
  index: number,
  options: Pick<LargeSessionFixtureOptions, 'agentId'>
): string {
  return JSON.stringify({
    type: 'user',
    uuid: `${sessionId}-tool-result-${index}`,
    parentUuid: `${sessionId}-assistant`,
    timestamp,
    sessionId,
    ...(options.agentId ? { agentId: options.agentId } : {}),
    cwd: projectPath,
    isSidechain: options.agentId ? true : false,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: `${sessionId}-tool-${index}`,
          content,
        },
      ],
    },
  });
}

export function buildLargeSessionJson(options: LargeSessionFixtureOptions): string {
  const {
    sessionId,
    projectPath,
    timestamp,
    summary = `Summary for ${sessionId}`,
    gitBranch = 'main',
    version = DEFAULT_VERSION,
    userPayloadSize = 512,
    assistantPayloadSize = 512,
    toolResultPayloadSize = 512,
    userMessageCount = 1,
    malformedLine,
    agentId,
  } = options;

  const lines: string[] = [];

  if (summary !== null) {
    lines.push(
      JSON.stringify({
        type: 'summary',
        summary,
        leafUuid: `${sessionId}-assistant`,
      })
    );
  }

  lines.push(
    buildUserEntry(
      sessionId,
      projectPath,
      timestamp,
      buildPayload(`Prompt for ${sessionId} `, userPayloadSize),
      { agentId, gitBranch, version }
    )
  );
  lines.push(
    buildAssistantEntry(
      sessionId,
      timestamp,
      buildPayload(`Response for ${sessionId} `, assistantPayloadSize),
      { agentId }
    )
  );

  for (let index = 0; index < userMessageCount; index++) {
    lines.push(
      buildToolResultEntry(
        sessionId,
        projectPath,
        timestamp,
        buildPayload(`Tool output ${index} for ${sessionId} `, toolResultPayloadSize),
        index,
        { agentId }
      )
    );
  }

  if (malformedLine !== undefined) {
    lines.splice(1, 0, malformedLine);
  }

  return lines.join('\n');
}

export function buildUntitledSessionJson(
  options: Omit<LargeSessionFixtureOptions, 'summary'>
): string {
  return buildLargeSessionJson({ ...options, summary: null });
}
