# 基于LLM Multi-Agent的职场情境能力评估系统

# ——项目研究报告——

**基于LLM Multi-Agent的职场情境能力评估系统 (MAAT)**  
**Multi-Agent Assessment Technology**

---

**编制日期：2026年5月1日**  
**版本：0.1.0**

---

# 一、研究目标、研究内容和拟解决的关键问题

## 1.1 问题提出

职场管理能力的评估长期面临一个方法论困境。自陈量表（如人格测验）实施成本低，但社会称许性偏差（social desirability bias）难以消除——被试倾向于选择"看起来更好"而非"更符合自身实际"的选项（Paulhus, 1984; Zerbe & Paulhus, 1987），这直接威胁了测量的构念效度。情境判断测验（Situational Judgment Test, SJT）在预测效度和增量效度上表现优于自陈量表——McDaniel et al.（2001）的元分析（102项效度研究，N=10,640）报告SJT的预测效度校正值为0.34，且对认知能力测验具有显著增量效度——但传统SJT采用纸笔或视频呈现的静态情境，缺乏人际互动性和动态追问能力，在测量复杂管理行为时存在生态效度不足的问题（Weekley & Ployhart, 2006; Lievens et al., 2008）。结构化面试通过行为事件访谈（BEI）部分弥补了这一缺陷，但其评分信度高度依赖面试官的培训质量：Conway et al.（1995）的元分析报告结构化面试的评分者信度均值仅为0.69，而Pulakos et al.（1996）进一步发现该数值对面试官培训时长和标准化程度高度敏感。评价中心（Assessment Center, AC）在预测效度上表现最优——Arthur et al.（2003）对34项研究的元分析显示AC维度评分的效度系数为0.36，Gaugler et al.（1987）的早期元分析（50项研究，N=14,909）报告为0.37——但AC的运营成本极高。Lievens & Sackett（2017）的系统综述指出，单一被试的AC费用可达2,000-4,000美元，且评分者培训和质量监控的持续投入构成了主要的边际成本。Thornton & Rupp（2006）进一步指出AC效度的核心瓶颈不是练习设计而是评分过程——评分者对维度概念的模糊理解和维度间的高相关是信度损耗的主要来源。

上述困境可以概括为一个三角权衡：**信度-效度-成本的"不可能三角"**。自陈量表低成本但低效度（尤其在动机扭曲的选拔情境中）；评价中心高效度但高成本；结构化面试居中但信度不稳定。

本研究的核心假设是：由大语言模型驱动的Multi-Agent情境模拟系统有可能以接近自陈量表的成本实现接近评价中心的评估效度。支撑这一假设的逻辑链是：（1）LLM驱动的NPC角色能够模拟评价中心中的"角色扮演者"（role player），生成生态效度较高的压力情境追问；（2）独立的Judge Agent能够在完整对话历史的基础上进行行为证据编码和维度评分，模拟评价中心中"多评估者讨论整合"（consensus discussion）的信息综合功能；（3）程序化的多重采样和统计门控能够部分替代人类评分者的信度保障机制。

上述假设的分量需要审慎评估。LLM生成的追问在多大程度上具有与训练有素的AC角色扮演者相当的情境真实性和行为引出效力？LLM评分在多大程度上能避免AC评分中已知的维度间高相关（dimension intercorrelation）和练习效应（exercise effect）等测量学问题（Sackett & Dreher, 1982; Lance et al., 2000, 2004）？LLM的文化偏见、语言风格偏好等因素会在多大程度上引入构念无关方差（construct-irrelevant variance; Messick, 1989）？Zheng et al.（2024）对LLM-as-judge的系统评估显示，即使最先进的LLM在评分任务中仍表现出位置偏差（position bias）和冗长偏好（verbosity bias）——这些问题在评估管理能力时的具体表现尚不明确。这些问题构成了本研究的方法论边界。

## 1.2 研究目标

**总目标：构建并初步验证一套基于LLM Multi-Agent的职场情境管理能力评估系统的心理测量学可行性，重点考察其信度保障机制和效度证据基础。**

具体目标分四个层面：

**目标一：构念操作化——建立ECD框架下的能力维度和证据模型。**以证据中心设计（Evidence-Centered Design, ECD; Mislevy et al., 2003）为方法论框架，将管理者在高压职场情境中的能力表现操作化为可观察、可编码的行为证据体系。具体包括：（a）定义8个能力维度的操作化定义和评分量规（rubric）；（b）为每个维度设计2个具体观察槽位（observation slot），明确其探针意图、目标追问对象和证据质量标准；（c）构建每个槽位从"未见"（unseen）到"探测"（probed）到"证据化"（evidenced）的状态转移逻辑。这一目标的测量学意义在于为后续的信度和效度验证提供清晰的构念-指标映射（construct-indicator mapping）。

**目标二：信度设计——建立多重采样与统计门控的评分信度保障机制。**LLM输出的随机性是评分信度的首要威胁——同一段对话交由同一模型连续评分两次，可能得出不同结果。本研究借鉴概化理论（Generalizability Theory; Brennan, 2001）中通过增加评分面（rater facet）采样次数来提高信度系数期望值的逻辑，设计Judge Agent的5次独立并行采样方案，以修剪均值（trimmed mean）为聚合统计量，以总分方差为信度指标，以预设阈值（80分）为自动化可靠性门控。同时建立数学一致性校准（total_score与维度分之和的恒等检验），消除LLM输出中的算术错误对信度的影响。这一目标的测量学意义在于：将信度从"事后报告的系数"转化为"评分过程中实时计算并影响输出形式的控制机制"。

**目标三：效度论证——构建多层效度证据框架。**依据Messick（1989）的统一效度理论（unified validity framework）和AERA/APA/NCME（2014）《教育与心理测试标准》，本研究计划从以下维度建立效度证据链：

（a）**内容效度（content validity）**：验证8维度和16观察槽位对职场管理情境中关键行为域的覆盖程度。通过比对现有评价中心维度分类体系（如Thornton & Rupp, 2006的8维度分类；Bartram, 2005的"Great Eight"胜任力框架），论证维度选择的领域代表性。

（b）**实质效度（substantive validity）**：验证Slot Tracker中从行为文本到证据编码的推理过程是否可靠——即Director Agent的行为检测和Judge Agent的证据判定在多大程度上与人类专家的编码一致。Messick（1989）将实质效度定义为"被试在测评中的认知过程和回答行为与理论预期的匹配程度"，在本系统中这一概念扩展为"LLM评分过程与人类专家推理过程的一致性"。拟采用专家评审的共识编码（consensus coding）与Agent编码进行一致性比较，计算Cohen's κ系数（Cohen, 1960）：

$$\kappa = \frac{p_o - p_e}{1 - p_e}$$

其中 p_o 为观察一致率，p_e 为期望一致率。

（c）**结构效度（structural validity）**：验证8维度之间的内部结构是否符合理论预期。具体包括：计算维度间的Pearson相关系数矩阵，检验是否呈现AC研究中经典的"维度间高相关"模式（Lance et al., 2004）；通过主成分分析或验证性因子分析检验是否存在更高阶的能力因子（如"任务导向"vs"人际导向"的二维结构）。

（d）**概化效度（generalizability validity）**：验证评分在不同会话、不同Judge调用之间的稳定程度。使用G-theory的G-study设计，将评分方差分解为被试主效应、维度主效应、被试×维度交互效应和残差：

