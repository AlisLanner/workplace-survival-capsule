import type { CoverageState } from "./slotTracker.service";
import { createInitialCoverageState } from "./slotTracker.service";

interface BaseNpcMemory {
  last_concern: string;
  observed_user_signal: string;
  response_mode: string;
}

interface LeaderMemory extends BaseNpcMemory {
  trust: number;
  pressure: number;
}

interface CoworkerMemory extends BaseNpcMemory {
  cooperation: number;
  defensiveness: number;
}

interface ClientMemory extends BaseNpcMemory {
  trust: number;
  anxiety: number;
}

export interface Blackboard {
  round: number;
  min_round: number;
  max_round: number;
  phase: string;
  pressure_level: number;
  current_focus: string;
  scenario_facts: {
    user_role: string;
    project: string;
    demo_time: string;
    current_time: string;
    known_facts: string[];
    unknowns: string[];
    completed_features: string[];
    at_risk_features: string[];
    capability_dimensions: string[];
    agent_profiles: {
      leader: { name: string; role: string; concern: string };
      coworker: { name: string; role: string; concern: string };
      client: { name: string; role: string; concern: string };
    };
  };
  user_progress: {
    identified_core_flow: boolean;
    clarified_scope: boolean;
    separated_must_have_from_optional: boolean;
    asked_clarifying_questions: boolean;
    used_given_facts: boolean;
    stated_assumptions: boolean;
    proposed_viable_alternative: boolean;
    gave_owner: boolean;
    gave_timeline: boolean;
    gave_risk_plan: boolean;
    handled_coworker_conflict: boolean;
    managed_client_expectation: boolean;
    final_plan_complete: boolean;
  };
  latest_user_behavior: {
    over_promise: boolean;
    blame_shifting: boolean;
    avoidance: boolean;
    premature_solution: boolean;
    unsupported_assumption: boolean;
    honest_risk_with_fallback: boolean;
    takes_ownership: boolean;
    pressure_resistant: boolean;
  };
  unresolved_items: string[];
  npc_memory: {
    leader: LeaderMemory;
    coworker: CoworkerMemory;
    client: ClientMemory;
  };
  evaluation_notes: {
    strengths: string[];
    risks: string[];
    evidence: string[];
  };
  conversation_control: {
    last_active_agent: string;
    suggested_next_agent: string;
    trigger_group_discussion: boolean;
    should_finish: boolean;
    finish_reason: string;
  };
  group_discussion_summary: Record<string, unknown>;
  coverage_state?: CoverageState;
}

const userProgressKeys = [
  "identified_core_flow",
  "clarified_scope",
  "separated_must_have_from_optional",
  "asked_clarifying_questions",
  "used_given_facts",
  "stated_assumptions",
  "proposed_viable_alternative",
  "gave_owner",
  "gave_timeline",
  "gave_risk_plan",
  "handled_coworker_conflict",
  "managed_client_expectation",
  "final_plan_complete"
] as const;

const behaviorKeys = [
  "over_promise",
  "blame_shifting",
  "avoidance",
  "premature_solution",
  "unsupported_assumption",
  "honest_risk_with_fallback",
  "takes_ownership",
  "pressure_resistant"
] as const;

