# 基于LLM Multi-Agent的职场情境能力评估系统研究报告

**心理测量学取向 · 项目复核版**

**报告日期：** 2026 年 4 月 30 日

**项目：** llm-multi-agent-workplace-assessment-system / MAAT

## 项目概述

本报告依据 llm-multi-agent-workplace-assessment-system 项目的当前代码、提示词、数据模型、前端页面和测试文件重新整理。系统中文定位为“基于LLM Multi-Agent的职场情境能力评估系统”，产品语境可称为 MAAT（Multi-Agent Assessment Toolkit）。从现有实现看，它更适合被界定为情境模拟反馈诊断工具：通过多角色压力情境收集受测者的自然语言作答，抽取可观察行为证据，再形成参考指数、观察区间、证据链和发展建议。

项目已具备完整的前后端链路。后端使用 Express、TypeScript、Prisma 和 SQLite，核心测评流程由 assessment.service 与 orchestrator.service 驱动；前端使用 React、TypeScript、Vite 和 Recharts，支持情境选择、SSE 流式对话、报告展示和管理后台。当前种子数据包含两个场景：一是“周三下午的会议室”，受测者在 120 分钟窗口内处理 VP 汇报前的设计稿缺口、协作资源和新人执行边界；二是“8号桌的客人”，受测者以餐厅值班经理身份处理重要客人宴请中的出品事故、员工纠错和后厨协同。

项目的核心技术特征是 Multi-Agent 分工。Director Agent 负责测评刺激控制和本轮维度证据抽取，Role Agent 包括 leader、coworker、client 三类结构角色，分别映射为不同场景下的陈总/苏姐/小秋或刘总/小林/江师傅；Group Discussion Agent 负责内部保护性校验；Judge Agent 负责最终观察报告。系统还保留 BehaviorDetector Agent 与 StageDirector Agent 作为职责拆分的清晰版本。Agent View 服务对不同 Agent 的输入进行隔离，Role Agent 看不到评分 rubric、完整 NPC memory 和 Judge-only 信息，Judge Agent 可以读取 rubric、行为证据、coverage_state 与完整对话，但不直接读取 NPC memory。这一设计为后续心理测量学验证提供了较好的工程基础。

## 一、研究目标、研究内容和拟解决的关键问题

本研究的总体目标，是建立一个面向职场压力情境的交互式行为观察系统。它以心理测量学中的构念定义、情境判断测验、评鉴中心、行为锚定评分和效度论证为基础，用 Multi-Agent 技术把测评刺激、角色追问、行为证据抽取、覆盖控制和最终报告分开处理。项目聚焦多轮追问中的真实表达：受测者需要说明判断、取舍、承诺边界和关系处理方式，系统再从原话中提取证据。这样的设计更接近真实组织情境中对管理潜力、压力表达、协作边界和问题处理质量的观察。

第一个研究目标是构建具有较高生态效度的职场情境模拟工具。传统 SJT 通常给出一段固定情境和若干选项，标准化程度较高，但对真实工作中的多方追问、信息不完整、压力升级和关系博弈呈现不足。现有项目采用 Multi-Agent 模拟多方利益相关者：在会议室场景中，陈总关注事实、假设、owner 和风险说明，苏姐关注资源负载与协作边界，小秋关注执行标准与反馈节奏；在餐厅场景中，刘总关注现场体面和可见处理，小林关注责任边界与后续标准，江师傅关注前厅后厨流程和专业边界。受测者的回答会影响下一轮追问对象和追问焦点，从而使测评过程带有交互式自适应特征。

第二个研究目标是形成可解释、可复核的能力观察报告。当前实现中，每个场景包含八个维度。会议室场景为信息辨别、交付切分、备选方案、承诺边界、向上对齐、横向协商、新人赋能、压力表达；餐厅场景为利害识别、现场止损、规则边界、承诺边界、面子修复、员工修复、后厨协同、系统改进。每个维度都有 rubric 定义和两个测评槽位，系统共为单个场景定义 16 个测评机会。报告不只展示参考指数，还展示覆盖状态、维度分析、用户原话证据、采样方差和发展建议。这种结果形式更符合效度论证中“结论必须能回到观察证据”的要求。

