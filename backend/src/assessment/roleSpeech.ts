/** Speech composition only: fact IDs, release rounds, questions and scoring rules stay unchanged. */
const spokenFacts: Record<string, string> = {
  "陈总对方案依据仍有疑问，需要你回应具体风险；没有批准改变汇报范围。": "我对方案依据仍有疑问，需要你回应具体风险；我还没有批准改变汇报范围。",
  "苏姐本组已排满，跨组支持需要协商确认。": "我这组已经排满，跨组支持需要和我协商确认。",
  "小秋尚未核实部分素材，需要可理解的标准和求助条件；工具只支持现有素材整理。": "我还没有核实部分素材，需要你说明我能理解的标准和求助条件；我使用的工具只支持现有素材整理。",
  "苏姐原定的设计支持今天无法提供。": "我原定提供的设计支持今天无法提供。",
  "小秋补充：目前工具只能复用已有素材，不能制作新的专业设计成品。": "我补充一下：目前工具只能复用已有素材，不能制作新的专业设计成品。",
  "刘总说明：用餐最多再等30分钟，仍对现场影响和处理安排有疑问。": "我用餐最多再等30分钟，仍对现场影响和处理安排有疑问。",
  "小林只掌握本人操作；其他环节仍需相关人员核对。": "我只掌握自己的操作；其他环节仍需相关人员核对。",
  "江师傅只能使用当前当班人员，不能额外加人；出品复核不可省略。": "我只能使用当前当班人员，不能额外加人；出品复核不可省略。",
  "江师傅确认后厨临时增加10分钟等待，替换出品现在预计25分钟。": "我确认后厨临时增加10分钟等待，替换出品现在预计25分钟。",
  "江师傅补充：现有人员不增加，出品检查须在现有交接流程中完成。": "我补充一下：现有人员不增加，出品检查须在现有交接流程中完成。",
  "王总需在尽快保全交易与控制安全风险之间取舍，尚未批准限流或赔付；持续追问恢复时点。": "我需要在尽快保全交易与控制安全风险之间取舍，还没有批准限流或赔付；我仍需要你回应恢复时点的问题。",
  "小郑正承受用户催促，需已确认事实和可持续的更新口径。": "我正在承受用户催促，需要已确认的事实和可持续的更新口径。",
  "老周只能说明已确认的研发条件，不能保证原因、恢复时点或成功概率。": "我只能说明已确认的研发条件，不能保证原因、恢复时点或成功概率。",
  "老周确认甲路径的回退包当前尚未验证，发布前提不成立，暂不可用。": "我确认甲路径的回退包当前尚未验证，发布前提不成立，暂不可用。",
  "老周补充：客服不能直接读取研发排查内部数据，信息交接仍须通过授权接口或已确认摘要。": "我补充一下：客服不能直接读取研发排查内部数据，信息交接仍须通过授权接口或已确认摘要。",
  "许主管关注周五可交付的基本报告与优先级，未授权新人给资深同事分工；对进度仍有疑问。": "我关注周五可交付的基本报告与优先级，还没有授权你给资深同事分工；我对进度仍有疑问。",
  "大周提供现有渠道汇总数据，业务临时口径未必与原数据完全一致，需要说明来源和冲突。": "我提供现有渠道汇总数据，业务临时口径未必与原数据完全一致，需要说明来源和冲突。",
  "方姐确认报告用于下周投入讨论，需区分渠道、转化和投入，并标注口径；新口径需要核实数据适用性。": "我确认报告用于下周投入讨论，需要区分渠道、转化和投入，并标注口径；新口径需要核实数据适用性。",
  "方姐新增要求：在原渠道汇总中增加新老用户的拆分比较；现有数据是否支持尚待确认。周五17:00截止未变。": "我新增一个要求：在原渠道汇总中增加新老用户的拆分比较；现有数据是否支持尚待确认。周五17:00截止未变。",
  "大周补充：新口径不能直接套用原渠道汇总，需先核对数据来源与可用字段。": "我补充一下：新口径不能直接套用原渠道汇总，需先核对数据来源与可用字段。"
};

export function ownVoice(text: string, name: string): string {
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Only a sentence's speaker subject/label is changed; other people's identities remain intact.
  return text.replace(new RegExp(`(^|[\\n。！？；])\\s*${escaped}(?:[：:]\\s*)?`, "g"), "$1我");
}

export function spokenFact(text: string, name: string, publicFact = false): string {
  // Match complete original text and its actual speaker, never assume custom facts share built-in IDs.
  if (!publicFact && text.startsWith(name) && spokenFacts[text]) return spokenFacts[text];
  if (!publicFact && text.startsWith(name)) return ownVoice(text, name);
  const content = publicFact ? text.replaceAll("本人", "你") : text;
  return `我先说明一下：${content}`;
}

export function composeRoleSpeech(facts: string[], questions: string[], draft = ""): string {
  const speech = draft.trim();
  // A model may integrate the required first-person statements itself; do not append them twice.
  return [...facts.filter(f => !speech.includes(f)), speech, ...questions.filter(q => !speech.includes(q))]
    .filter(Boolean).filter((line, index, lines) => lines.indexOf(line) === index).join("\n") || "请继续说明你当前的判断和下一步。";
}