export function createInitialBlackboard(maxRound = 15, scenarioId = "project_demo_crisis"): Blackboard {
  if (scenarioId === "coffee_shop_complaint") {
    return createRestaurantComplaintBlackboard(maxRound);
  }
  if (scenarioId === "promo_outage_crisis") {
    return createPromoOutageBlackboard(maxRound);
  }
  if (scenarioId === "handover_review_crisis") {
    return createHandoverReviewBlackboard(maxRound);
  }
  if (scenarioId === "first_week_assignment") {
    return createFirstWeekAssignmentBlackboard(maxRound);
  }

  return {
    round: 0,
    min_round: 8,
    max_round: maxRound,
    phase: "meeting_room_opening",
    pressure_level: 2,
    current_focus: "在下午4点汇报前的120分钟窗口内，如何处理缺设计稿的约束——向VP呈现可汇报方案、与隔壁组谈借人条件、给应届生方向而非否定",
    scenario_facts: {
      user_role: "项目负责人，下午4点要向VP陈总呈现可汇报的方案。你有120分钟。目前最大的问题是：关键的三页设计稿缺失。",
      project: "下午4点陈总向CEO做Q3方案汇报。你需要在此之前帮他理清：哪些数据确认过、哪些是假设、设计稿缺口怎么处理。",
      demo_time: "今天下午4点",
      current_time: "下午1:30，距离陈总向CEO汇报还有120分钟",
      known_facts: [
        "汇报需要包含数据可视化页面，但对应的三页设计稿还没出来。",
        "陈总下午4点要向CEO汇报——他需要确认每个数字都有依据、每个结论都有owner。",
        "汇报材料需要区分确认项、假设项、负责人和风险说明。",
        "苏姐团队有可协作的设计资源，但当前负载较高，是否能支持仍未知。",
        "小秋可以协助视觉执行，但商业VI标准、交付边界和反馈节奏需要明确。"
      ],
      unknowns: [
        "苏姐团队能支持到什么程度未知。",
        "小秋在现有时间内能交付到什么质量未知。",
        "陈总对当前材料的可接受边界未知。"
      ],
      completed_features: ["数据部分的原始数据已收集", "汇报框架已有初稿"],
      at_risk_features: ["三页数据可视化设计稿缺失", "陈总对数据来源的验证需求", "苏姐团队的承载能力", "小秋的VI执行质量"],
      capability_dimensions: ["信息辨别", "交付切分", "备选方案", "承诺边界", "向上对齐", "横向协商", "新人赋能", "压力表达"],
      agent_profiles: {
        leader: {
          name: "陈总",
          role: "VP",
          concern: "汇报材料的事实依据、假设边界、负责人和风险说明"
        },
        coworker: {
          name: "苏姐",
          role: "隔壁组Leader",
          concern: "协作资源负载、交换条件和责任边界"
        },
        client: {
          name: "小秋",
          role: "团队应届生",
          concern: "执行边界、参考标准、反馈节奏和可交付范围"
        }
      }
    },
    user_progress: {
      identified_core_flow: false,
      clarified_scope: false,
      separated_must_have_from_optional: false,
      asked_clarifying_questions: false,
      used_given_facts: false,
      stated_assumptions: false,
      proposed_viable_alternative: false,
      gave_owner: false,
      gave_timeline: false,
      gave_risk_plan: false,
      handled_coworker_conflict: false,
      managed_client_expectation: false,
      final_plan_complete: false
    },
    latest_user_behavior: {
      over_promise: false,
      blame_shifting: false,
      avoidance: false,
      premature_solution: false,
      unsupported_assumption: false,
      honest_risk_with_fallback: false,
      takes_ownership: false,
      pressure_resistant: false
    },
    unresolved_items: [
      "硬截止交付范围未确认",
      "设计稿缺口路径和替代路径未确认",
      "协作资源边界未确认",
      "执行者标准和反馈节奏未确认"
    ],
    npc_memory: {
      leader: {
        trust: 2,
        pressure: 3,
        last_concern: "还没听到任何人告诉我哪些数字确认过、哪些是assumption",
        observed_user_signal: "not_observed",
        response_mode: "press_for_evidence_boundary_and_owner"
      },
      coworker: {
        cooperation: 2,
        defensiveness: 3,
        last_concern: "协作负载、交换条件和责任边界仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "probe_resource_load_exchange_and_boundary"
      },
      client: {
        trust: 2,
        anxiety: 4,
        last_concern: "执行边界、参考标准和反馈节奏仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "probe_standard_boundary_feedback_cadence"
      }
    },
    evaluation_notes: {
      strengths: [],
      risks: [],
      evidence: []
    },
    conversation_control: {
      last_active_agent: "leader",
      suggested_next_agent: "leader",
      trigger_group_discussion: false,
      should_finish: false,
      finish_reason: ""
    },
    group_discussion_summary: {},
    coverage_state: createInitialCoverageState("project_demo_crisis")
  };
}