第三个研究目标是探索 Multi-Agent 在心理测量中的角色分离价值。传统评鉴中心常由评估师观察行为、记录证据、追问澄清并完成评分，多个任务集中在同一批人身上，评分者偏差和情境控制偏差难以完全分离。项目的 Agent 分工把这些任务拆开：Director 只控制刺激和覆盖机会，Role Agent 只制造角色压力，Group Discussion 只校验流程矛盾，Judge 只在结束后读取完整证据和 rubric。Agent View 隔离进一步降低评分答案泄露和刺激污染的风险。对心理测量学而言，这种架构能够把“刺激呈现质量”“证据覆盖质量”“评分稳定性”“报告解释质量”分别纳入质量控制。

研究内容包括五个层面。第一，基于工作情境分析定义测量构念，明确每个维度的行为锚点、低水平表现和高水平表现。第二，设计可触发行为证据的情境槽位，每个维度至少配置两个不同追问机会，避免某一维度始终没有被观察到。第三，建立多轮对话的过程模型，包括开场任务卡、用户作答、Director 选择追问、Role Agent 追问、Group Discussion 校验、Judge 汇总。第四，建立报告和后台管理系统，使研究者可以查看对话回放、群聊校验、黑板状态、coverage_state、采样统计和维度分布。第五，建立后续信效度验证方案，包括评分者一致性、维度区分效度、跨场景稳定性、证据充分性和预测效度。

拟解决的关键问题首先是标准化与生态效度之间的张力。真实职场能力往往在互动中显现，固定选择题很难观察到受测者如何在追问后修正表达、如何处理多个相关方、如何面对不确定性。项目通过统一场景事实、统一 rubric、统一 slot 定义和动态追问，把情境复杂性保留下来，同时用结构化覆盖规则维持测量条件的一致。

第二个关键问题是评分答案泄露。大模型场景测评很容易把评分标准、正确路径、参考答案混入角色 prompt，导致 Role Agent 以追问形式暗示受测者。项目通过 Agent View 隔离和 rubric.service 将 Judge-only 信息与 NPC/Director 输入分离，测试文件 agent-view.test.ts 已明确断言 NPC view 不含 assessment_goals、user_progress、latest_user_behavior、evaluation_notes、其他 NPC memory 和答案清单。这个问题对心理测量尤其重要，因为一旦刺激材料向受测者暗示高分路径，测量对象会从能力表现转向提示利用能力。

第三个关键问题是证据覆盖不足。若某些维度没有被触发，最终报告却给出维度分数，会削弱解释效度。slotTracker.service 为两个场景各定义 16 个槽位，coverage_state 会记录 unseen、probed、evidenced、insufficient 等状态。Director 根据 uncovered_slots 选择后续追问，结束条件要求达到最小轮次并满足至少 6 个维度已有证据。覆盖不足时，报告会降级为 provisional，提示仅作观察反馈。

第四个关键问题是 Judge Agent 的评分稳定性。大语言模型单次评分可能受到采样波动、输出风格和局部解释路径影响。当前实现采用 5 次 Judge 并行采样，对每个维度做修剪均值，去掉最高和最低后取中间三次均值，记录总分方差和维度方差。若总分方差超过阈值，报告被标记为 unratable 并提示人工复核。这个设计把信度从一个后台假设转为报告元数据，利于后续积累样本进行 ICC、G-theory 或 Many-Facet Rasch 分析。

第五个关键问题是测评结果的使用边界。当前前端已经把“总分”调整为“参考指数”，把报告定位为“情境行为观察”，并区分 confident、provisional、unratable、debug、scoring_failed 等状态。这样的口径有利于降低高利害误用风险：在尚未完成大样本验证前，系统更适合用于培训反馈、发展诊断、情境化面试辅助和研究试测，不宜直接用于招聘淘汰、晋升排序或高风险人事决策。

## 二、拟采用的方法手段与技术路线

本研究采用“构念定义—情境建模—证据槽位—Agent 刺激—行为证据—多次评分—报告解释”的技术路线。第一步是构念定义。研究团队需要从岗位任务、关键事件访谈和专家讨论中明确职场压力情境下要观察的能力维度。当前项目已经形成两套场景化八维度框架，并将这些维度写入 blackboard、rubric 和 slot 定义中。后续可进一步把维度描述改写为行为锚定等级，例如 0-5 表示缺少可观察证据或出现回避、甩锅、编造事实；6-10 表示有态度但依据和边界不足；11-15 表示能说明主要判断和下一步；16-20 表示判断清楚、边界明确、关系处理和风险兜底较完整。

