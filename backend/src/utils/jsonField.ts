export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeScenario<
  T extends {
    groupChatRounds: string;
    openingMessageJson?: string | null;
    initialBlackboardJson?: string | null;
  }
>(scenario: T) {
  const { openingMessageJson, initialBlackboardJson: _initialBlackboardJson, ...publicScenario } = scenario;

  return {
    ...publicScenario,
    groupChatRounds: parseJsonField<number[]>(scenario.groupChatRounds, []),
    openingMessage: parseJsonField<Record<string, string> | null>(openingMessageJson, null)
  };
}

export function normalizeSession<
  T extends {
    blackboardState: string;
    reportJson?: string | null;
    groupChatSummary?: string | null;
  }
>(session: T) {
  return {
    ...session,
    blackboardState: parseJsonField<Record<string, unknown>>(session.blackboardState, {}),
    reportJson: parseJsonField<Record<string, unknown> | null>(session.reportJson, null),
    groupChatSummary: parseJsonField<Record<string, unknown> | null>(session.groupChatSummary, null)
  };
}

export function normalizeDiscussion<T extends { inputJson: string; outputJson: string }>(discussion: T) {
  return {
    ...discussion,
    inputJson: parseJsonField<Record<string, unknown>>(discussion.inputJson, {}),
    outputJson: parseJsonField<Record<string, unknown>>(discussion.outputJson, {})
  };
}

export function normalizeTraceEvent<T extends { payloadJson?: string | null; createdAt: Date }>(event: T) {
  const { payloadJson, ...publicEvent } = event;
  return {
    ...publicEvent,
    payload: parseJsonField<Record<string, unknown> | null>(payloadJson, null),
    createdAt: event.createdAt.toISOString()
  };
}