$$\sigma^2(X_{pd}) = \sigma^2_p + \sigma^2_d + \sigma^2_{pd,e}$$

其中 p 表示被试，d 表示维度。通过D-study预测不同采样次数下的期望信度系数：

$$E\rho^2 = \frac{\sigma^2_p}{\sigma^2_p + \frac{\sigma^2_{pd,e}}{n_d}}$$

（e）**后果效度（consequential validity）**：评估使用本系统输出"观察反馈"而非"确定性分数"的设计决策对用户（被试和管理者）的认知和行为影响。特别是：报告中的置信度标签（"仅观察反馈"、"观察性反馈"、"本次观察结果"）是否被用户正确理解？"建议人工复核"的标注是否被实际采纳？

**目标四：系统实现——构建可运行的评估原型，积累实证数据。**完成前端交互界面和后端Multi-Agent编排引擎的开发与集成，建立本地可运行的原型系统。在mock模式和真实LLM模式下分别运行测试会话，为上述信度效度分析提供数据基础。

## 1.3 研究内容

**（1）情境设计：两个高压职场场景的构建与验证。**

场景A"周三下午的会议室"：被试扮演项目负责人，核心约束是"下午4点VP向CEO汇报Q3方案，三页关键设计稿缺失，120分钟处理窗口"。能力维度覆盖信息辨别、交付切分、备选方案、承诺边界、向上对齐、横向协商、新人赋能、压力表达。3个NPC角色分别对应VP（上级压力源）、隔壁组Leader（同级协作压力源）、团队应届生（下级执行压力源）。

场景B"8号桌的客人"：被试扮演餐厅值班经理，核心约束是"VIP客人宴请出现出品事故，需同时处理现场影响、员工纠错和后厨协同"。能力维度覆盖利害识别、现场止损、规则边界、承诺边界、面子修复、员工修复、后厨协同、系统改进。

场景设计的效度考量：（a）两个场景分别覆盖"项目推进"和"危机处理"两类典型管理情境，增强领域代表性；（b）每个场景内含三类关系压力源（向上/同级/向下），确保角色互动的多样性；（c）公开信息（已知事实、时间线、角色关系）和隐藏信息（评分维度、参考答案、失格风险清单）的结构化分离是实现后续Prompt信息隔离的数据基础。

**（2）观察槽位系统（Slot Tracker）：ECD证据模型的工程实现。**

每个场景定义16个观察槽位（8维度×2槽位）。每个槽位包含五个属性：目标维度、目标NPC（由谁追问最能暴露该维度行为）、探针意图（追问设计意图的文本描述）、优先级（1-5）、当前证据质量。证据质量分三级：none（未见证据）、partial（弱证据，来自传统行为检测标记的维度推断）、clear（强证据，来自Director Agent直接输出的dimension_evidence字段）。

槽位状态转移：unseen → probed（被Director选定为追问目标后）→ evidenced（出现partial或clear证据后）。当至少6个维度获得partial以上证据时，系统判定覆盖完整。阈值6的选择逻辑是：两个场景各8个维度，允许至多2个维度无证据——在实际对话中，某些维度（如"新人赋能"）可能因情境自然流向未能被充分探测，要求8个全维度覆盖会导致对话过度延长而增加用户负担。

**（3）Multi-Agent角色系统：角色定义与信息隔离设计。**

7个Agent角色的功能定位：

| Agent | 功能 | 输入信息层级 | 调用时机 |
|-------|------|------------|---------|
| Director | 行为检测+追问调度 | 公开事实+覆盖状态+NPC状态摘要+对话历史 | 每轮 |
| Leader (NPC) | 扮演上级角色追问 | 公开事实+自身NPC记忆+追问指令 | 每轮 |
| Coworker (NPC) | 扮演同级角色追问 | 公开事实+自身NPC记忆+追问指令 | 每轮 |
| Client (NPC) | 扮演下级角色追问 | 公开事实+自身NPC记忆+追问指令 | 每轮 |
| Group Discussion | 多视角交叉校验 | 公开事实+NPC状态+Director提案 | 条件触发 |
| Judge | 证据综合+维度评分 | 完整信息（含量规） | 对话结束后 |
| Response Quality Gate | 作答质量检测 | 近期用户消息 | 每轮（规则匹配，非LLM） |

信息隔离的效度意义：追问NPC不接触评分标准的设计直接针对构念效度中的一个经典威胁——"教考不分"（teaching to the test）。如果追问者知晓评分维度，追问方向将不自觉地偏向维度覆盖而非情境真实推进，这会引入系统的构念无关方差（construct-irrelevant variance），降低评估的生态效度。隔离不是在prompt中做文本提醒，而是在agentView.service.ts的数据构建层进行字段级过滤——NPC Agent接收的数据结构中不包含评分量规、参考答案和用户行为标注字段。

**（4）Judge Agent多重采样评分：从G-theory到工程实践。**

对话结束后，Judge Agent被并行调用5次（temperature=0.1, jsonMode=true, maxTokens=8,000）。每次输入包含：场景事实（含未知项）、评分量规（维度定义+失格风险清单）、用户进度标注、行为证据汇总、完整对话历史、群聊讨论摘要。

设第 i 次调用的维度 d 得分为 x_i^d（i=1,...,5），聚合步骤如下：

**步骤一：维度层面修剪均值**

$$\bar{x}_{trim}^d = \frac{1}{3}\sum_{j=2}^{4} x_{(j)}^d$$

其中 x_{(j)}^d 为升序排列后的第 j 个值。修剪均值相较算术均值的优势在于对异常值不敏感——当某次采样因LLM输出异常（如误读了对话中的某个细节）给出极端分数时，该采样在排序后会被排除在均值计算之外。

**步骤二：计算采样一致性指标**

维度方差：

$$\sigma^2_d = \frac{1}{5}\sum_{i=1}^{5}(x_i^d - \bar{x}^d)^2$$

总分方差（即信度门控的依据）：

$$\sigma^2_{total} = \frac{1}{5}\sum_{i=1}^{5}(T_i - \bar{T})^2, \quad T_i = \sum_{d \in D} x_i^d$$

方差阈值80的选择依据：当 σ²_total ≥ 80 时，总分标准差约为9分，对应于总分范围（160分）的5.6%。此时5次采样间的总分全距约为18分。考虑到相邻等级间的阈值差约为16分（卓越≥140，优秀≥120，良好≥96，合格≥72），18分的采样波动意味着等级判定存在跨级风险。因此，σ²_total ≥ 80 时系统拒绝输出正式分数，转而采用"仅观察反馈"模式。

**步骤三：锚定报告选择**

在5份报告中，选择维度向量最接近修剪均值向量的报告作为内容锚定报告。距离度量使用欧氏距离：

$$d(\mathbf{x}_i, \bar{\mathbf{x}}) = \sqrt{\sum_{d \in D}(x_i^d - \bar{x}_{trim}^d)^2}$$

锚定报告的维度分析文本、冲突风格、证据引用等内容被保留，但其分数被替换为修剪均值，并据此重新计算总分和等级。

**步骤四：数学一致性校准。**LLM偶尔会在总分和维度之和之间出现算术不一致（例如各维度分数之和为98但total_score字段输出105）。系统自动比较两者，若存在差异则以维度分之和覆盖总分。这不是测量学步骤而是数据完整性检查。

**步骤五：报告状态判定**

