import type { Message } from "@prisma/client";

export interface LowInformationTurn {
  content: string;
  reason: string;
}

export interface ResponseQualityGate {
  shouldTerminate: boolean;
  reason: string;
  consecutiveLowInformation: number;
  lowInformationTurns: LowInformationTurn[];
}

export const TIME_EXPIRED_SIGNAL = "__ASSESSMENT_TIME_EXPIRED__";

// 说明：曾用"不知道/不清楚/不会/放弃/结束"等短语名单判定低信息回复与主动退出，
// 但子串匹配会把正常作答误判（如"不清楚他们的排期""不会耽误""放弃美化""等您会议结束"），
// 导致高质量回答被提前收束。该判定已整体停用，不再依据回复文本终止测评。
// 目前仅保留单轮计时到点的控制信号（前端定时器发出，精确匹配，无文本误判风险）。

function normalizeReply(content: string): string {
  return content.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isTimeExpiredSignal(content: string): boolean {
  const normalized = normalizeReply(content);
  return normalized === TIME_EXPIRED_SIGNAL.toLowerCase() ||
    normalized === "（时间到）" ||
    normalized === "(时间到)" ||
    normalized === "时间到";
}

/**
 * 仅识别系统控制信号与空回复；不再对自然语言作答做任何低信息判定。
 */
export function classifyUserReply(content: string): LowInformationTurn | null {
  if (isTimeExpiredSignal(content)) {
    return { content, reason: "time_expired" };
  }

  if (!normalizeReply(content)) {
    return { content, reason: "empty_reply" };
  }

  return null;
}

export function evaluateResponseQuality(_messages: Message[], currentUserMessage: string): ResponseQualityGate {
  const timeExpired = isTimeExpiredSignal(currentUserMessage);

  return {
    shouldTerminate: timeExpired,
    reason: timeExpired ? "time_expired" : "",
    consecutiveLowInformation: timeExpired ? 1 : 0,
    lowInformationTurns: timeExpired
      ? [{ content: currentUserMessage, reason: "time_expired" }]
      : []
  };
}
