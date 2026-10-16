import { createHash } from "node:crypto";
import observations from "./observations.json";
import v2 from "./versions/ge8-20261016.2.json";
import v3 from "./versions/ge8-20261016.3.json";
import v4 from "./versions/ge8-20261016.4.json";
import v5 from "./versions/ge8-20261016.5.json";
import v6 from "./versions/ge8-20261016.6.json";
import { calibration } from "./calibration";
import type { AgentName } from "../types/agent";
import type { Definition, DimensionId, Fact } from "./types";

export const VERSION = "ge8-20261016.7";
export const SCHEMA = "ge8/1";
export const BUNDLE = `${VERSION}/r01`;
export const PROMPT_NAMES = ["director", "leader", "coworker", "client", "group-discussion", "judge", "behavior-detector", "stage-director"] as const;
export const dimensions: Definition["dimensions"] = [
  ["GE01", "领导与决策", "在职责范围内作出选择、发起行动并担责；有管理职责时还观察指导与授权。"],
  ["GE02", "支持与合作", "理解并尊重他人，提供支持、共同处理问题；如实说明情况并遵守诚信原则。"],
  ["GE03", "互动与呈现", "针对沟通对象组织信息、说明理由、协商分歧，使对方能够理解并作出回应。"],
  ["GE04", "分析与解释", "区分事实、未知与假设，核验关键依据，分析原因、影响和不同选择的后果。"],
  ["GE05", "创造与概念化", "学习并吸收新信息，提出有针对性的新思路或改进机制，解释其如何解决问题。"],
  ["GE06", "组织与执行", "把目标转为优先级、责任、时间与检查安排，遵循已知程序并保障交付质量。"],
  ["GE07", "适应与应对", "关键条件变化后调整做法，受到催促、批评或挫折时仍能回应问题并推进任务。"],
  ["GE08", "进取与绩效", "提出与职责相称的工作提升目标，权衡业务价值、投入与成本；说明为何值得争取。"]
].map(([id, name, meaning]) => ({ id: id as DimensionId, name, meaning }));