$$\text{report\_status} = \begin{cases} \text{unratable} & \text{if } \sigma^2_{total} \geq 80 \\ \text{confident} & \text{if } \sigma^2_{total} < 80 \land Coverage = \text{complete} \\ \text{provisional} & \text{if } \sigma^2_{total} < 80 \land Coverage = \text{incomplete} \\ \text{debug} & \text{if } USE\_MOCK\_LLM = true \end{cases}$$

**（5）响应质量门控：基于规则的无效作答检测。**

在Director调用之前，系统先对用户最新回复进行规则匹配的质量检测。检测逻辑分两路：

**低信息检测**：将用户回复与预定义的短语列表进行匹配（包括"不知道"、"不清楚"、"不会"、"没想好"、"随便"、"都行"、"继续"、"跳过"等），同时检测纯数字/标点回复和过短回复（≤2字符）。从最新回复向前追踪，统计连续低信息回复次数。

**退出意图检测**：匹配"退出"、"结束"、"不测了"、"停止"等退出关键词。

终止判定：

$$Terminate = (consecutive\_low\_info \geq 3) \lor explicit\_withdrawal$$

触发终止时，系统不调用Director或Judge，直接生成unratable报告。报告内容包含：终止原因说明、低信息回复内容列表（作为证据）、不输出任何维度分数。

这一机制的测量学意义在于：它防止了"在无效作答基础上强行产出评分"的伪测评问题。从效度角度看，无效作答本质上是构念无关行为——被试在此状态下没有展示任何管理能力——如果系统仍给出分数，该分数反映的是系统的评分算法特征而非被试的能力水平，构成对效度的严重威胁（Messick, 1989）。在方法论上，本系统的Response Quality Gate借鉴了问卷调查中"不充分努力应答"（Insufficient Effort Responding, IER）的检测逻辑。Meade & Craig（2012）系统综述了11种IER检测方法的效度，其中"响应一致性"（response coherence）方法和"异常响应模式"（anomalous response pattern）方法对本系统的低信息回复检测具有方法参考价值——区别在于，本系统检测的是对话回复中的低信息而非问卷选项中的低努力，且触发条件从"事后筛除"转变为"过程中终止并降级报告"。

**（6）前端交互与后端服务实现。**

前端：React 19 + TypeScript + Vite 6，共10个路由页面。对话页实现SSE流式渲染（逐token实时显示NPC回复）、240秒计时器、乐观更新和错误重试。报告页展示8维雷达图、条形图、置信度标签、证据卡片等可视化内容。管理后台5页面提供场景编辑、提示词版本管理和会话审查。

后端：Express + Prisma + SQLite。Agent提示词独立存储为.prompt.txt文件，支持管理后台在线编辑和版本管理。LLM调用通过统一服务层，支持mock模式（零成本演示）。

## 1.4 拟解决的关键问题

**（1）追问与评分的分离：如何保障评估的生态效度？**

追问者知晓评分标准会导致追问行为被评分维度锚定，引入构念无关方差。解决方案：在数据构建层进行字段级信息隔离——不同Agent接收的数据结构由独立的视图构建函数（agentView.service.ts）生成，NPC不包含评分相关字段。隔离的严格性不由prompt文本来保证，而由数据结构定义来保证。

**（2）LLM评分的稳定性：如何量化并控制评分的随机误差？**

解决方案：5次独立采样+修剪均值聚合+方差门控。测量学依据来自G-theory的D-study逻辑。需进一步验证的关键问题：（a）方差阈值80是否在更大样本上仍然适用？（b）5次采样的trimmed mean信度能否通过与传统评分者信度（ICC）的直接比较来验证？（c）temperature参数（0.1）对采样间方差的系统性影响是什么？

**（3）证据覆盖的充分性：如何判断"什么时候可以停止追问"？**

解决方案：Slot Tracker跟踪每个槽位的证据状态，当至少6个维度获得partial以上证据且达到最小轮次时，Director可判定结束。需进一步验证：（a）覆盖阈值6的选择是否合理？两个场景各8个维度，覆盖6个意味着允许2个维度无证据，这个容忍度是否在可接受范围内？（b）当前partial证据的质量是否足够——从legacy behavior detection获得的partial证据是否与从dimension_evidence获得的clear证据具有足够的一致性？

**（4）情境间测量等值性：两个场景的评分是否可比？**

不同场景涉及不同维度——"会议室"侧重认知分析（信息辨别、交付切分），"餐厅"侧重人际处理（面子修复、员工修复）。两个场景产生的维度分数是否具有跨情境可比性？这一问题在AC文献中表现为"练习效应"——同一被试在不同练习中的表现可能差异显著（Lance et al., 2000）。需验证：不同场景下同一被试（同一次测评内）的维度分数模式是否主要由场景特征驱动还是被试特征驱动。

**（5）LLM评分偏差的识别与控制：模型的"性格"是否会影响评分？**

LLM可能对特定的语言风格、表达方式、论证模式具有系统性偏好——Zheng et al.（2024）对LLM-as-judge的评估证实了位置偏差（position bias）和冗长偏好（verbosity bias）的存在——这些偏好将转化为评分中的系统偏差。随机误差可通过多次采样和方差门控来控制，但系统偏差无法通过增加采样次数来消除，因为所有采样来自同一模型，共享同一组偏差。这一问题本系统尚未有效解决。

**（6）常模缺失：自适应追问下分数的跨个体可比性。**

这是本系统当前原型阶段最显著的测量学缺口。传统的常模建设假设所有被试接受相同或等值的测验，但本系统的追问是自适应的——不同被试在不同维度上被追问的深度和轮次不同。这提出了一个在传统测评中不常见的问题：两个被试在同一维度上得了相同的分数（如12/20），但如果被试A在该维度被追问了3轮而B只被追问了1轮，这两个12分是否等值？如果追问轮次和分数之间存在系统性关系（如追问越深越容易暴露行为证据，却也越容易暴露不足），那么直接比较分数就存在混淆。方案设计中讨论了锚定轮次和分场景常模两种可能的解决方向（参见§2.3），但均需在有真实用户数据后才能实施。

# 二、信度与效度：核心测量学考量

## 2.1 信度（Reliability）

信度关注的是"重复测量能否得到一致结果"。在本系统的上下文中，信度问题需要在三个不同层面分别考察：

**（一）评分者信度（Inter-rater Reliability）——Judge Agent的5次采样间一致性**

这是本系统信度设计的核心。传统AC通过多个评分者独立评分来计算ICC或Cohen's κ等信度系数。本系统以同模型的5次独立采样作为"评分者"的替代物，其适用前提是：LLM在temperature=0.1时的输出随机性可以近似模拟不同人类评分者之间的观点差异。

这一前提是有限制的。人类评分者之间的差异来源于不同的专业判断、经验背景和主观偏好——这些差异是"有意义的差异"（meaningful variance）。LLM多次采样之间的差异则来源于模型解码过程中的随机性——这些差异在严格意义上是"无意义的噪声"（noise variance）。因此，本系统的5次采样方差不能完全等同于传统意义上的评分者信度，它更准确地应被称为"评分稳定性"（scoring stability）或"模型内信度"（intra-model reliability）。

用G-theory术语表示，本系统的评分设计属于单面交叉设计（p × r），其中 r 为采样次数：

$$\sigma^2(X_{pr}) = \sigma^2_p + \sigma^2_r + \sigma^2_{pr,e}$$

D-study的期望信度系数：

$$E\rho^2 = \frac{\sigma^2_p}{\sigma^2_p + \frac{\sigma^2_{pr,e}}{n_r}}$$