第二步是情境建模。系统已使用 seed.ts 写入两个典型压力场景。会议室场景围绕 Q3 汇报前设计稿缺失，要求受测者在 120 分钟内处理事实确认、假设标注、协作资源、执行者边界和上级汇报结构。餐厅场景围绕重要客人宴请中第二道菜出品事故，要求受测者处理现场止损、面子修复、员工纠错、后厨协同和流程改进。每个场景都有公开任务卡、开场消息、角色 profile 和初始 blackboard。任务卡避免直接给出标准处理顺序，开场话术承担必要线索暴露，后续追问由 Multi-Agent 控制。

第三步是测评槽位设计。slotTracker.service 将每个场景拆为 16 个槽位，每个维度至少两个测评机会，并规定目标角色、追问意图和优先级。例如会议室场景中的“信息辨别”由陈总追问确认事实和假设，由小秋追问执行信息不足时的澄清；“横向协商”由苏姐暴露资源负载和交换条件；“新人赋能”由小秋暴露标准、反馈节奏和自主空间。餐厅场景中的“面子修复”由刘总暴露公开场合的体面损失，“后厨协同”由江师傅暴露前厅后厨流程问题，“员工修复”由小林暴露责任与纠错边界。槽位设计让能力观察有明确机会，也便于后续统计每个维度的暴露充分性。

第四步是 Agent View 隔离。agentView.service 根据 Agent 职责构造不同输入：NPC view 包含公开场景事实、本轮指令和自身 memory，不包含评分 rubrics、user_progress、latest_user_behavior、evaluation_notes 和其他角色完整 memory；Director view 包含公开场景事实、coverage_state、coverage_summary、uncovered_slots 和简化角色状态，用于选择下一轮刺激；Judge view 包含 rubric、coverage_state、evaluation_notes、user_progress 和完整对话，用于最终报告。这个隔离策略是整条技术路线的关键，因为它保证 Role Agent 主要承担刺激呈现任务，Judge Agent 主要承担评分解释任务，避免追问过程和评分过程互相污染。

第五步是单轮测评流水线。受测者提交回答后，assessment.service 保存用户消息并生成历史文本；responseQuality.service 先检查低信息回复和退出意图，连续三次低信息或明确退出会提前生成 unratable 报告；orchestrator.service 调用 Director Agent，Director 输出 detected_behavior、dimension_evidence、active_agent、current_focus、npc_instruction 和是否需要 group discussion。系统随后更新 coverage_state，优先采用 dimension_evidence，旧的 detected_behavior 作为兼容兜底。若触发内部校验，Group Discussion Agent 会检查角色焦点不匹配、覆盖不足、边界泄露、重复追问和过早结束等问题。之后 Role Agent 以 SSE 流式输出回复，前端 ChatPage 实时显示内容。

第六步是结束与评分。系统只有在满足最小轮次、Director 认为可结束且 coverage_state 完成时才正常收束；达到最大轮次时也会进入 Judge。Judge Agent 读取完整对话、Judge view 和 group summary，进行 5 次并行评分。judge.agent.ts 对每个维度使用 trimmed mean 聚合，去掉最高和最低分后取中间三次平均，保证维度分数比单次评分更稳定。随后系统校验 total_score 与维度和的一致性、分数范围和雷达图数据。总分方差达到阈值时报告标记为 unratable，mock 模式报告标记为 debug，覆盖不足报告标记为 provisional。

第七步是前端呈现与管理后台。前端通过 ScenarioPage 收集昵称和场景选择，通过 ChatPage 呈现多轮对话、倒计时、SSE 流式响应和重试机制，通过 ReportPage 展示参考指数、观察区间、采样一致性、覆盖状态、维度条形图、雷达图、关键证据和发展建议。管理后台包含 DashboardPage、ScenariosPage、PromptsPage、SessionsPage 与 SessionDetailPage，支持场景编辑、prompt 编辑、会话列表、对话回放、群聊记录和黑板状态查看。对研究而言，后台是质量审查和标注复核入口。