function createRestaurantComplaintBlackboard(maxRound: number): Blackboard {
  return {
    round: 0,
    min_round: 8,
    max_round: maxRound,
    phase: "vip_guest_crisis_opening",
    pressure_level: 3,
    current_focus: "同时处理现场影响、员工纠错和前厅后厨协同风险",
    scenario_facts: {
      user_role: "餐厅值班经理，需要在今晚这场出品事故中处理现场影响、员工纠错和后厨协同。",
      project: "珍味轩8号桌重要客人宴请时，第二道菜出现出品问题。问题菜品已撤下，现场尚未失控。",
      demo_time: "今晚",
      current_time: "刘总的客人还在8号桌坐着，小林在后巷，江师傅在厨房里不说话。",
      known_facts: [
        "8号桌是重要客人宴请，现场体验和后续合作氛围都受到影响。",
        "第二道菜出现出品问题，问题菜品已撤下，现场秩序暂未失控。",
        "小林是后厨学徒，跳过了装盘后灯下复核和盘边异物检查。",
        "江师傅负责后厨出品质量，对前厅催单和后厨复核边界很敏感。"
      ],
      unknowns: [
        "刘总能接受什么补救方式未知。",
        "小林能否稳定执行后续复核标准未知。",
        "江师傅是否愿意配合流程改进未知。"
      ],
      completed_features: ["问题菜品已撤下", "现场秩序暂未失控"],
      at_risk_features: ["客人体验与后续合作氛围", "小林后续复核稳定性", "江师傅对管理协同的信任", "前厅后厨配合流程"],
      capability_dimensions: ["利害识别", "现场止损", "规则边界", "承诺边界", "面子修复", "员工修复", "后厨协同", "系统改进"],
      agent_profiles: {
        leader: {
          name: "刘总",
          role: "8号桌客人",
          concern: "现场体验受损，需要看到清楚、体面、可见的处理动作"
        },
        coworker: {
          name: "小林",
          role: "后厨学徒",
          concern: "责任边界、补救动作和后续复核标准"
        },
        client: {
          name: "江师傅",
          role: "后厨主管",
          concern: "前厅后厨协同、出品质量和流程责任"
        }
      }
    },
    user_progress: {
      identified_core_flow: false,
      clarified_scope: false,
      separated_must_have_from_optional: false,
      asked_clarifying_questions: false,
      used_given_facts: false,
      stated_assumptions: false,
      proposed_viable_alternative: false,
      gave_owner: false,
      gave_timeline: false,
      gave_risk_plan: false,
      handled_coworker_conflict: false,
      managed_client_expectation: false,
      final_plan_complete: false
    },
    latest_user_behavior: {
      over_promise: false,
      blame_shifting: false,
      avoidance: false,
      premature_solution: false,
      unsupported_assumption: false,
      honest_risk_with_fallback: false,
      takes_ownership: false,
      pressure_resistant: false
    },
    unresolved_items: [
      "现场影响控制和可见补救方式未确认",
      "员工责任、纠错方式和复核标准未确认",
      "后厨协同、流程责任和专业边界未确认",
      "前厅后厨流程方案未确认"
    ],
    npc_memory: {
      leader: {
        trust: 2,
        pressure: 3,
        last_concern: "现场影响和可见补救边界仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "probe_visible_recovery_boundary_and_next_action"
      },
      coworker: {
        cooperation: 2,
        defensiveness: 4,
        last_concern: "责任、纠错方式和复核标准仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "probe_correction_boundary_and_recovery_standard"
      },
      client: {
        trust: 1,
        anxiety: 4,
        last_concern: "前厅后厨衔接、流程责任和专业边界仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "probe_front_back_process_boundary_and_responsibility"
      }
    },
    evaluation_notes: {
      strengths: [],
      risks: [],
      evidence: []
    },
    conversation_control: {
      last_active_agent: "leader",
      suggested_next_agent: "leader",
      trigger_group_discussion: false,
      should_finish: false,
      finish_reason: ""
    },
    group_discussion_summary: {},
    coverage_state: createInitialCoverageState("coffee_shop_complaint")
  };
}

