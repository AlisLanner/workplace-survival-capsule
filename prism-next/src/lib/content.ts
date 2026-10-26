export const scenes = [
  {code:"A", title:"周三下午的会议室", line1:"周三下午的", line2:"会议室", category:"管理协作", role:"项目负责人", summary:"汇报即将开始，设计稿却仍有缺口。", prompt:"如何在时间、质量与协作之间，找到可推进的下一步？", copy:"下午的项目汇报即将开始，关键设计稿仍有缺口。你需要核实已知信息与尚未确认的部分，确定当前交付范围，并回应上级、协作团队与新成员的不同诉求。", people:["陈总 · 上级","苏姐 · 协作团队负责人","小秋 · 团队新成员"], tone:"#9ab8c9", art:"meeting"},
  {code:"B", title:"8号桌的客人", line1:"8号桌的", line2:"客人", category:"餐饮服务", role:"餐厅值班经理", summary:"出品事故发生后，如何回应多方诉求。", prompt:"当现场感受与补救边界相遇，你会如何作出判断？", copy:"餐厅发生出品事故，客人的现场感受受到影响。你需要控制现场影响、处理员工纠错与责任边界，并与后厨协调可执行的补救安排。", people:["刘总 · 客人","小林 · 后厨学徒","江师傅 · 后厨主管"], tone:"#c6b194", art:"service"},
  {code:"C", title:"零点大促的故障工单", line1:"零点大促的", line2:"故障工单", category:"运营应急", role:"值班负责人", summary:"支付故障与多方压力，在零点同时到来。", prompt:"当问题同时到来，什么应该先被确认和处理？", copy:"大促期间支付通道出现故障，用户影响、客服压力与研发排查同时发生。你需要判断处理优先级、协调各方行动，并说明恢复进度与对外承诺的边界。", people:["王总 · 运营总监","小郑 · 客服专员","老周 · 研发负责人"], tone:"#9eabcc", art:"incident"},
  {code:"E", title:"入职第一周的需求对接", line1:"入职第一周的", line2:"需求对接", category:"职场新人", role:"入职第一周的新人", summary:"没有指挥权，也需要让第一份交付向前。", prompt:"在自身权限之内，你会怎样澄清需求、推动协作？", copy:"你需要在周五前交付渠道复盘报告，但需求口径仍不清楚，数据协作也遇到阻力。你需要在自身权限内澄清需求、推动协作，并向主管同步阻塞与支持需求。", people:["许主管 · 部门主管","大周 · 数据组资深成员","方姐 · 业务方对接人"], tone:"#a7bfae", art:"newcomer"},
] as const;
export type Scene = (typeof scenes)[number];
export const domains = [
  {name:"领导与决策",description:"在岗位权限内形成判断，确定下一步，并承担相应责任。",tone:"#ff9a80"},
  {name:"支持与合作",description:"理解相关方的处境与约束，通过支持和协作推进共同任务。",tone:"#ffc17b"},
  {name:"互动与呈现",description:"清楚表达信息与立场，回应不同角色的问题并争取理解。",tone:"#f2da70"},
  {name:"分析与解释",description:"核验信息，识别关键问题，解释判断依据及方案之间的取舍。",tone:"#83dfa6"},
  {name:"创造与概念化",description:"在当前限制下提出替代路径，并将想法转化为可讨论的方案。",tone:"#65e0d5"},
  {name:"组织与执行",description:"明确优先级、责任与时间安排，让任务在现实条件下持续推进。",tone:"#7bc5ff"},
  {name:"适应与应对",description:"面对条件变化、催促与挫折时，调整做法并持续回应任务。",tone:"#b2a1ff"},
  {name:"进取与绩效",description:"提出与职责相称的提升目标，权衡工作价值、投入与成本。",tone:"#ed9be7"},
] as const;
export const navigation = [{href:"/scenarios",label:"测评情境",chapter:"01"},{href:"/framework",label:"能力框架",chapter:"02"},{href:"/process",label:"评估流程",chapter:"03"},{href:"/about",label:"关于项目",chapter:"04"}] as const;
export const siteDescription="MAAT多智能体岗位胜任力情境测验：通过岗位情境、多角色互动与可追溯的行为证据，理解个体能力的不同侧面。";