当 n_r=1 时（仅使用单次评分），分母中包含完整的交互效应方差；当 n_r=5 时，交互效应方差被除以5，期望信度系数显著提升。这正是增加采样次数的统计依据。

**（二）内部一致性（Internal Consistency）——8个维度之间的关联结构**

在经典测量理论框架下，内部一致性通常用Cronbach's α系数估计（Cronbach, 1951）：

$$\alpha = \frac{k}{k-1}\left(1 - \frac{\sum_{i=1}^{k}\sigma^2_i}{\sigma^2_{total}}\right)$$

其中 k=8 为维度数，σ²_i 为第i个维度的方差，σ²_total 为总分的方差。Nunnally & Bernstein（1994）建议0.70为研究工具的α最低可接受值，0.80以上为良好。然而对于本系统而言，高α值未必是理想的测量学性质，这里需要仔细区分α上升的两种来源。AC文献中一个持续被讨论的发现是维度间存在显著的高相关（Lance et al., 2004的综述报告了AC维度评分的中位相关系数约为0.53），这通常被解释为：（a）评分者的晕轮效应（halo error）——评分者倾向于给同一被试在所有维度上相似的分数；（b）练习效应——同一练习中观察到的行为同时影响多个维度评分；（c）维度本身在概念层面存在真正的重叠。

在Judge Agent的上下文中，维度间高相关的来源可能包括：（a）LLM的"晕轮效应"——模型可能根据对用户的总体印象进行全局调整；（b）对话信息的非特异性——一段对话可能同时为多个维度提供证据，导致各维度评分的信息来源重叠；（c）维度概念本身的层级结构——例如"信息辨别"和"交付切分"可能同属一个更高阶的"任务分析"因子。

因此，本系统对α的使用不应是"追求高值"而是"诊断异常"：如果α异常高（>0.95），可能指示Judge Agent存在晕轮效应；如果α异常低（<0.5），可能指示维度间缺乏内在一致性。后续验证中建议同时报告维度间相关系数矩阵，并通过主成分分析或验证性因子分析探索维度结构。

**（三）跨情境信度（Cross-Scenario Reliability）**

同一被试在两个场景中的表现是否具有一致性？这是尚未被本系统直接测量但在解释分数时必须考虑的信度维度。如果"会议室"和"餐厅"两个场景测量的是同一个潜变量（即"管理情境能力"），那么同一被试在两个场景中的总分应该存在中等程度的相关。但按照AC文献中的发现（练习效应显著），更可能出现的情况是两个场景测量的是能力的相关但非等同的方面——这正是AC设计中使用多种练习的理论基础。

跨场景信度的形式化估计（需要同一被试完成两个场景的数据）：

$$\sigma^2(X_{ps}) = \sigma^2_p + \sigma^2_s + \sigma^2_{ps,e}$$

其中 s 表示场景面（scenario facet）。这部分验证需要同一被试完成两个场景的测评数据，是后续数据积累中的优先验证项。

## 2.2 效度（Validity）

效度在Messick（1989）的统一框架下被定义为一个整体概念——"对测验分数解释和使用的综合评价"。以下从内容效度、实质效度、结构效度、概化效度和后果效度五个方面论述本系统需要建立和正在建立的效度证据。

**（一）内容效度（Content Validity）**

内容效度关注的是"测评内容在多大程度上代表了目标领域"。本研究的论证链：

（1）维度选择的领域代表性。8个能力维度不是任意枚举的，它们分别对应管理情境评估文献中公认的核心领域。以Bartram（2005）的"Great Eight"胜任力框架为参照——该框架通过对29项效度研究的元分析，将管理胜任力归纳为8个大类（领导与决策、支持与合作、互动与呈现、分析与解释、创造与概念化、组织与执行、适应与应对、进取与表现）——本系统的维度覆盖了其中的6个大类（信息辨别→分析与解释，交付切分→组织与执行，承诺边界→领导与决策，向上对齐→互动与呈现，横向协商→支持与合作，压力表达→适应与应对）。新人赋能和备选方案等维度则更接近具体情境中的组合能力而非独立大类，这反映了本系统"情境特定能力评估"而非"通用胜任力评估"的设计取向。

（2）观察槽位的内容代表性。每个维度2个槽位、每个槽位绑定特定NPC角色的设计，确保了行为证据来源的多样性——同一维度的行为表现在不同关系压力源下可能以不同形式呈现。例如，"承诺边界"在VP追问下表现为"能否向领导诚实说明能做到的和不能做到的"，在隔壁组Leader追问下表现为"能否在请求协作资源时清晰说明条件、风险和备选方案"。两个槽位分别捕获了同一能力的两个行为侧面，增强了槽位对该维度行为域的内容覆盖。

（3）内容效度的形式化估计。可借助Lawshe（1975）的内容效度比（Content Validity Ratio, CVR）：

$$CVR = \frac{n_e - N/2}{N/2}$$

其中 N 为专家评委总数，n_e 为将某槽位评定为"必要"（essential）的评委数。CVR的取值范围为[-1, +1]，正值表示超过半数的评委认为该槽位是必要的。计划在后续阶段邀请3-5名有管理评估经验的专家对各槽位进行必要性评定，计算各槽位和维度的CVR。

**（二）实质效度（Substantive Validity）**

实质效度关注的是"被试在测评中的认知过程和回答行为是否与理论预期一致"。在本系统中，核心问题是：Director Agent的行为检测编码和Judge Agent的证据判定，在多大程度上与人类专家的编码一致？

验证方法：选取10-20份真实对话记录（mock模式下的模拟对话），由2-3名经过培训的人类评估者对Director的13项行为标记和Judge的维度证据进行独立编码。计算两类一致性指标：

（1）人-Agent编码一致性（Cohen's κ）：

$$\kappa = \frac{p_o - p_e}{1 - p_e}$$

其中 p_o 为观察到的人-Agent一致率，p_e 为随机一致率。κ ≥ 0.61 视为实质性一致（substantial agreement），κ ≥ 0.81 视为近乎完美一致（almost perfect agreement; Landis & Koch, 1977）。

（2）多人编码之间的共识度（用于标定人类编码的金标准质量）：

$$ICC(A,1) = \frac{MS_R - MS_E}{MS_R + (k-1)MS_E}$$

其中 MS_R 为被试间均方，MS_E 为残差均方，k 为编码者数量。

如果人-Agent一致性显著低于人与人的一致性，则表明Director/Judge的编码推理存在系统性偏差，需要在prompt设计或Agent输入信息结构上进行针对性改进。

**（三）结构效度（Structural Validity）**

结构效度关注的是"测验分数的内部结构是否符合理论预期"。对于本系统，需要验证：

（1）维度间相关结构。预期模式（基于AC文献）：维度间存在中等程度的正相关（r ≈ 0.30-0.60），因为所有维度同属"管理情境能力"这个高阶构念的不同侧面。异常模式：如果某两个维度的相关性异常低（r < 0.10），需检查数据中是否存在天花板效应或地板效应；如果异常高（r > 0.80），需检查是否存在LLM的晕轮效应或评分冗余。

（2）维度结构。通过验证性因子分析（CFA）检验理论假定的8因子模型与数据的拟合程度。CFA模型的拟合指标：

$$\chi^2 / df < 3.0, \quad CFI > 0.90, \quad RMSEA < 0.08, \quad SRMR < 0.08$$