第八步是心理测量学验证。短期应开展专家内容效度审查，邀请工业与组织心理学、管理心理学或人力资源测评专家判断每个维度、槽位和报告证据是否覆盖目标构念。中期应收集样本数据，计算 Judge 5 次采样的 ICC、总分和维度方差、维度间相关、coverage 完成率、低信息收束率和人工复核率。长期应加入外部效标，例如结构化面试评分、主管绩效评分、培训前后变化或传统 SJT 分数，检验效标关联效度与增量效度。若样本量达到 200 份以上，可进行验证性因子分析或广义性理论分析，区分人、场景、维度、Agent 刺激、Judge 采样带来的变异来源。

第九步是质量控制与版本治理。项目已经有 vitest 覆盖 agent view、slot tracker、response quality、judge aggregation 和场景设计等关键逻辑。后续建议把每次 prompt 修改、rubric 修改和场景修改记录为版本号，并在报告中保存 prompt 版本、场景版本和模型版本。这样做能够支持测评版本等值和历史结果解释。对于需要正式研究的数据集，应保存用户原话、Agent 回复、coverage_state、Judge 采样结果、人工复核标签和最终报告，同时进行脱敏处理，避免把原始职场敏感信息直接用于模型调试。

第十步是部署与运行。项目当前支持本地 SQLite 和 mock LLM 模式，适合开发、演示和小规模试测；接入 DeepSeek API 后可进行真实模型运行。正式研究环境建议将 SQLite 升级为 PostgreSQL，增加审计日志、数据脱敏、管理员权限分级和备份策略。前端继续使用 SSE 保持对话感知速度，后端保留 streaming 和非 streaming 两套链路，便于在网络不稳定时降级。

## 三、预期结果与成果提供形式

预期结果首先是一套可运行的情境模拟测评系统。受测者可以在浏览器中选择场景、输入昵称、进入多轮对话，并在结束后获得一份以行为证据为中心的观察报告。报告包含参考指数、观察区间、冲突风格、维度分布、采样方差、覆盖状态、优势、发展关注点、改进建议、关键原话证据和最终发展建议。管理者或研究者可以在后台查看会话、场景、提示词、对话回放、群聊校验和黑板状态。

第二类结果是心理测量学研究材料。系统会在每次测评中保存完整对话、用户原话、Agent 回复、coverage_state、Judge 采样分数、维度方差、报告状态和人工复核标记。这些数据可以用于后续建立测评常模、修订评分锚点、分析维度区分效度、考察跨场景稳定性，并评估 Multi-Agent 刺激控制对证据覆盖的贡献。对于当前阶段，建议把所有分数称为参考指数，避免被理解为已经完成常模化和高利害验证的正式能力分。

第三类结果是评估报告模板和解释规范。报告应持续保持“用户原话—行为证据—维度解释—发展建议”的顺序。高分维度应说明哪些回答支撑了判断，低分维度应说明本次没有观察到什么证据，覆盖不足维度应明确提示“本次情境证据不足”。这类模板既能服务受测者反馈，也能服务评估研究中的可追溯性审查。

第四类结果是可复用的技术组件。包括 Agent View 隔离模块、slot coverage tracker、低信息回复门槛、Judge 5 次采样与修剪均值聚合、报告状态降级机制、SSE 流式聊天组件和后台复核界面。这些组件可以迁移到其他测评场景，例如校园领导力、客户服务、临床沟通训练、管理者冲突处理训练等。迁移时需要重新定义构念、场景、slot 和 rubric。

第五类结果是研究结论。预期在小样本试测后，系统可以证明 Multi-Agent 能够提高行为证据覆盖率，尤其是让不同角色暴露不同维度的能力机会。Judge 5 次采样预计可降低单次模型评分波动；coverage 降级和 variance 降级会提升报告可信边界。正式结论需要在样本数据支持下形成，例如：完成率、平均轮次、覆盖维度数、采样方差分布、人工复核比例、维度相关矩阵、专家评分一致性和与外部效标的相关。

成果提供形式建议包括：一套可部署的 Web 系统；一份研究版测评手册，说明构念定义、场景说明、评分锚点、报告解释口径和使用边界；一份管理员操作手册，说明如何编辑场景、prompt、查看会话和导出数据；一套匿名化样本数据表，包含会话层、轮次层、slot 层和报告层数据；一份信效度初步分析报告；若进入正式研究阶段，还应形成伦理与数据保护说明、受测者知情同意模板和人工复核流程。

## 四、特色与创新之处