function createPromoOutageBlackboard(maxRound: number): Blackboard {
  return {
    round: 0,
    min_round: 8,
    max_round: maxRound,
    phase: "promo_outage_opening",
    pressure_level: 4,
    current_focus: "同时处理恢复现场、对外口径、客服边界和复盘责任",
    scenario_facts: {
      user_role: "值班负责人，零点大促支付通道大面积超时，需要先恢复现场、稳住对外口径，再谈根因与复盘。",
      project: "零点大促开始 20 分钟，支付通道大面积超时，工单在群里刷屏，系统仍在降级运行。",
      demo_time: "零点大促进行中",
      current_time: "大促开始 20 分钟，支付通道大面积超时，每分钟都有用户在流失",
      known_facts: [
        "零点大促开始 20 分钟，支付通道出现大面积超时，工单在群里刷屏。",
        "系统仍在降级运行，每分钟都有用户在流失。",
        "王总盯着大屏要判断，需要恢复优先级和时间表。",
        "小郑被用户直接质问，需要统一话术与支持。",
        "老周在排查，但没有人告诉他业务影响面和恢复优先级。"
      ],
      unknowns: [
        "根因定位需要多久未知。",
        "支付通道恢复的具体时间未知。",
        "对外口径的授权边界未知。"
      ],
      completed_features: ["故障已定位为支付通道超时", "系统降级运行中，未完全宕机"],
      at_risk_features: ["用户流失速度", "客服承压状态", "对外口径一致性", "复盘与防复发机制"],
      capability_dimensions: ["利害识别", "现场止损", "规则边界", "承诺边界", "体面修复", "员工修复", "跨团队协同", "系统改进"],
      agent_profiles: {
        leader: {
          name: "王总",
          role: "运营总监",
          concern: "恢复优先级、时间表和对外承诺边界"
        },
        coworker: {
          name: "小郑",
          role: "客服专员",
          concern: "被用户质问，需要统一话术、承诺边界和支持"
        },
        client: {
          name: "老周",
          role: "研发负责人",
          concern: "业务影响面、恢复优先级和跨团队信息同步"
        }
      }
    },
    user_progress: {
      identified_core_flow: false,
      clarified_scope: false,
      separated_must_have_from_optional: false,
      asked_clarifying_questions: false,
      used_given_facts: false,
      stated_assumptions: false,
      proposed_viable_alternative: false,
      gave_owner: false,
      gave_timeline: false,
      gave_risk_plan: false,
      handled_coworker_conflict: false,
      managed_client_expectation: false,
      final_plan_complete: false
    },
    latest_user_behavior: {
      over_promise: false,
      blame_shifting: false,
      avoidance: false,
      premature_solution: false,
      unsupported_assumption: false,
      honest_risk_with_fallback: false,
      takes_ownership: false,
      pressure_resistant: false
    },
    unresolved_items: [
      "恢复优先级未确认",
      "对外口径未定",
      "客服话术边界未定",
      "复盘责任未定"
    ],
    npc_memory: {
      leader: {
        trust: 2,
        pressure: 4,
        last_concern: "恢复优先级和时间表仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "press_for_priority_and_timeline"
      },
      coworker: {
        cooperation: 2,
        defensiveness: 3,
        last_concern: "话术边界与支持仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "request_script_and_support"
      },
      client: {
        trust: 2,
        anxiety: 4,
        last_concern: "业务影响面和恢复优先级仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "probe_impact_scope_and_priority"
      }
    },
    evaluation_notes: {
      strengths: [],
      risks: [],
      evidence: []
    },
    conversation_control: {
      last_active_agent: "leader",
      suggested_next_agent: "leader",
      trigger_group_discussion: false,
      should_finish: false,
      finish_reason: ""
    },
    group_discussion_summary: {},
    coverage_state: createInitialCoverageState("promo_outage_crisis")
  };
}