const scenarios = [
  { code: "A", id: "project_demo_crisis", title: "周三下午的会议室", user: "项目负责人",
    names: ["陈总", "苏姐", "小秋"], roles: ["上级", "同级协作方", "团队新人"],
    facts: ["周三13:30开始，16:00向CEO汇报，剩余150分钟。数据已齐，3页数据可视化设计未齐。", "本人可拆分任务；跨组借人须苏姐确认，改变上会范围须陈总确认。", "小秋可在30分钟内完成可复核的素材整理，不是专业设计成品。", "基本汇报用于当前业务决策，要求数字可追溯、范围和负责人清楚。可选增值内容用于帮助比较决策选项；额外协作支持上限30分钟，是否值得由你判断。"],
    private: ["陈总对方案依据仍有疑问，需要你回应具体风险；没有批准改变汇报范围。", "苏姐本组已排满，跨组支持需要协商确认。", "小秋尚未核实部分素材，需要可理解的标准和求助条件；工具只支持现有素材整理。"],
    change: "苏姐原定的设计支持今天无法提供。", changeAgent: "coworker",
    limit: "小秋补充：目前工具只能复用已有素材，不能制作新的专业设计成品。", limitAgent: "client" },
  { code: "B", id: "coffee_shop_complaint", title: "8号桌的客人", user: "餐厅值班经理",
    names: ["刘总", "小林", "江师傅"], roles: ["8号桌客人", "后厨学徒", "后厨主管"],
    facts: ["8号桌第二道菜出品发生问题，菜已撤下；事故具体原因尚未确认。", "新出品必须由江师傅复核。值班经理可提出每桌不超过100元等值补救；超出或整单减免须上级确认。这是模拟门店权限。", "替换出品预计15分钟；当班最多协调1名服务员10分钟，仍需兼顾其他桌。", "基本目标是安全处理眼前问题；可争取恢复客人对后续服务的信任。等待、补救资源和其他桌服务是已知约束。"],
    private: ["刘总说明：用餐最多再等30分钟，仍对现场影响和处理安排有疑问。", "小林只掌握本人操作；其他环节仍需相关人员核对。", "江师傅只能使用当前当班人员，不能额外加人；出品复核不可省略。"],
    change: "江师傅确认后厨临时增加10分钟等待，替换出品现在预计25分钟。", changeAgent: "client",
    limit: "江师傅补充：现有人员不增加，出品检查须在现有交接流程中完成。", limitAgent: "client" },
  { code: "C", id: "promo_outage_crisis", title: "零点大促的故障工单", user: "值班负责人",
    names: ["王总", "小郑", "老周"], roles: ["运营总监", "客服", "研发协作方"],
    facts: ["大促支付通道超时，当前每10分钟增加100笔待处理订单；原因与恢复时点尚未确认。", "值班负责人仅协调业务和沟通。发布、回退由研发负责人确认；赔付由王总审批。", "甲路径须研发确认回退包已验证，并投入1名研发20分钟。乙路径须王总批准限流，仅保留已验证的60%渠道，需10分钟协调及后续30分钟客服处理。60%是渠道范围，不是成功率。", "基本目标是安全控制影响；可争取减少待处理订单、保全重要业务。路径条件和成本可比较，但不是唯一答案，不能无条件保证恢复效果。"],
    private: ["王总需在尽快保全交易与控制安全风险之间取舍，尚未批准限流或赔付；持续追问恢复时点。", "小郑正承受用户催促，需已确认事实和可持续的更新口径。", "老周只能说明已确认的研发条件，不能保证原因、恢复时点或成功概率。"],
    change: "老周确认甲路径的回退包当前尚未验证，发布前提不成立，暂不可用。", changeAgent: "client",
    limit: "老周补充：客服不能直接读取研发排查内部数据，信息交接仍须通过授权接口或已确认摘要。", limitAgent: "client" },
  { code: "E", id: "first_week_assignment", title: "入职第一周的需求对接", user: "无指挥权新人",
    names: ["许主管", "大周", "方姐"], roles: ["上级", "数据组资深同事", "业务需求方"],
    facts: ["周一开始，周五17:00交渠道复盘报告，用于下周渠道投入讨论。", "新人可安排本人工作和请求协作，不能指挥大周；指标口径由方姐确认，优先级由许主管确认。", "基础数据申请需半个工作日，额外分析约需2小时本人投入；大周已有排期。", "基本报告应交代渠道表现、来源、已确认口径及局限；可选增值分析用于比较投入方向，须判断额外2小时是否值得并请许主管确认范围。"],
    private: ["许主管关注周五可交付的基本报告与优先级，未授权新人给资深同事分工；对进度仍有疑问。", "大周提供现有渠道汇总数据，业务临时口径未必与原数据完全一致，需要说明来源和冲突。", "方姐确认报告用于下周投入讨论，需区分渠道、转化和投入，并标注口径；新口径需要核实数据适用性。"],
    change: "方姐新增要求：在原渠道汇总中增加新老用户的拆分比较；现有数据是否支持尚待确认。周五17:00截止未变。", changeAgent: "client",
    limit: "大周补充：新口径不能直接套用原渠道汇总，需先核对数据来源与可用字段。", limitAgent: "coworker" }
] as const;