本项目的第一项特色是将 Multi-Agent 作为心理测量流程的一部分，而非只作为对话包装。Role Agent 负责制造不同利益相关方的压力，Director Agent 控制测评槽位覆盖，Group Discussion Agent 做保护性校验，Judge Agent 负责最终证据整合。不同 Agent 的输入被主动隔离，减少刺激泄露和评分污染。这样的设计能把评鉴中心中的角色扮演、观察记录、评分汇总和质量审核转换成可记录、可审计、可迭代的工程流程。

第二项特色是用 slot coverage 管理能力证据。很多情境测评容易出现“聊了很多，但某些维度没有被观察到”的问题。项目把每个场景拆成 16 个槽位，每个槽位有维度、目标角色、追问意图和优先级。Director 根据 uncovered_slots 选择下一轮刺激，结束条件也依赖覆盖状态。这使测评过程具有类似蓝图控制的结构，能够在动态对话中维持测量计划。

第三项特色是把评分稳定性做成可见元数据。Judge Agent 的 5 次采样、维度修剪均值、总分方差和维度方差，让报告不只给一个参考指数，还能说明这个指数的稳定程度。高方差时系统主动降级，不把不稳定输出包装成确定结论。对心理测量应用来说，这比单次大模型评分更谨慎，也更接近多评分者评鉴中心的质量控制思想。

第四项特色是报告可追溯。系统要求 Judge 引用用户原话，前端展示关键证据，后台保留对话回放和黑板状态。研究者可以追问每个维度的判断依据，受测者也能看到哪些表达被系统识别为证据。这种证据链有助于减少黑箱感，为内容效度审查、评分争议处理和后续模型校准提供基础。

第五项特色是自适应情境判断测验的雏形。传统 SJT 常以固定题本呈现，项目则根据用户回答、覆盖状态和角色轮换动态生成下一轮追问。它保留统一场景事实和统一 rubric，同时允许追问路径因用户表现而变化。这个方向可以被视为从“题目自适应”扩展到“交互刺激自适应”，适合观察压力表达、协作边界、风险沟通和现场判断等过程性能力。

第六项特色是开发和研究闭环较完整。项目已包含可运行前端、后端、管理后台、prompt 编辑、场景编辑、会话回放和多项测试。后续研究人员不需要从零搭建实验平台，可以直接围绕样本采集、专家标注、评分对照和信效度分析开展工作。工程可用性降低了心理测量工具从概念到试测之间的落地成本。

## 五、成本预算

成本预算按“当前本地试测版”“小规模研究版”“正式试点版”三个层级估算。以下金额为规划口径，实际支出需根据云服务、模型 API、研究人员劳务和样本招募渠道调整。当前项目已经完成主要工程雏形，因此预算重点放在后续心理测量学验证、数据治理和产品化加固。

第一类是工程开发与维护成本。若继续由 1 名全栈工程师和 1 名心理测量研究者协作推进，建议预留 6 至 8 周。工程部分包括 PostgreSQL 迁移、导出功能、权限分级、报告模板固化、异常状态完善、前端可访问性提升、日志与监控、数据脱敏和部署脚本，按每人日 1200 至 1800 元估算，约 4.8 万至 8.6 万元。心理测量部分包括构念访谈、维度锚点修订、专家评审、评分手册、人工复核规范和研究方案撰写，按每人日 1500 至 2500 元估算，约 3 万至 6 万元。

第二类是模型调用与运行成本。单次完整测评通常包含多轮 Director 调用、多轮 Role Agent 调用、可能的 Group Discussion 调用和结束时 5 次 Judge 调用。费用取决于模型单价、上下文长度、轮次数和是否开启强模型思考。建议以三档估算：开发调试每人次 0 至 1 元，可使用 mock 或少量真实调用；小规模研究每人次 1 至 5 元，保留 5 次 Judge 采样；正式试点每人次 3 至 10 元，增加日志、重试、人工复核和数据存储成本。若首轮招募 300 人完成两种场景，模型预算建议预留 3000 至 6000 元，覆盖失败重测和 prompt 调试。

第三类是服务器与数据管理成本。本地开发可使用 SQLite，无额外数据库费用。研究版建议使用 2 核 4G 或 4 核 8G 云服务器、PostgreSQL、对象存储和备份策略。按一年期估算，服务器和数据库预算可设为 3000 至 12000 元，具体取决于是否使用托管数据库、是否需要公网访问、是否配置 HTTPS、日志保留周期和备份频率。若涉及机构内部数据，建议额外预留安全审查、访问控制和数据脱敏成本 5000 至 15000 元。