function createHandoverReviewBlackboard(maxRound: number): Blackboard {
  return {
    round: 0,
    min_round: 8,
    max_round: maxRound,
    phase: "handover_review_opening",
    pressure_level: 3,
    current_focus: "同时处理历史承诺真实性、评审口径、老员工协作和新人接手范围",
    scenario_facts: {
      user_role: "项目组新负责人，接手第三周，三天后季度评审，需要收敛出能上会的真实状态。",
      project: "空降接手项目组第三周，上一任留下一堆口头承诺和一张没人维护的看板，三天后是季度评审。",
      demo_time: "三天后季度评审",
      current_time: "接手第三周，距离季度评审还有三天",
      known_facts: [
        "上一任留下一堆口头承诺和一张没人维护的看板。",
        "三天后是季度评审，梁总要能上会的状态。",
        "老郑在这个组七年，对新负责人还不多话。",
        "小楠接了一堆说不清的活，不敢来问。"
      ],
      unknowns: [
        "历史承诺里哪些是实数、哪些是虚的未知。",
        "老郑愿意配合到什么程度未知。",
        "小楠接手的具体范围未知。"
      ],
      completed_features: ["口头承诺清单已收集", "看板状态已导出"],
      at_risk_features: ["历史承诺真实性", "评审口径", "老员工信任", "新人接手边界"],
      capability_dimensions: ["信息辨别", "交付切分", "备选方案", "承诺边界", "向上对齐", "横向协商", "新人赋能", "压力表达"],
      agent_profiles: {
        leader: {
          name: "梁总",
          role: "事业部VP",
          concern: "可上会状态：哪些是实数、哪些是虚的，owner 和风险"
        },
        coworker: {
          name: "老郑",
          role: "资深员工",
          concern: "观察新负责人怎么对待老组员，防被当枪使"
        },
        client: {
          name: "小楠",
          role: "新入职成员",
          concern: "接手范围、边界和反馈节奏"
        }
      }
    },
    user_progress: {
      identified_core_flow: false,
      clarified_scope: false,
      separated_must_have_from_optional: false,
      asked_clarifying_questions: false,
      used_given_facts: false,
      stated_assumptions: false,
      proposed_viable_alternative: false,
      gave_owner: false,
      gave_timeline: false,
      gave_risk_plan: false,
      handled_coworker_conflict: false,
      managed_client_expectation: false,
      final_plan_complete: false
    },
    latest_user_behavior: {
      over_promise: false,
      blame_shifting: false,
      avoidance: false,
      premature_solution: false,
      unsupported_assumption: false,
      honest_risk_with_fallback: false,
      takes_ownership: false,
      pressure_resistant: false
    },
    unresolved_items: [
      "历史承诺真实性未确认",
      "评审口径未定",
      "老郑协作条件未确认",
      "小楠接手范围未定"
    ],
    npc_memory: {
      leader: {
        trust: 2,
        pressure: 3,
        last_concern: "评审口径和事实依据仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "press_for_facts_and_owner"
      },
      coworker: {
        cooperation: 1,
        defensiveness: 4,
        last_concern: "新负责人怎么对待老组员仍在观察",
        observed_user_signal: "not_observed",
        response_mode: "observe_and_set_boundary"
      },
      client: {
        trust: 2,
        anxiety: 4,
        last_concern: "接手范围和反馈节奏仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "request_boundary_and_feedback"
      }
    },
    evaluation_notes: {
      strengths: [],
      risks: [],
      evidence: []
    },
    conversation_control: {
      last_active_agent: "leader",
      suggested_next_agent: "leader",
      trigger_group_discussion: false,
      should_finish: false,
      finish_reason: ""
    },
    group_discussion_summary: {},
    coverage_state: createInitialCoverageState("handover_review_crisis")
  };
}

