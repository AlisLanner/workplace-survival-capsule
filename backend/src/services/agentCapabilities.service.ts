import type { AgentCapabilityCard } from "../types/agent";

export const assessmentAgentCapabilityCards: AgentCapabilityCard[] = [
  {
    name: "Director",
    role: "测评刺激控制器，决定下一轮观察目标、压力点和接手角色。",
    visibleContext: ["filtered_blackboard", "chat_history", "current_user_reply", "coverage_summary"],
    handoffTargets: ["GroupGuard", "LeaderRoleAgent", "CoworkerRoleAgent", "ClientRoleAgent", "Judge"],
    guardrails: ["must_not_score", "must_not_expose_rubric", "must_route_by_coverage", "finish_requires_coverage_or_max_round"],
    outputSchema: "DirectorResult"
  },
  {
    name: "GroupGuard",
    role: "内部一致性校验器，检查 Director 的角色选择、记忆状态和场景焦点是否冲突。",
    visibleContext: ["group_discussion_view", "director_proposal", "chat_history_summary"],
    handoffTargets: ["Director", "LeaderRoleAgent", "CoworkerRoleAgent", "ClientRoleAgent"],
    guardrails: ["protective_only", "no_second_director", "no_scoring", "safe_correction_only"],
    outputSchema: "GroupDiscussionResult"
  },
  {
    name: "LeaderRoleAgent",
    role: "上级/负责人角色，只负责可见追问和压力表达。",
    visibleContext: ["npc_view", "public_scenario_facts", "npc_memory", "round_instruction"],
    handoffTargets: ["Director"],
    guardrails: ["no_rubric_access", "no_answer_leak", "boundary_guard", "visible_reply_only"],
    outputSchema: "NpcResult"
  },
  {
    name: "CoworkerRoleAgent",
    role: "协作方/员工角色，只负责从自身处境追问用户取舍。",
    visibleContext: ["npc_view", "public_scenario_facts", "npc_memory", "round_instruction"],
    handoffTargets: ["Director"],
    guardrails: ["no_rubric_access", "no_answer_leak", "boundary_guard", "visible_reply_only"],
    outputSchema: "NpcResult"
  },
  {
    name: "ClientRoleAgent",
    role: "客户/外部相关方角色，只负责追问预期、边界和风险。",
    visibleContext: ["npc_view", "public_scenario_facts", "npc_memory", "round_instruction"],
    handoffTargets: ["Director"],
    guardrails: ["no_rubric_access", "no_answer_leak", "boundary_guard", "visible_reply_only"],
    outputSchema: "NpcResult"
  },
  {
    name: "Judge",
    role: "结束后读取 Judge view 和 rubric，生成报告并执行采样可靠性检查。",
    visibleContext: ["judge_view", "full_chat_history", "group_summary", "rubric"],
    handoffTargets: ["Finalize"],
    guardrails: ["report_reliability_gate", "coverage_downgrade", "sampling_variance_check", "no_visible_dialogue"],
    outputSchema: "JudgeReport"
  }
];

export function getAssessmentAgentCapabilityCards(): AgentCapabilityCard[] {
  return assessmentAgentCapabilityCards;
}