export const definitions: Definition[] = scenarios.map(s => {
  const facts = s.facts.map((text, i) => ({id: `${s.code}:F${i+1}`, text}));
  const roleFacts = Object.fromEntries((["leader", "coworker", "client"] as AgentName[]).map((a,i)=>[a,[{id:`${s.code}:R${i+1}`,text:s.private[i]}]])) as Record<AgentName, Fact[]>;
  const events: Definition["events"] = [
    {id:`${s.code}:limit`,round:3,agent:s.limitAgent,facts:[{id:`${s.code}:L1`,text:s.limit}]},
    {id:`${s.code}:change`,round:5,agent:s.changeAgent,facts:[{id:`${s.code}:X1`,text:s.change}]}
  ];
  const slots = observations.filter(o=>o.scenario_code===s.code).map((o,i)=>({
    slot_id:`${VERSION}:${o.slot_id.split(":").at(-1)}`, display_code:o.display_code, dimension_id:o.dimension_id as DimensionId,
    observation:o.observation,target_agent:o.target_agent as AgentName,probe_intent:o.neutral_probe,
    required_fact_ids:[...facts.map(f=>f.id), ...(i===9?[`${s.code}:L1`]:[]), ...(i===12?[`${s.code}:X1`]:[]), ...(i===13?[`${s.code}:R1`]:[])],
    trigger_event_ids:i===9?[`${s.code}:limit`]:i===12?[`${s.code}:change`]:[],
    priority:[8,9,12,13,14,15].includes(i)?2:1
  }));
  return {
    assessment_version:VERSION,schema_version:SCHEMA,scenario_id:s.id,scenario_code:s.code,title:s.title,user_role:s.user,
    dimensions,roles:Object.fromEntries((["leader","coworker","client"] as AgentName[]).map((a,i)=>[a,{name:s.names[i],role:s.roles[i]}])) as Definition["roles"],
    slots,public_facts:facts,role_facts:roleFacts,events,round_policy:{min:8,max:15,max_consecutive_agent_rounds:2},prompt_bundle_version:BUNDLE,
    scoring_policy:{samples:5,total_variance_limit:80,dimension_range_limit:8,bands:[
      "0—5：必要信息和机会充分，仍明确回避行动或有直接不当行为；引用原话。",
      "6—10：有相关态度或零散动作，但关键依据、责任、条件或执行细节不足。",
      "11—15：主要判断动作基本适用，能说明依据与安排，但观察到重要缺口或衔接不足。",
      "16—20：两个点均有充分证据，判断、行动与边界一致，符合本岗位权限与条件。"
    ],boundaries:["合作看尊重、支持和共同承担；沟通看信息组织与协商。","比较已知方案归分析；新的适用思路和吸收信息后的改进归创造。","决策看选择和担责；执行看安排和跟踪。新人不评管理授权。","既定交付归执行；额外目标的价值与投入判断归进取。","稳定条件计划归执行；实际变化后的调整和质疑回应归适应。","诚信主要归合作，权限程序主要归执行；同一风险不全维重复扣分。"]},
    anchors:dimensions.map((d,i)=>{
      const example=calibration[s.code][i];
      const codes=slots.filter(x=>x.dimension_id===d.id).map(x=>x.display_code);
      const render=(quotes:string[])=>quotes.map((q,j)=>`${codes[j]}示例原话：“${q}”`).join("\n");
      return {dimension_id:d.id,
        low:`0—5的明确反向表现样例（必要信息和机会已提供）：\n${render(example.low)}\n${example.distinction}`,
        middle:`中间分档样例：\n${render(example.middle)}\n有相关动作但关键条件、责任或细节显著不足时为6—10；主要动作基本适用且有关键依据，但观察到衔接缺口时为11—15。须依据实际原话选择，不给样例固定分。`,
        high:`16—20的充分表现样例（不是唯一正确答案）：\n${render(example.high)}\n${example.distinction}`,
        missing:"必要事实未送达、没有机会，或回答仍无法判断两个点时保留null。单纯未提及、冗长空话和技术失败不能转换为0—5；先补中性追问，仍不足则复核。"};
    })
  };
});

export function hash(value: unknown): string { return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex"); }
export function getDefinition(id: string, version=VERSION): Definition {
  const d=[...definitions,...v2 as Definition[],...v3 as Definition[],...v4 as Definition[],...v5 as Definition[],...v6 as Definition[]].find(x=>x.scenario_id===id && x.assessment_version===version);
  if(!d) throw new Error(`未安装或不支持的测量定义：${id}/${version}`);
  return structuredClone(d);
}
export function validateDefinitions(list=definitions) {
  const ids=new Set<string>();
  for(const d of list) {
    if(d.dimensions.length!==8 || d.slots.length!==16 || d.dimensions.some((v,i)=>v.id!==dimensions[i].id || v.name!==dimensions[i].name)) throw new Error("八维契约无效");
    const facts=new Set([...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)].map(f=>f.id));
    for(const dim of d.dimensions) if(d.slots.filter(s=>s.dimension_id===dim.id).length!==2) throw new Error("每维须2点");
    for(const s of d.slots) {
      if(ids.has(s.slot_id) || !s.slot_id.startsWith(d.assessment_version+":") || !d.roles[s.target_agent] || s.required_fact_ids.some(f=>!facts.has(f)) || s.trigger_event_ids.some(e=>!d.events.some(x=>x.id===e))) throw new Error(`观察点契约无效：${s.slot_id}`);
      ids.add(s.slot_id);
    }
  }
}
validateDefinitions([...definitions,...v2 as Definition[],...v3 as Definition[],...v4 as Definition[],...v5 as Definition[],...v6 as Definition[]]);