function createFirstWeekAssignmentBlackboard(maxRound: number): Blackboard {
  return {
    round: 0,
    min_round: 8,
    max_round: maxRound,
    phase: "first_week_assignment_opening",
    pressure_level: 3,
    current_focus: "入职第一周:确认需求口径、守住交付边界、拿到数据支持、对业务方兑现承诺",
    scenario_facts: {
      user_role: "运营组入职第一周的新人,周五前要给业务方一份渠道复盘报告,数据依赖数据组。",
      project: "主管把跨部门需求交给新人:周五前出渠道复盘报告,数据要数据组的大周出,业务方方姐本周就要结果。",
      demo_time: "周五下午两点交付初版",
      current_time: "周一早上,距离周五交付还有四天",
      known_facts: [
        "周五下午两点是许主管给的初版截止,方姐本周就要结果。",
        "报告需要数据组大周提供渠道数据,大周当前排期到下周。",
        "新人系统权限只开了一半,数据口径没人完整讲过。",
        "许主管说大周卡人就回来找他,但要求先自己把需求说清楚。"
      ],
      unknowns: [
        "大周能挤出多少时间未知。",
        "数据口径以哪版为准未知。",
        "方姐对交付形式的接受边界未知。"
      ],
      completed_features: ["需求已被主管转达", "报告框架可自行搭建"],
      at_risk_features: ["数据获取路径", "数据口径", "周五交付承诺", "业务方信任"],
      capability_dimensions: ["需求澄清", "优先级判断", "横向协作", "诚实沟通", "边界表达", "向上同步", "压力表达", "担当推进"],
      agent_profiles: {
        leader: {
          name: "许主管",
          role: "部门主管",
          concern: "周五交付能否兑现、新人是否先确认口径、卡住时会不会出声升级"
        },
        coworker: {
          name: "大周",
          role: "数据组资深",
          concern: "需求是否写清楚、交换条件、数据口径责任归属"
        },
        client: {
          name: "方姐",
          role: "业务方对接人",
          concern: "周五能拿到什么、新人靠不靠谱、数据源口径懂不懂"
        }
      }
    },
    user_progress: {
      identified_core_flow: false,
      clarified_scope: false,
      separated_must_have_from_optional: false,
      asked_clarifying_questions: false,
      used_given_facts: false,
      stated_assumptions: false,
      proposed_viable_alternative: false,
      gave_owner: false,
      gave_timeline: false,
      gave_risk_plan: false,
      handled_coworker_conflict: false,
      managed_client_expectation: false,
      final_plan_complete: false
    },
    latest_user_behavior: {
      over_promise: false,
      blame_shifting: false,
      avoidance: false,
      premature_solution: false,
      unsupported_assumption: false,
      honest_risk_with_fallback: false,
      takes_ownership: false,
      pressure_resistant: false
    },
    unresolved_items: [
      "需求口径与数据权限未确认",
      "周五交付路径未确认",
      "大周排期与交换条件未确认",
      "方姐预期与交付边界未确认"
    ],
    npc_memory: {
      leader: {
        trust: 2,
        pressure: 3,
        last_concern: "新人是否先确认口径、分清主次,卡住时会不会出声",
        observed_user_signal: "not_observed",
        response_mode: "press_for_scope_and_escalation"
      },
      coworker: {
        cooperation: 1,
        defensiveness: 4,
        last_concern: "需求文档化和口径责任仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "probe_requirement_documentation_and_exchange"
      },
      client: {
        trust: 1,
        anxiety: 5,
        last_concern: "周五能拿到什么、新人是否靠谱仍未确认",
        observed_user_signal: "not_observed",
        response_mode: "press_for_deliverable_and_credibility"
      }
    },
    evaluation_notes: {
      strengths: [],
      risks: [],
      evidence: []
    },
    conversation_control: {
      last_active_agent: "leader",
      suggested_next_agent: "leader",
      trigger_group_discussion: false,
      should_finish: false,
      finish_reason: ""
    },
    group_discussion_summary: {},
    coverage_state: createInitialCoverageState("first_week_assignment")
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function boundedMemoryNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(5, Math.round(value)))
    : fallback;
}

function structuralString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;
}

function mergeLeaderMemory(base: LeaderMemory, patch: unknown): LeaderMemory {
  const next = asRecord(patch);
  return {
    trust: boundedMemoryNumber(next.trust, base.trust),
    pressure: boundedMemoryNumber(next.pressure, base.pressure),
    last_concern: structuralString(next.last_concern, base.last_concern),
    observed_user_signal: structuralString(next.observed_user_signal, base.observed_user_signal),
    response_mode: structuralString(next.response_mode, base.response_mode)
  };
}