第四类是心理测量验证成本。内容效度阶段建议邀请 3 至 5 名专家审查构念、slot、prompt 和报告样例，每名专家 1000 至 3000 元，合计约 3000 至 15000 元。评分者一致性阶段建议抽取 50 至 80 份会话，由 2 至 3 名人工评分者按评分手册独立评分；若每份人工评分 50 至 100 元，预算约 5000 至 24000 元。效标关联阶段需要收集外部绩效、结构化面试或传统测评数据，若涉及样本激励，按每人 30 至 80 元、300 至 500 人估算，约 9000 至 40000 元。数据分析与报告撰写建议预留 1.5 万至 4 万元。

第五类是样本招募与伦理合规成本。若用于学生或求职训练，可以通过课程、社群或内部试测降低招募费用；若要求样本覆盖不同工作年限、岗位和行业，需要付费招募。建议首轮以 100 人探索性试测为起点，预算 5000 至 10000 元；第二轮以 300 至 500 人进行信效度分析，预算 2 万至 6 万元。若报告计划用于论文、竞赛或机构内部评估，应准备知情同意、数据使用说明、退出机制和人工复核申诉流程。

综合来看，若目标是形成可展示、可试测、可提交研究报告的版本，建议预算为 8 万至 15 万元；若目标是完成 300 人以上样本的初步信效度验证，并形成较完整的研究成果，建议预算为 18 万至 35 万元；若进入商业化或高利害使用前验证，预算应提高到 50 万元以上，重点投入多场景开发、人工评分基准、跨群体公平性检验、数据安全和长期监控。当前项目已完成较多基础工程，后续资金最应优先投向心理测量学验证和数据质量，而非单纯增加页面功能。

## 参考文献

AERA, APA, & NCME. (2014). Standards for Educational and Psychological Testing. Washington, DC: American Educational Research Association.

Arthur, W., Day, E. A., McNelly, T. L., & Edens, P. S. (2003). A meta-analysis of the criterion-related validity of assessment center dimensions. Personnel Psychology, 56(1), 125-154.

Brennan, R. L. (2001). Generalizability Theory. New York: Springer.

Cronbach, L. J., Gleser, G. C., Nanda, H., & Rajaratnam, N. (1972). The Dependability of Behavioral Measurements: Theory of Generalizability for Scores and Profiles. New York: Wiley.

Cronbach, L. J., & Meehl, P. E. (1955). Construct validity in psychological tests. Psychological Bulletin, 52(4), 281-302.

Embretson, S. E., & Reise, S. P. (2000). Item Response Theory for Psychologists. Mahwah, NJ: Lawrence Erlbaum Associates.

Gwet, K. L. (2014). Handbook of Inter-Rater Reliability (4th ed.). Gaithersburg, MD: Advanced Analytics.

Kane, M. T. (2013). Validating the interpretations and uses of test scores. Journal of Educational Measurement, 50(1), 1-73.

Landy, F. J., & Farr, J. L. (1980). Performance rating. Psychological Bulletin, 87(1), 72-107.

Lievens, F., & Motowidlo, S. J. (2016). Situational judgment tests: From measures of situational judgment to measures of general domain knowledge. Industrial and Organizational Psychology, 9(1), 3-22.

Linacre, J. M. (1989). Many-Facet Rasch Measurement. Chicago: MESA Press.

McClelland, D. C. (1973). Testing for competence rather than for intelligence. American Psychologist, 28(1), 1-14.

Messick, S. (1995). Validity of psychological assessment: Validation of inferences from persons' responses and performances as scientific inquiry into score meaning. American Psychologist, 50(9), 741-749.

Mislevy, R. J., Steinberg, L. S., & Almond, R. G. (2003). On the structure of educational assessments. Measurement: Interdisciplinary Research and Perspectives, 1(1), 3-62.

Society for Industrial and Organizational Psychology. (2018). Principles for the Validation and Use of Personnel Selection Procedures (5th ed.). Bowling Green, OH: SIOP.

Thornton, G. C., & Rupp, D. E. (2006). Assessment Centers in Human Resource Management: Strategies for Prediction, Diagnosis, and Development. Mahwah, NJ: Lawrence Erlbaum Associates.