如果8因子模型拟合不佳，考虑竞争模型：单因子模型（所有维度共享一个因子）、高阶因子模型（如"任务导向"和"人际导向"两个二阶因子）。

（3）情境间的测量等值性（Measurement Invariance）。如果同一被试完成了两个场景，可检验维度分数在不同场景间是否具有结构等值——即因子结构是否跨场景一致。这是跨场景比较分数的前提条件。

**（四）效标关联效度（Criterion-Related Validity）**

效标关联效度关注的是"测验分数在多大程度上能预测外部效标"。对于职场管理能力评估，最相关的效标包括：

（1）上级绩效评定（supervisor performance ratings）。收集被试（在使用本系统的真实测评场景中）的上级绩效评定，计算Pearson相关系数。根据AC元分析（Arthur et al., 2003）的基准，预期效度系数在0.25-0.40之间。

（2）360度反馈（multi-source feedback）。如果可用，收集同事、下级和自评数据，计算本系统评分与360度反馈各来源评分的聚合效度（convergent validity）和区分效度（discriminant validity）——预期本系统评分与上级和同事评分强相关，与自评弱相关（自评通常存在显著的自我提升偏差）。

（3）已知群体差异（known-group differences）。比较不同管理层级（如初级管理者vs高级管理者）被试的得分差异。基于管理能力随经验增长的假设，预期高级管理者的总分和部分维度（如向上对齐、系统改进）得分显著高于初级管理者。

**（五）后果效度（Consequential Validity）**

后果效度是Messick（1989）统一效度框架中最具争议但不容忽视的维度——它关注的是"测验的使用会产生什么后果，这些后果在多大程度上是公正的"。对于本系统，后果效度涉及以下具体问题：

（1）报告解释准确性。本系统刻意采用了"观察反馈"而非"确定性分数"的输出范式，使用"仅观察反馈""观察性反馈""建议人工复核"等标签来降低用户对分数的过度信任。需要验证的是：这些标签是否被用户理解？例如，一个标有"仅观察反馈"的报告是否确实被理解为"不能作为人事决策依据"？

（2）对不同语言风格群体的偏差。LLM可能对特定表达方式（如更结构化、更使用专业术语、更符合"标准职场话语"的表达）给予更高评分，这将对非母语者、沟通风格不同的群体构成系统性不利。需要在后续验证中分析维度分数与被试语言特征（如句子长度、词汇多样性、情感极性等表面语言特征）的相关性，检测是否存在与能力无关的语言偏好影响评分。

（3）反馈的发展性价值。本系统的一个设计假设是"观察反馈比分数更有发展性价值"。需要验证：是否报告中的证据卡片（引用用户原话+能力分析）比单纯分数更具有行为改变的引导价值？

## 2.3 常模（Norms）

前述信度与效度的讨论回答的是"这个分数有多准"（measurement precision）和"这个分数在测什么"（meaning of scores）。但心理测量学还有一个必须回答的问题：**这个分数意味着什么？**一个被试得了110分——这是高还是低？在什么参照系下判断？这就是常模（norms）要解决的问题。

### 2.3.1 常模的基本概念与本系统的特殊挑战

常模是"某一参照群体在测验上的分数分布"，它为个体分数的解释提供了比较基准。最常见的常模形式是百分等级（percentile rank）和标准分数（standard score, z-score及T-score）：

$$z = \frac{X - \bar{X}}{s}, \quad T = 50 + 10z$$

其中 X 为个体原始分数，$\bar{X}$ 为常模样组均值，s 为标准差。T分数均值为50、标准差为10，避免了z分数的负值。

然而，本系统面临一个传统常模建设不会遇到的根本困难：**追问是自适应的。**传统测验假设所有被试接受相同的题目（或至少从同一题库中按相同规则抽题），因此不同被试的原始分数具有可比性。但在本系统中，Director Agent根据每个被试的回复动态选择追问方向——一个被试可能被VP追问了5轮"承诺边界"而另一个被试只被追问了2轮。如果追问强度（每个维度被追问的轮次）本身影响了该维度的证据充分性和分数，那么原始分数之间的直接比较就存在问题。

这一困难与AC领域中经典的"练习效应"（exercise effect）有相似之处：不同被试在AC中经历的练习虽然情境相同，但角色扮演者的行为会根据被试的反应而有所不同。AC领域处理这一问题的通常做法是：（a）对角色扮演者进行严格的标准化培训，限制其"自由发挥"的范围；（b）在评分环节由多个评分者基于相同的维度定义独立评分，而非依赖角色扮演者提供的信息量。类比到本系统，解决方案的方向包括：（a）约束Director Agent的追问策略空间，确保每个维度至少被探测到一定深度；（b）Judge Agent的评分以"已有证据的质量"而非"证据的数量"为依据；（c）在常模建设中控制追问轮次和追问分布的潜在混淆效应。

### 2.3.2 本系统的常模建设方案

鉴于本系统尚处原型阶段，常模建设属于第二阶段（需要真实用户数据积累后）的工作。以下规划三种互补方案：

**方案一：分场景分维度常模（criterion-referenced with normative overlay）。**在固定场景下收集足够样本（每个场景至少N≥200）后，建立每个维度的分数分布。报告同时呈现：（a）维度原始分数（0-20）；（b）该分数在常模样组中的百分等级；（c）总分对应的常模参照等级（如下表）。这一方案默认假设同场景下的追问自适应程度在统计上可控——即Director的追问策略变异在大量被试中趋于均衡，维度分数的分布仍主要反映被试能力差异。

**常模参照等级划分（示例框架，需数据标定后调整）：**

| 百分等级 | T分数区间 | 常模参照等级 | 说明 |
|---------|----------|------------|------|
| ≥ 90 | ≥ 63 | 优秀 | 在常模样组中表现位于前10% |
| 75-89 | 57-62 | 良好 | 位于前25% |
| 40-74 | 47-56 | 中等 | 位于中位数附近 |
| 20-39 | 42-46 | 待发展 | 位于后20% |
| < 20 | < 42 | 需重点关注 | 位于后20%以下 |

注意：上表是纯常模参照（norm-referenced）的分级，与系统当前的ECD-based criterion-referenced分级（卓越/优秀/良好/合格/待提升，基于总分占满分的比例）是两套独立的参照系。理想情况下，报告应同时呈现两者——例如"您的维度总分位于常模样组的前15%（常模参照优秀），同时达到了ECD标准的'良好'等级（效标参照）"。两套参照系的交叉解释比任何单一标准都更有信息量。

**方案二：锚定轮次（anchor rounds）设计。**在对话中预设2-3个标准化追问轮次——这些轮次中所有被试面对完全相同的NPC追问（不由Director动态选择），相当于在自适应流中嵌入固定题本。锚定轮次的表现可以直接跨被试比较，因为它们不涉及自适应的混淆。锚定轮次的评分可以用来：（a）建立跨场景的通用常模；（b）校准不同场景的难度差异——如果场景A的锚定轮次得分系统性高于场景B，则说明场景B整体难度更高，可以在常模中对此进行调整。

**方案三：连续常模（continuous norming）。**如果样本量足够（N≥500），可以使用基于回归的连续常模方法（continuous norming; Lenhard et al., 2019），将分数建模为人口学变量（如管理层级、行业、工作经验年限）的平滑函数，而非简单划分为离散的年龄组或层级组。这比传统分组常模更精确，尤其适合中小样本下对特定子群体的分数估计。

### 2.3.3 常模建设的样本要求