function mergeCoworkerMemory(base: CoworkerMemory, patch: unknown): CoworkerMemory {
  const next = asRecord(patch);
  return {
    cooperation: boundedMemoryNumber(next.cooperation, base.cooperation),
    defensiveness: boundedMemoryNumber(next.defensiveness, base.defensiveness),
    last_concern: structuralString(next.last_concern, base.last_concern),
    observed_user_signal: structuralString(next.observed_user_signal, base.observed_user_signal),
    response_mode: structuralString(next.response_mode, base.response_mode)
  };
}

function mergeClientMemory(base: ClientMemory, patch: unknown): ClientMemory {
  const next = asRecord(patch);
  return {
    trust: boundedMemoryNumber(next.trust, base.trust),
    anxiety: boundedMemoryNumber(next.anxiety, base.anxiety),
    last_concern: structuralString(next.last_concern, base.last_concern),
    observed_user_signal: structuralString(next.observed_user_signal, base.observed_user_signal),
    response_mode: structuralString(next.response_mode, base.response_mode)
  };
}

export function mergeBlackboard(base: Blackboard, patch?: Record<string, unknown> | null): Blackboard {
  if (!patch || typeof patch !== "object") {
    return base;
  }

  const typedPatch = patch as Partial<Blackboard>;
  const memoryPatch = asRecord(typedPatch.npc_memory);
  return {
    ...base,
    ...typedPatch,
    scenario_facts: {
      ...base.scenario_facts,
      ...(typedPatch.scenario_facts ?? {})
    },
    user_progress: {
      ...base.user_progress,
      ...(typedPatch.user_progress ?? {})
    },
    latest_user_behavior: {
      ...base.latest_user_behavior,
      ...(typedPatch.latest_user_behavior ?? {})
    },
    npc_memory: {
      leader: mergeLeaderMemory(base.npc_memory.leader, memoryPatch.leader),
      coworker: mergeCoworkerMemory(base.npc_memory.coworker, memoryPatch.coworker),
      client: mergeClientMemory(base.npc_memory.client, memoryPatch.client)
    },
    evaluation_notes: {
      strengths: [...base.evaluation_notes.strengths, ...(typedPatch.evaluation_notes?.strengths ?? [])],
      risks: [...base.evaluation_notes.risks, ...(typedPatch.evaluation_notes?.risks ?? [])],
      evidence: [...base.evaluation_notes.evidence, ...(typedPatch.evaluation_notes?.evidence ?? [])]
    },
    conversation_control: {
      ...base.conversation_control,
      ...(typedPatch.conversation_control ?? {})
    },
    group_discussion_summary: {
      ...base.group_discussion_summary,
      ...(typedPatch.group_discussion_summary ?? {})
    }
  };
}

export function applyDetectedBehavior(
  blackboard: Blackboard,
  detectedBehavior?: Record<string, boolean>
): Blackboard {
  if (!detectedBehavior) {
    return blackboard;
  }

  const progressPatch: Partial<Blackboard["user_progress"]> = {};
  const behaviorPatch: Partial<Blackboard["latest_user_behavior"]> = {};

  for (const key of userProgressKeys) {
    if (typeof detectedBehavior[key] === "boolean") {
      progressPatch[key] = blackboard.user_progress[key] || detectedBehavior[key];
    }
  }

  for (const key of behaviorKeys) {
    if (typeof detectedBehavior[key] === "boolean") {
      behaviorPatch[key] = detectedBehavior[key];
    }
  }

  return mergeBlackboard(blackboard, {
    user_progress: progressPatch,
    latest_user_behavior: behaviorPatch
  });
}

export function mergeNpcMemory(
  blackboard: Blackboard,
  memoryUpdate?: Record<string, unknown>
): Blackboard {
  if (!memoryUpdate) {
    return blackboard;
  }

  return mergeBlackboard(blackboard, {
    npc_memory: memoryUpdate
  });
}

export function addGroupSummary(
  blackboard: Blackboard,
  round: number,
  summary: Record<string, unknown>
): Blackboard {
  return mergeBlackboard(blackboard, {
    group_discussion_summary: {
      [`round_${round}`]: summary
    }
  });
}
