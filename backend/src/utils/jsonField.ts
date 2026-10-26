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
  const {
    openingMessageJson,
    initialBlackboardJson: _initialBlackboardJson,
    assessmentDefinitionJson: _definition,
    briefJson: _brief,
    dimensionWeightsJson: _dimensionWeights,
    ...publicScenario
  } = scenario as T & { assessmentDefinitionJson?:string|null;briefJson?:string|null;dimensionWeightsJson?:string|null };

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
  const { assessmentSnapshotJson: _snapshot, scenario: _scenario, groupDiscussions: _discussions, agentTraceEvents: _traces, ...publicSession } = session as T & {assessmentSnapshotJson?:string|null;scenario?:unknown;groupDiscussions?:unknown;agentTraceEvents?:unknown;assessmentVersion?:string|null};
  const board=parseJsonField<Record<string, unknown>>(session.blackboardState, {});
  const publicBoard=publicSession.assessmentVersion ? Object.fromEntries(["schema_version","assessment_version","scenario_id","round","min_round","max_round","phase"].map(k=>[k,board[k]])) : board;
  return {
    ...publicSession,
    blackboardState: publicBoard,
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