参照《教育与心理测试标准》（AERA/APA/NCME, 2014, Standard 5.7-5.10），常模建设的最低要求：

- **总样本量**：每个常模子群体至少N≥100，推荐N≥200。本系统两个场景各需至少200个有效会话。
- **样本代表性**：常模样组应在关键人口学变量（行业、管理层级、工作经验、性别、年龄）上反映目标使用人群的分布。便利样本（如仅来自一家公司的被试）建立的常模缺乏概化效度。
- **常模时效性**：常模应定期更新（通常每3-5年），因为人群能力分布和职场环境在变化。LLM模型版本更新（如从DeepSeek-V2切换到DeepSeek-R1）可能系统性改变评分分布，需要重新建立常模。
- **常模文档**：常模报告应明确说明样本来源、采集时间、抽样方法和关键人口学变量的分布，以便使用者判断常模对其特定使用场景的适用性。

### 2.3.4 当前原型的分数解释策略

在常模建成之前，本系统采用纯效标参照（criterion-referenced）解释：分数反映的是被试在ECD框架下展示了多少行为证据，而非"比其他被试高还是低"。报告的观察区间标签（卓越/优秀/良好/合格/待提升）基于维度分占满分比例（≥87.5%→卓越，≥75%→优秀，≥60%→良好，≥45%→合格），而非基于常模分布。这一策略的测量学局限需要在使用中明确告知：**当前分数只能回答"你展示了多少相关行为证据"，不能回答"你在同类人群中的相对位置"。**

# 三、预期结果与成果提供形式

## 3.1 预期结果

**（1）可运行的系统原型。**支持2个场景×8维度×16槽位的完整评估流程，3类NPC自适应追问，SSE流式对话，5次采样评分+方差门控，多层级可解释报告。

**（2）信度证据。**预期结果：（a）5次Judge采样间的总分方差在mock模式下应小于30（高信度区间）；（b）真实LLM模式下需积累至少50次会话数据后进行G-study方差成分分解和D-study信度系数估计；（c）维度间相关系数的中位数预期在0.40-0.60之间。

**（3）效度证据。**第一阶段的预期产出：（a）内容效度——完成维度-槽位的内容效度比（CVR）专家评定；（b）实质效度——完成至少10组人-Agent编码一致性分析，预期κ ≥ 0.4（中等一致）为初始可接受标准；（c）结构效度——基于mock模式数据完成初步的维度间相关分析和探索性因子分析。

**（4）可解释的评估报告。**6层信息结构（维度分数+采样一致性+覆盖状态+原话引用+分析文字+发展建议），报告中的每一项结论均标注证据来源和置信度标签。

## 3.2 成果提供形式

（1）可运行软件系统（前端dist+后端Node.js服务+SQLite数据库+启动脚本）；（2）技术文档（前端功能规格书、数据库Schema、Agent接口类型定义、ECD映射说明）；（3）项目研究报告（本文档）；（4）完整的项目源代码（Git仓库）；（5）本地演示环境（mock模式零成本启动）。

# 四、特色与创新之处

**4.1 ECD框架从概念到可运行系统的完整映射。**ECD的五层模型（Mislevy et al., 2003）提出二十余年来，多数应用停留在传统测评领域的设计阶段。本研究将其一一对应为软件系统中的具体模块——Student Model→Rubric量化评分体系，Evidence Model→Slot Tracker的16槽位三档证据，Task Model→Director调度+ NPC追问生成，Assembly Model→覆盖跟踪+多轮终止，Presentation Model→前端交互——使ECD从"评估设计方法论"变为可追踪、可检验的运行代码。这本身不是理论创新，但它是ECD工程化的一个完整案例。

**4.2 追问与评分的架构级分离。**在LLM评估中，如果追问者看到了评分标准，追问方向会不自觉地被评分维度"锚定"。本系统不是在prompt里提醒Agent"别看答案"，而是在数据构建层硬性控制：追问NPC接收的数据结构中不包含评分量规、参考答案和行为标注字段。这一设计虽在工程上属于常规的访问控制，但在LLM评估领域却很少有人认真做——大多数AI面试或AI评分系统把追问和评分交给同一模型同一prompt。

**4.3 用多重采样在评分过程中内置信度控制。**传统测评先出分数后算信度，本系统在评分过程中就通过5次采样的方差来估计评分稳定性，信度不足时自动降级报告而非事后补救。方法层面，这实质上是将G-theory的"多评分者增加信度"逻辑用同模型多次采样来实现——局限性在于它只能量化随机波动（模型自身的噪声）而无法校正系统偏差（模型的偏好），这一点在§1.4的关键问题中有明确讨论。

**4.4 评估伦理立场："不确定时不给假分数"。**当Judge的5次采样分歧过大、证据覆盖不足、或用户作答质量过低时，系统主动降级为"仅观察反馈"——不出具正式分数，只给出基于已有证据的观察分析和后续建议。这一设计在理念上更接近形成性评估（Sadler, 1989; Black & Wiliam, 1998）——评估服务于发展而非分类——而非传统的终结性评价。这不是技术上的突破，是产品价值上的选择。

# 五、成本预算

## 5.1 开发投入

| 模块 | 人天 | 说明 |
|-----|------|------|
| 前端开发 | 20-25 | 10页面、流式对话、报告可视化 |
| 后端开发 | 25-30 | Multi-Agent编排、SSE流式、Prisma |
| Agent提示词设计 | 5-8 | 6个Agent的system prompt多轮调试 |
| 情境设计 | 3-5 | 场景文本、16观察槽位、评分量规 |
| **合计** | **53-68** | |

开发环境零基础设施成本（SQLite本地文件、Vite dev server）。

## 5.2 运行成本

单次10轮完整测评（含1次群聊校验和1次Judge 5采样）的LLM API成本约为0.36元（按DeepSeek API公开定价估算：10次Director调用约0.026元 + 10次NPC调用约0.025元 + 3次Group Discussion调用约0.01元 + Judge的5次强模型调用约0.30元）。

日均100次、月均3000次测评：LLM API约1,083元/月，云服务器约50-80元/月，域名分摊约5-8元/月，**月度合计约1,200元**，其中LLM成本占比约90%。

规模化场景（日均1000次）：月总成本约11,000元。成本优化方向包括Director/NPC切换至经济模型、采样次数从5降至3（需重新标定方差阈值）、实施高频对话模式的响应缓存。

Mock模式（USE_MOCK_LLM=true）API成本为零，适用于开发、演示和集成测试，不消耗API配额。

# 六、参考文献

## 心理测量学与评估方法论

[1] AERA, APA, & NCME. (2014). *Standards for educational and psychological testing*. American Educational Research Association.
> 正文引用：效度验证框架（§1.2目标三；§2.2效度）。本报告的五维效度证据框架直接依据该标准关于"效度不是测验的固有属性，而是对分数解释和使用合理性的综合评价"的核心论述。

[2] Messick, S. (1989). Validity. In R. L. Linn (Ed.), *Educational measurement* (3rd ed., pp. 13-103). American Council on Education.
> 正文引用：统一效度理论（§1.2目标三；§2.2效度全节；§4.4后果效度）。将效度重新定义为包含内容效度、实质效度、结构效度、概化效度、后果效度和社会后果的整体评价框架，本报告效度章节的整体结构即依据此框架组织。

