import { describe, expect, it } from "vitest";
import type { Message } from "@prisma/client";
import { classifyUserReply, evaluateResponseQuality } from "../src/services/responseQuality.service";

function userMessage(content: string): Message {
  return {
    id: `msg_${content}`,
    sessionId: "session",
    senderType: "user",
    senderName: "用户",
    senderRole: "受试者",
    content,
    roundIndex: 1,
    createdAt: new Date()
  };
}

describe("response quality gate", () => {
  it("terminates when the turn timer expires", () => {
    const gate = evaluateResponseQuality([], "__ASSESSMENT_TIME_EXPIRED__");

    expect(gate.shouldTerminate).toBe(true);
    expect(gate.reason).toBe("time_expired");
    expect(gate.consecutiveLowInformation).toBe(1);
  });

  it("flags empty replies but does not terminate on them", () => {
    expect(classifyUserReply("   ")?.reason).toBe("empty_reply");

    const gate = evaluateResponseQuality([], "   ");
    expect(gate.shouldTerminate).toBe(false);
  });

  it("never terminates on natural-language replies", () => {
    const gate = evaluateResponseQuality([], "不知道");
    expect(gate.shouldTerminate).toBe(false);
  });
});

// 词表匹配曾把正常作答误判为低信息/退出（如"不清楚他们的排期""不会耽误""放弃美化""等您会议结束"），
// 导致高质量回答被提前收束。该判定已整体停用，此处固化回归：任何自然语言都不触发终止。
describe("response quality gate — text-based termination disabled", () => {
  const replies = [
    "不知道",
    "7",
    "算了，随便吧",
    "我不想答",
    "退出",
    "不测了",
    "结束吧",
    "stop",
    "BI系统那边我暂时不敢直接找数据组拉数，因为我不清楚他们的排期。",
    "如果我哪里想得不对，我马上调整，不会耽误太久。",
    "告诉她放弃所有美化，直接用基础图表填数据。",
    "重点检查标题清不清楚、数据来源有没有漏标。",
    "我绝对不会让小秋一个人扛。",
    "等您会议结束，我第一时间拿着摘要去找您。"
  ];

  it.each(replies)("does not terminate on: %s", (reply) => {
    const gate = evaluateResponseQuality([], reply);
    expect(gate.shouldTerminate).toBe(false);
    expect(gate.reason).toBe("");
  });

  it.each(replies)("does not classify as low information: %s", (reply) => {
    expect(classifyUserReply(reply)).toBeNull();
  });
});