[3] Mislevy, R. J., Steinberg, L. S., & Almond, R. G. (2003). On the structure of educational assessments. *Measurement: Interdisciplinary Research and Perspectives*, 1(1), 3-62.
> 正文引用：ECD五层模型（§1.1问题提出；§1.2目标一；§2.3技术路线；§4.1理论创新）。提出证据中心设计（ECD）的经典论文，定义了学生模型、证据模型、任务模型、组合模型、呈现模型五层架构。

[4] Mislevy, R. J., & Haertel, G. D. (2006). Implications of evidence-centered design for educational testing. *Educational Measurement: Issues and Practice*, 25(4), 6-20.
> 正文引用：ECD在教育测评中的应用（§1.2目标一）。讨论了ECD框架从理论到实践的转化路径。

[5] Brennan, R. L. (2001). *Generalizability theory*. Springer.
> 正文引用：概化理论（G-theory）（§1.2目标二；§2.1信度之评分者信度；§4.3多重采样）。G-theory的标准教材，本系统的G-study/D-study分析框架和信度系数公式均来源于此。

[6] Shavelson, R. J., & Webb, N. M. (1991). *Generalizability theory: A primer*. Sage.
> 正文引用：概化理论入门（§1.2目标二）。提供了G-study方差成分分解和D-study决策研究的简明教程。

[7] Cronbach, L. J. (1951). Coefficient alpha and the internal structure of tests. *Psychometrika*, 16(3), 297-334.
> 正文引用：Cronbach's α系数（§2.1信度之内部一致性）。定义了经典的内部一致性信度估计系数。

[8] Nunnally, J. C., & Bernstein, I. H. (1994). *Psychometric theory* (3rd ed.). McGraw-Hill.
> 正文引用：α系数的可接受标准（§2.1信度之内部一致性）。提出了α ≥ 0.70为研究工具最低标准的经典建议。

[9] Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement*, 20(1), 37-46.
> 正文引用：Cohen's κ系数（§1.2目标三之实质效度）。定义了分类变量评分者一致性的经典统计量。

[10] Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics*, 33(1), 159-174.
> 正文引用：κ系数的解释标准（§2.2效度之实质效度）。提出了κ ≥ 0.61为"实质性一致"、κ ≥ 0.81为"近乎完美一致"的分级标准。

[11] Shrout, P. E., & Fleiss, J. L. (1979). Intraclass correlations: Uses in assessing rater reliability. *Psychological Bulletin*, 86(2), 420-428.
> 正文引用：ICC作为评分者信度指标（§2.2效度之实质效度）。系统讨论了组内相关系数（ICC）的六种形式及其适用场景，本系统使用的ICC(A,1)模型（双向随机、绝对一致）为该框架下的标准选择。

[12] Lawshe, C. H. (1975). A quantitative approach to content validity. *Personnel Psychology*, 28(4), 563-575.
> 正文引用：内容效度比（CVR）（§2.2效度之内容效度）。提出了基于专家评定的内容效度量化方法，CVR = (n_e - N/2)/(N/2)。

[13] DeVellis, R. F. (2016). *Scale development: Theory and applications* (4th ed.). Sage.
> 正文引用：量表开发方法论（§1.2目标一；§2.2效度之结构效度）。系统讨论了构念操作化、条目生成、维度结构验证的量表开发全流程。

## 评价中心与情境测评

[14] Arthur, W., Day, E. A., McNelly, T. L., & Edens, P. S. (2003). A meta-analysis of the criterion-related validity of assessment center dimensions. *Personnel Psychology*, 56(1), 125-154.
> 正文引用：AC效度元分析（§1.1问题提出）。报告了AC维度评分的效度系数为0.36（34项研究），是AC效度文献中最常被引用的元分析。

[15] Gaugler, B. B., Rosenthal, D. B., Thornton, G. C., & Bentson, C. (1987). Meta-analysis of assessment center validity. *Journal of Applied Psychology*, 72(3), 493-511.
> 正文引用：AC效度早期元分析（§1.1问题提出）。N=14,909的五十年AC效度元分析，报告效度系数0.37，建立了AC效度的早期基准。

[16] Thornton, G. C., & Rupp, D. E. (2006). *Assessment centers in human resource management*. Lawrence Erlbaum.
> 正文引用：AC设计与运营标准（§1.2目标三之内容效度；§1.1问题提出）。AC领域的标准教科书，对AC效度的核心瓶颈分析——评分过程而非练习设计——启发本系统的Agent评分设计。

[17] Lance, C. E., Lambert, T. A., Gewin, A. G., Lievens, F., & Conway, J. M. (2004). Revised estimates of dimension and exercise variance components in assessment center postexercise dimension ratings. *Journal of Applied Psychology*, 89(2), 377-385.
> 正文引用：AC维度间高相关问题（§1.1问题提出；§1.3关键问题之证据覆盖；§2.1信度之内部一致性）。报告了AC维度评分的中位相关系数0.53，维度方差仅占总方差的22%。

[18] Lance, C. E., Newbolt, W. H., Gatewood, R. D., Foster, M. R., French, N. R., & Smith, D. E. (2000). Assessment center exercise factors represent cross-situational specificity, not method bias. *Human Performance*, 13(4), 323-353.
> 正文引用：AC练习效应与跨情境特异性（§1.4关键问题之情境间测量等值性）。论证了AC中的表现差异主要反映情境特异性而非方法偏差。

[19] Sackett, P. R., & Dreher, G. F. (1982). Constructs and assessment center dimensions: Some troubling empirical findings. *Journal of Applied Psychology*, 67(4), 401-410.
> 正文引用：AC构念效度经典质疑（§1.1问题提出）。早期发现AC评分在同一练习内相关性远高于同一维度跨练习相关性的经典论文，直接推动了后续AC效度理论的发展。

[20] International Task Force on Assessment Center Guidelines. (2015). Guidelines and ethical considerations for assessment center operations. *Journal of Personnel Psychology*, 14(4), 199-208.
> 正文引用：AC设计与实施指南（§1.2目标三）。为AC中角色扮演者培训、评分者培训和评分流程提供行业标准参照。

## 情境判断测验与结构化面试

[21] McDaniel, M. A., Morgeson, F. P., Finnegan, E. B., Campion, M. A., & Braverman, E. P. (2001). Use of situational judgment tests to predict job performance: A clarification of the literature. *Journal of Applied Psychology*, 86(4), 730-740.
> 正文引用：SJT效度元分析（§1.1问题提出）。102项效度研究（N=10,640）的元分析，报告SJT预测效度校正值为0.34，确定了SJT作为选拔工具的效度基准。

[22] Weekley, J. A., & Ployhart, R. E. (Eds.). (2006). *Situational judgment tests: Theory, measurement, and application*. Lawrence Erlbaum.
> 正文引用：SJT理论与设计（§1.1问题提出）。系统讨论了SJT的构念效度、反应过程效度和生态效度问题，为理解本系统与SJT的差异提供了理论基础。

[23] Lievens, F., Peeters, H., & Schollaert, E. (2008). Situational judgment tests: A review of recent research. *Personnel Review*, 37(4), 426-441.
> 正文引用：SJT研究综述（§1.1问题提出）。讨论了传统SJT在动态情境模拟方面的局限。

[24] Pulakos, E. D., Schmitt, N., Whitney, D., & Smith, M. (1996). Individual differences in interviewer ratings: The impact of standardization, consensus discussion, and sampling error on the psychometric properties of interview ratings. *Personnel Psychology*, 49(1), 83-102.
> 正文引用：结构化面试信度（§1.1问题提出）。报告结构化面试评分者信度中位数0.62，并论证了标准化程度对信度的调节效应。

[25] Conway, J. M., Jako, R. A., & Goodman, D. F. (1995). A meta-analysis of interrater and internal consistency reliability of selection interviews. *Journal of Applied Psychology*, 80(5), 565-579.
> 正文引用：面试信度元分析（§1.1问题提出）。报告结构化面试评分者信度均值0.69，并发现面试结构化和面试官培训是该系数的最强调节变量。

## 社会称许性与作答偏差

[26] Paulhus, D. L. (1984). Two-component models of socially desirable responding. *Journal of Personality and Social Psychology*, 46(3), 598-609.
> 正文引用：社会称许性偏差的双成分模型（§1.1问题提出）。将社会称许性分解为自我欺骗（self-deception）和印象管理（impression management）两个成分，后者的存在直接威胁选拔情境中自陈量表的效度。

[27] Zerbe, W. J., & Paulhus, D. L. (1987). Socially desirable responding in organizational behavior: A reconception. *Academy of Management Review*, 12(2), 250-264.
> 正文引用：组织行为中的社会称许性响应（§1.1问题提出）。论证了社会称许性在组织测评情境中作为"实质构念"而非"方法方差"的复杂角色。

[28] Meade, A. W., & Craig, S. B. (2012). Identifying careless responses in survey data. *Psychological Methods*, 17(3), 437-455.
> 正文引用：不充分努力应答（IER）检测（§1.3研究内容之响应质量门控）。系统比较了11种IER检测方法的效度，本系统Response Quality Gate的设计逻辑参考了其中的响应一致性和异常模式检测方法。

## LLM与AI评估

[29] Zheng, L., Chiang, W. L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., ... & Stoica, I. (2024). Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. In *Advances in Neural Information Processing Systems* (NeurIPS 2024).
> 正文引用：LLM-as-judge的偏差分析（§1.1问题提出）。系统评估了LLM作为评分者时存在的位置偏差（position bias）、冗长偏好（verbosity bias）和自我增强偏差（self-enhancement bias），直接关联本研究Judge Agent效度的潜在威胁。

[30] Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents: Interactive simulacra of human behavior. In *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology* (UIST '23).
> 正文引用：生成式Agent架构参考（§1.2研究内容之Multi-Agent角色系统）。提出了基于LLM的生成式Agent的记忆流、反思和计划三层架构，本系统NPC Agent的记忆模型借鉴了其记忆存储和检索的设计模式。

[31] Wang, L., Ma, C., Feng, X., Zhang, Z., Yang, H., Zhang, J., ... & Wen, J. R. (2024). A survey on large language model based autonomous agents. *Frontiers of Computer Science*, 18(6), 186345.
> 正文引用：LLM Agent综述（§1.2研究内容之Multi-Agent角色系统）。系统分类了LLM Agent的架构模式（单一Agent、多Agent协作、人-Agent交互），本系统的多角色隔离架构属于其中的"角色分工协作"子类。

[32] Landers, R. N., & Behrend, T. S. (2023). Auditing the AI auditors: A framework for evaluating fairness and bias in high-stakes AI predictive models. *Personnel Psychology*, 76(4), 1053-1085.
> 正文引用：AI评估的公平性与偏差（§2.2效度之后果效度）。提出了AI评估系统的公平性审计框架，本系统后果效度验证中对不同语言风格群体偏差的关注直接受到该框架的启发。

## 发展性评估

[33] Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science*, 18(2), 119-144.
> 正文引用：形成性评估理论（§4.4范式转向）。定义了发展性评估中"反馈必须缩小当前表现与目标之间的差距"的核心理念，本系统证据卡片的设计逻辑——引用原话+能力分析+发展建议——体现了这一原则。

[34] Black, P., & Wiliam, D. (1998). Assessment and classroom learning. *Assessment in Education: Principles, Policy & Practice*, 5(1), 7-74.
> 正文引用：发展性评估经典综述（§4.4范式转向）。对250余项研究的综述论证了"有效的形成性反馈比评分更有学习价值"，为本系统"观察反馈优先于分数交付"的设计取向提供了教育学证据。

## 胜任力框架与维度建模

[35] Bartram, D. (2005). The Great Eight competencies: A criterion-centric approach to validation. *Journal of Applied Psychology*, 90(6), 1185-1203.
> 正文引用：Great Eight胜任力框架（§1.2目标三之内容效度；§2.2效度之内容效度）。通过对29项效度研究的元分析提出8大胜任力分类，本系统维度选择的领域代表性论证以此为主要参照。

[36] Tett, R. P., Guterman, H. A., Bleier, A., & Murphy, P. J. (2000). Development and content validation of a "hyperdimensional" taxonomy of managerial competence. *Human Performance*, 13(3), 205-251.
> 正文引用：管理胜任力分类学（§2.2效度之内容效度）。提出了53维度的精细化管理胜任力分类，为本系统在8维度聚合与维度粒度之间的权衡提供了参照谱系。

## 大语言模型技术

[37] DeepSeek-AI. (2025). DeepSeek-R1: Incentivizing reasoning capability in LLMs via reinforcement learning. *arXiv preprint arXiv:2501.12948*.
> 正文引用：Judge Agent使用的推理模型（§1.3研究内容之Judge Agent）。DeepSeek-R1的推理增强特性（thinking模式）是本系统Judge Agent选择该模型的理论依据。

## 中文心理测量学参考教材

[38] 戴海琦, 张锋, 陈雪枫. (2011). *心理与教育测量* (第三版). 暨南大学出版社.
> 正文引用：CTT与G-theory的中文标准教材（§2.1信度；§2.2效度）。为经典测量理论、概化理论和效度分类提供中文术语标准参照。

[39] 漆书青, 戴海琦, 丁树良. (2003). *现代教育与心理测量学原理*. 高等教育出版社.
> 正文引用：IRT与概化理论的中文参考（§2.1信度）。讨论了CTT、G-theory和IRT三种测量学框架的内在联系。

[40] 凌文辁, 方俐洛. (2003). *心理与行为测量*. 机械工业出版社.
> 正文引用：评价中心与情境测评的中文参考（§1.2目标三）。系统介绍了AC的设计原理、中国常模建设和效度验证流程。

## 常模建设方法

[41] Lenhard, A., Lenhard, W., Suggate, S., & Segerer, R. (2019). A continuous solution to the norming problem. *Assessment*, 26(1), 120-135.
> 正文引用：连续常模方法（§2.3常模之方案三）。提出了基于回归的连续常模方法，规避传统分组常模在样本边界处的分数跳跃问题。本系统常模方案三直接参考了该方法的技术路线。

[42] Kolen, M. J., & Brennan, R. L. (2014). *Test equating, scaling, and linking: Methods and practices* (3rd ed.). Springer.
> 正文引用：测验等值与分数链接（§2.3常模之方案二锚定轮次）。系统讨论了不同测验形式之间的分数等值方法，锚定轮次设计中的"共同题等值"（common-item equating）逻辑来源于此。

---

*本文档基于对 llm-multi-agent-workplace-assessment-system（v0.1.0）代码仓库的完整阅读生成，所有技术描述均对应代码库中的实际实现。信度与效度验证框架中标注"需要后续数据"的部分，反映了本研究当前原型阶段与完整效度验证之间的方法论差距，这些差距本身即是下一步研究的路标。参考文献按主题领域聚类编排，每条文献下方附有正文引用位置和相关性说明，以便评审者快速定位该文献在报告中的作用。*
