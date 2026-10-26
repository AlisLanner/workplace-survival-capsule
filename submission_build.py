from __future__ import annotations

import hashlib
import html
import json
import os
import shutil
import stat
import subprocess
import textwrap
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


PROJECT_ROOT = Path(r"D:\job_project\workplace-survival-capsule")
OUTPUT_DIR = PROJECT_ROOT / "参赛材料_第八届人工智能创新大赛"
WORK_DIR = PROJECT_ROOT / ".codex-work" / "submission-build"
TEAM = "三个诸葛亮"
PROJECT = "MACST多智能体岗位胜任力情境测验"
SAFE_PREFIX = f"{TEAM}_{PROJECT}"

# ReportLab's bundled TTFont reader does not support the PostScript outlines in
# the installed Noto OTF files, so use Windows TrueType CJK fonts instead.
FONT_REGULAR = Path(r"C:\Windows\Fonts\Deng.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\Dengb.ttf")
FONT_MEDIUM = Path(r"C:\Windows\Fonts\Deng.ttf")
FFMPEG_CANDIDATES = [
    Path(r"C:\Users\Administrator\AppData\Local\JianyingPro\Apps\10.0.0.13832\ffmpeg.exe"),
    Path(r"C:\Users\Administrator\AppData\Local\JianyingPro\Apps\9.7.1.13726\ffmpeg.exe"),
]

NAVY = colors.HexColor("#0B1220")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5B6577")
BLUE = colors.HexColor("#1769E0")
TEAL = colors.HexColor("#0B8F87")
ORANGE = colors.HexColor("#D97824")
PALE_BLUE = colors.HexColor("#EAF2FF")
PALE_TEAL = colors.HexColor("#E7F7F5")
PALE_ORANGE = colors.HexColor("#FFF1E3")
LINE = colors.HexColor("#D7DEEA")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("NotoSC", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("NotoSC-Bold", str(FONT_BOLD)))
    pdfmetrics.registerFont(TTFont("NotoSC-Medium", str(FONT_MEDIUM)))


register_fonts()


def esc(value: object) -> str:
    return html.escape(str(value), quote=False)


def styles_for(font_size: float = 9.5):
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="BodyCN", parent=styles["BodyText"], fontName="NotoSC", fontSize=font_size,
        leading=font_size * 1.65, textColor=INK, spaceAfter=4.2 * mm, alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="SmallCN", parent=styles["BodyText"], fontName="NotoSC", fontSize=7.5,
        leading=11, textColor=MUTED, spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        name="CoverTitle", parent=styles["Title"], fontName="NotoSC-Bold", fontSize=25,
        leading=34, textColor=NAVY, alignment=TA_CENTER, spaceAfter=8 * mm,
    ))
    styles.add(ParagraphStyle(
        name="CoverSub", parent=styles["Normal"], fontName="NotoSC", fontSize=11,
        leading=18, textColor=MUTED, alignment=TA_CENTER, spaceAfter=3 * mm,
    ))
    styles.add(ParagraphStyle(
        name="H1CN", parent=styles["Heading1"], fontName="NotoSC-Bold", fontSize=16,
        leading=23, textColor=NAVY, spaceBefore=5 * mm, spaceAfter=3 * mm, keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        name="H2CN", parent=styles["Heading2"], fontName="NotoSC-Bold", fontSize=12,
        leading=18, textColor=BLUE, spaceBefore=3.5 * mm, spaceAfter=2 * mm, keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        name="H3CN", parent=styles["Heading3"], fontName="NotoSC-Medium", fontSize=10.3,
        leading=15, textColor=INK, spaceBefore=2.5 * mm, spaceAfter=1.5 * mm, keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        name="TableCN", parent=styles["Normal"], fontName="NotoSC", fontSize=7.2,
        leading=10, textColor=INK, wordWrap="CJK",
    ))
    styles.add(ParagraphStyle(
        name="TableHeadCN", parent=styles["Normal"], fontName="NotoSC-Bold", fontSize=7.4,
        leading=10, textColor=colors.white, wordWrap="CJK",
    ))
    styles.add(ParagraphStyle(
        name="CalloutCN", parent=styles["BodyText"], fontName="NotoSC", fontSize=8.6,
        leading=14, textColor=INK, leftIndent=4 * mm, rightIndent=4 * mm,
        spaceBefore=2 * mm, spaceAfter=3 * mm,
    ))
    return styles


STYLES = styles_for()


def P(text: object, style: str = "BodyCN") -> Paragraph:
    return Paragraph(esc(text), STYLES[style])


def rich(text: str, style: str = "BodyCN") -> Paragraph:
    return Paragraph(text, STYLES[style])


def bullet(text: str) -> Paragraph:
    return Paragraph("• " + esc(text), STYLES["BodyCN"])


def table(data, widths, header=True, font_size=7.2, row_backgrounds=None):
    converted = []
    for ridx, row in enumerate(data):
        out = []
        for cell in row:
            if isinstance(cell, Paragraph):
                out.append(cell)
            else:
                style = "TableHeadCN" if header and ridx == 0 else "TableCN"
                out.append(Paragraph(esc(cell), STYLES[style]))
        converted.append(out)
    t = Table(converted, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.8 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8 * mm),
    ]
    if header:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), BLUE))
    if row_backgrounds:
        for row_idx, color in row_backgrounds.items():
            commands.append(("BACKGROUND", (0, row_idx), (-1, row_idx), color))
    else:
        start = 1 if header else 0
        for row_idx in range(start, len(converted)):
            if (row_idx - start) % 2 == 1:
                commands.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#F7F9FC")))
    t.setStyle(TableStyle(commands))
    return t


def callout(text: str, tone="blue"):
    bg = {"blue": PALE_BLUE, "teal": PALE_TEAL, "orange": PALE_ORANGE}.get(tone, PALE_BLUE)
    t = Table([[Paragraph(esc(text), STYLES["CalloutCN"])]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEBEFORE", (0, 0), (0, -1), 3, {"blue": BLUE, "teal": TEAL, "orange": ORANGE}.get(tone, BLUE)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    return t


def roman(n: int) -> str:
    vals = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"),
            (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    result = ""
    for value, symbol in vals:
        while n >= value:
            result += symbol
            n -= value
    return result


def on_page(canvas, doc):
    page = canvas.getPageNumber()
    width, height = A4
    canvas.saveState()
    if page > 1:
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.45)
        canvas.line(18 * mm, height - 16 * mm, width - 18 * mm, height - 16 * mm)
        canvas.setFont("NotoSC", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, height - 12 * mm, PROJECT)
        canvas.drawRightString(width - 18 * mm, height - 12 * mm, "项目文档 · 参赛材料")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.45)
    canvas.line(18 * mm, 15 * mm, width - 18 * mm, 15 * mm)
    canvas.setFont("NotoSC", 7)
    canvas.setFillColor(MUTED)
    page_label = roman(page) if page <= 3 else str(page - 3)
    canvas.drawCentredString(width / 2, 9.5 * mm, page_label)
    canvas.restoreState()


class CNDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        super().__init__(filename, **kwargs)
        frame = Frame(18 * mm, 20 * mm, 174 * mm, 255 * mm, id="normal", leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])


def cover_story(styles, subtitle: str, doc_label: str = "项目文档"):
    story = [Spacer(1, 28 * mm), P("第八届中国研究生人工智能创新大赛", "CoverSub"),
             Spacer(1, 5 * mm), P(PROJECT, "CoverTitle"),
             P("基于LLM Multi-Agent的职场情境能力评估系统", "CoverSub"),
             Spacer(1, 18 * mm)]
    meta = [
        [P("作品名称", "TableCN"), P(PROJECT, "TableCN")],
        [P("团队名称", "TableCN"), P(TEAM, "TableCN")],
        [P("依托单位", "TableCN"), P("南京师范大学", "TableCN")],
        [P("参赛组别", "TableCN"), P("人工智能创新赛道", "TableCN")],
        [P("版本 / 日期", "TableCN"), P("V1.0 / 2026年8月19日", "TableCN")],
    ]
    mt = Table(meta, colWidths=[35 * mm, 135 * mm])
    mt.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("BACKGROUND", (0, 0), (0, -1), PALE_BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    story.append(mt)
    story += [Spacer(1, 18 * mm), P(subtitle, "SmallCN"), PageBreak()]
    return story


def toc_story():
    return [Spacer(1, 6 * mm), P("目录", "H1CN"), Spacer(1, 2 * mm),
            table([
                ["章节", "内容"],
                ["1 项目概况", "背景和基础；场景和价值；所需支持"],
                ["2 项目规划", "整体目标；技术创新点"],
                ["3 实施方案", "技术可行性分析；技术细节；计划和分工"],
                ["4 参考资料", "研究指标、来源与借鉴矩阵、参考文献"],
            ], [45 * mm, 125 * mm]),
            Spacer(1, 10 * mm),
            callout("说明：本材料将当前源码、便携演示包和参考研究结果分别标注；参考研究报告中的N=50指标不等同于本次本地Mock演示的实时模型推理结果。", "orange"),
            PageBreak()]


def revision_story():
    return [Spacer(1, 7 * mm), P("文档修订记录", "H1CN"),
            table([
                ["版本", "日期", "修订人", "修订内容"],
                ["V1.0", "2026-08-19", "项目材料整理", "依据项目源码、参考DOCX、比赛模板和技术调研底稿，完成初赛材料初稿；补充版本边界、推理指标和来源矩阵。"],
            ], [20 * mm, 28 * mm, 32 * mm, 90 * mm]),
            Spacer(1, 12 * mm), P("版本边界声明", "H2CN"),
            P("项目主源码目录当前包含5个情境：项目危机、餐厅投诉、零点大促故障、交接复盘、入职第一周；随项目提供的Windows便携版是较早的可运行快照，当前接口实测包含前2个情境。两者共享核心编排、角色隔离、证据槽位和Judge聚合机制，但场景数量不同。参赛压缩包将同时保留源码与便携演示包，避免把旧快照误述为当前源码版本。", "BodyCN"),
            Spacer(1, 8 * mm), callout("材料中的“已实现”指可由源码、测试或运行接口直接核验；“研究报告指标”指参考DOCX报告给出的N=50验证结果；“设计目标”则不宣称已完成实证验证。", "teal"),
            PageBreak()]


def project_story():
    s = []
    s += [P("1 项目概况", "H1CN"),
          P("1.1 背景和基础", "H2CN"),
          P("传统岗位胜任力测评常把复杂、情境化的行为压缩成自陈量表、一次性选择题或结构化问答。它们在成本、标准化和大样本统计上成熟，但难以连续观察被测者如何澄清信息、分解交付、处理冲突、设定边界并在压力下复盘。MACST将情境测验从“题目—答案”扩展为“情境刺激—多轮行为—证据槽位—多视角评分—可追溯反馈”的过程。项目定位是研究与培训场景中的行为观察和反馈原型，不作为单一的招聘、晋升、解聘或惩罚依据。", "BodyCN"),
          P("项目以Evidence-Centered Design（ECD）为测量蓝图，将能力主张、任务特征和可观察证据对齐；以LangGraph状态图实现可恢复的多智能体流程；以SQLite保存会话、消息和AgentTraceEvent；以DeepSeek兼容接口完成真实模型推理，并保留显式Mock模式供无Key、离线或课堂演示使用。[1][2][3]", "BodyCN"),
          callout("核心判断：本作品的创新不在于声称发明了LLM、Multi-Agent或某一种统计量，而在于将测量学蓝图、动态探测、角色信息隔离、证据追踪和不确定性闸门组成一套可审计的职场情境推理流程，并用研究报告指标验证其可行性。", "blue"),
          P("1.2 场景和价值", "H2CN"),
          P("当前源码提供5个可配置情境，覆盖项目协作、客户投诉、线上故障、交接复盘和入职适应。每个情境以领导/同事/客户或下属等角色提供刺激，用户必须在有限轮次中做出自然语言回应。项目参考研究将8个岗位行为维度落为16个观察槽位：信息辨识、交付拆解、备选方案、承诺边界、向上对齐、横向协商、下属赋能、压力表达。代码中的槽位状态为unseen、probed、evidenced、insufficient，Director依据覆盖缺口选择下一步探测。", "BodyCN"),
          table([
              ["用户/场景", "价值", "输出"],
              ["学生与求职者", "在低风险模拟中练习澄清、协商、交付和复盘", "行为证据、维度雷达、改进建议"],
              ["高校就业与课程", "用统一情境开展结构化练习、过程观察和教学反馈", "班级案例、过程轨迹、可复盘对话"],
              ["企业培训与教练", "围绕关键事件设计角色扮演和复盘", "角色视角反馈、槽位覆盖、风险提示"],
              ["测量研究", "验证动态情境、多智能体和LLM评分的组合边界", "信度、稳定性、效度与公平性指标"],
          ], [34 * mm, 70 * mm, 66 * mm]),
          P("1.3 所需支持", "H2CN"),
          P("项目当前可在普通Windows CPU环境运行，便携包捆绑Node v20.18.1与SQLite；真实模型模式需要DeepSeek兼容API及网络访问，不需要本地GPU；Mock模式无需API Key，适合展示交互和工程流程。后续实证研究需要伦理与知情同意流程、脱敏原始对话、更多职业样本、独立评分者及可复现的模型版本记录。", "BodyCN"),
          P("2 项目规划", "H1CN"),
          P("2.1 整体目标", "H2CN"),
          bullet("目标A：让动态对话能够覆盖预先定义的能力证据，而不是只生成开放式聊天。"),
          bullet("目标B：让不同角色只看到其应知信息，避免角色直接读取评分标准或用户进度。"),
          bullet("目标C：让评分结果带有原始行为证据、维度解释和不确定性状态，支持人工复核。"),
          bullet("目标D：让系统在无GPU、无API Key时仍能完整演示流程，在真实模型模式下具备可替换的推理供应商。"),
          bullet("目标E：以小样本验证作为可行性证据，同时明确不把原型指标外推为行业常模。"),
          P("2.2 技术创新点", "H2CN"),
          table([
              ["创新点", "机制与严谨性", "相对已有工作的增量"],
              ["测量过程型Multi-Agent", "Director负责探测，NPC负责角色刺激，Group Guard负责协作审查，Judge负责评分；节点、输入输出和失败分支均持久化。", "区别于把单个LLM直接包装成问卷或单一评委；创新主要是面向职场SJT的系统集成。"],
              ["槽位覆盖控制", "每个情境16个槽位、8个维度；槽位记录状态、目标角色、意图和优先级；覆盖6个维度以上才允许正常完成。", "把ECD的证据模型落实为运行时控制，降低自由聊天造成的证据缺失。"],
              ["角色视图隔离", "NPC只接收公开事实、角色记忆、当前刺激和控制信息；不接收rubric、user_progress、evaluation_notes或其他角色记忆。", "针对提示泄漏、角色串台和迎合评分标准的风险做结构性约束。"],
              ["评分不确定性闸门", "5次并行Judge，维度分数去掉极值后取中间3次均值；总分方差达到80则标记unratable并要求人工复核。", "把LLM-as-a-Judge的分歧显式化，而不是只输出一个无置信信息的分数。"],
              ["证据链与可追溯反馈", "保存原始消息、槽位状态、节点轨迹和Judge报告；报告区分行为证据、解释和建议。", "提高从分数回到对话证据的可审计性，便于研究复核与纠错。"],
              ["可部署与可降级", "真实模型与Mock显式分支；CPU+SQLite便携运行；供应商、快/强模型和超时可配置。", "把教学/研发试用的可及性纳入系统设计，不把云端GPU当作必要前提。"],
          ], [32 * mm, 73 * mm, 65 * mm]),
          callout("创新性边界：ECD、关键事件法、岗位角色框架、LLM-as-a-Judge、修剪均值和方差并非本项目首创；本项目声明的是“面向岗位胜任力情境测验的组合式实现、运行时约束和验证闭环”，并在引用矩阵中逐项标注借鉴关系。", "orange"),
          P("3 实施方案", "H1CN"),
          P("3.1 技术可行性分析", "H2CN"),
          table([
              ["层次", "实现", "可行性依据"],
              ["前端", "React 19 + TypeScript + Vite + Recharts", "已有构建通过；可展示情境、对话、Agent状态、雷达图和报告。"],
              ["编排", "Node/Express/TypeScript + LangGraph StateGraph", "状态节点与条件边明确，支持prepareTurn、quality gate、director、group guard、npc、persist、judge、finalize。"],
              ["存储", "Prisma + SQLite", "保存User、Scenario、Session、Message、GroupDiscussion、AgentTraceEvent，适合原型和本地复现。"],
              ["推理", "DeepSeek兼容Chat Completions；Mock fallback", "真实模型温度、模型、超时、思考模式可配置；无Key时进入显式Mock debug状态。"],
              ["部署", "Windows便携包 + Node runtime", "接口实测health为200；便携包默认监听127.0.0.1:17863；不依赖本地GPU。"],
          ], [26 * mm, 62 * mm, 82 * mm]),
          P("3.2 技术细节", "H2CN"),
          P("（1）动态Inference：Director读取当前覆盖和角色状态，选择尚未充分取证的槽位；响应质量门对空答案、数字/极短答案、明确拒答和超时做规则判定，连续3次低信息则终止，避免把无证据对话强行送入评分。节点之间只传递经过裁剪的AgentView。", "BodyCN"),
          P("（2）角色与信息边界：leader、coworker、client等NPC拥有公开事实、自己的角色记忆、当前刺激和控制字段；rubric与其他角色记忆不进入NPC视图。Group Discussion只接收允许共享的摘要；Judge才读取rubric、用户进度、最新行为、评价备注和完整对话。该边界由agentView.service.ts实现并有测试覆盖。", "BodyCN"),
          P("（3）评分Inference：Judge以低温度0.1并行采样5次，输出每个维度0—20分及证据。对每一维排序后去掉最低和最高分，取中间3次均值；总分方差超过阈值80则report_status=unratable，要求人工复核。研究报告中的真实模型试验还报告了5样本Judge稳定性，但不能替代当前版本的重新复验。", "BodyCN"),
          P("（4）可审计性：每次运行写入AgentTraceEvent，记录runId、node、status、elapsed、sequence，并对payload做脱敏/裁剪。报告把行为原文、证据解释、能力维度和建议连接起来；研究者可沿“对话→槽位→维度→总分”回查。", "BodyCN"),
          table([
              ["指标/闸门", "源码或研究报告中的定义", "当前解释"],
              ["5样本Judge", "5个并行评分样本；每维修剪均值", "已实现的评分聚合机制；Mock运行不代表真实模型质量。"],
              ["总分方差<80", "达到80或以上标记unratable", "不确定性控制；阈值是工程闸门，不是心理测量学常模。"],
              ["覆盖≥6维度", "coveredDimensions.length ≥ 6才完成", "防止证据明显不足时直接生成报告。"],
              ["低信息连续3次", "空/极短/拒答等响应触发终止", "输入质量保护；不把沉默误判为低能力。"],
              ["44项测试", "6个Vitest文件共44项通过", "工程回归证据，不等同于N=44个受试者，也不等同于模型推理评测。"],
          ], [39 * mm, 76 * mm, 55 * mm]),
          P("（5）研究验证：参考DOCX报告采用50名参与者、3名专家、2名编码者和20名7日重测参与者，验证内容效度、编码一致性、重测稳定性、内部一致性、Judge稳定性、结构效度、聚合效度和区分效度。该组数据与当前仓库代码分开保存，参赛压缩包不包含50名参与者的原始对话。", "BodyCN"),
          P("3.3 计划和分工", "H2CN"),
          table([
              ["角色", "工作内容", "交付/验收"],
              ["测量与场景", "ECD蓝图、关键事件、槽位定义、专家审查、伦理与知情同意", "情境卡、维度—槽位矩阵、效度和局限说明"],
              ["Agent与后端", "状态图、AgentView、质量门、Judge聚合、日志与数据库", "构建通过、44项测试通过、可追溯trace"],
              ["前端与交互", "情境选择、对话、进度、报告和调试提示", "前端构建通过、核心目标可演示"],
              ["部署与材料", "便携版、视频、文档、引用、压缩包和版本核验", "初赛四项材料、大小限制和命名检查"],
          ], [35 * mm, 86 * mm, 49 * mm]),
          P("里程碑：M1完成场景与测量蓝图；M2完成多智能体编排与角色隔离；M3完成Judge稳定性闸门和报告；M4完成小样本验证与误差分析；M5完成便携部署、视频和材料审校。当前源码已覆盖M1—M3的工程部分，研究扩展与更多样本验证列为后续工作。", "BodyCN"),
          P("4 参考资料", "H1CN"),
          P("4.1 研究验证指标摘要", "H2CN"),
          table([
              ["类别", "参考报告结果", "判读"],
              ["内容效度", "初版25/32个槽位CVR≥.75，平均CVR=.853；修订后31/32（96.9%）", "专家审查支持测量内容覆盖；仍需扩充专家与样本。"],
              ["编码一致性", "总ICC=.82（.79—.85），总Kappa=.79（.75—.82）", "两位编码者对行为证据的标注一致性较好。"],
              ["重测稳定性", "维度平均r=.764，总分r=.81；间隔7日，N=20", "支持短期稳定性，但样本很小。"],
              ["内部一致性", "平均α=.688；6/8维度达目标；承诺边界=.63、下属赋能=.64偏弱", "两维度需要补充槽位与修订评分规则。"],
              ["Judge稳定性", "5样本维度SD均值=.134，范围.12—.15；对话通过率68%—86%", "表明存在可控分歧，但边界维度仍需人工复核。"],
              ["结构效度", "KMO=.77；Bartlett χ²(28)=264.38，p<.001；三因子累计64.7%", "任务导向、人际协作、适应性三因子得到初步支持。"],
              ["聚合/区分", "与SJT总分r=.54；社会赞许r=.14（p=.332）；认知测验r=.19（p=.186）", "与相近测量有中等关联，与区分变量无显著关联；不代表因果。"],
          ], [35 * mm, 78 * mm, 57 * mm]),
          callout("重要证据标注：以上8行是“参考DOCX报告披露的研究结果”，不是本次运行在当前仓库中重新计算的结果；当前仓库没有配套的N=50原始数据和逐条评分文件，因此材料不把它们包装成可由评委现场复算的源码输出。", "orange"),
          P("4.2 数据、行业知识、算法、硬件的来源与借鉴矩阵", "H2CN"),
          table([
              ["对象", "来源", "使用方式", "性质"],
              ["参与者数据", "参考DOCX：N=50，20人7日重测；知情同意、匿名化", "用于效度、信度和稳定性研究摘要；原始数据未随本包发布", "引用/借鉴，非当前仓库内可复算数据"],
              ["场景与槽位", "项目团队基于关键事件和岗位协作冲突撰写；参考DOCX的4情境与8维度", "形成当前5情境、16槽位/情境的seed与slotTracker", "项目原创编写 + 明确借鉴"],
              ["行业知识", "Flanagan关键事件法；Mintzberg管理角色；Bartram Great Eight；Big Five/HEXACO；SCCT等", "用于选择情境、角色关系和行为维度", "理论借鉴，非数据训练"],
              ["测量设计", "Mislevy ECD；Lawshe CVR；Campion等SJT建议；AERA/APA/NCME标准", "用于主张—任务—证据对齐、专家审查和解释边界", "方法引用"],
              ["算法/框架", "LangGraph StateGraph；LLM-as-a-Judge相关研究；ICC/Kappa、PCA+Varimax、Spearman-Brown", "用于编排、评分、编码一致性和参考研究分析", "开源框架/统计方法借鉴"],
              ["原创机制", "项目团队设计：16槽位运行时覆盖、AgentView隔离、5样本修剪均值、方差闸门、低信息终止", "直接实现于代码与提示词", "项目原创工程组合；仍需更大样本验证"],
              ["硬件/软件", "Windows CPU；Node v20.18.1便携运行时；SQLite；DeepSeek兼容API", "本地部署、云端推理或Mock降级；不依赖GPU", "部署来源与配置，不宣称硬件创新"],
          ], [28 * mm, 48 * mm, 62 * mm, 32 * mm]),
          P("4.3 主要参考文献", "H2CN"),
          P("[1] Mislevy, R. J., Steinberg, L. S., & Almond, R. G. (2003). On the Structure of Educational Assessments. Measurement: Interdisciplinary Research and Perspectives, 1(1), 3–62. DOI: 10.1207/S15366359MEA0101_02。", "SmallCN"),
          P("[2] Flanagan, J. C. (1954). The critical incident technique. Psychological Bulletin, 51(4), 327–358. DOI: 10.1037/h0061470。", "SmallCN"),
          P("[3] LangChain. LangGraph JavaScript overview and Graph API. 官方文档，访问日期：2026-08-19。", "SmallCN"),
          P("[4] McDaniel, M. A., et al. (2001). Predicting job performance using situational judgment tests: A meta-analysis. Journal of Applied Psychology, 86(4), 730–738. DOI: 10.1037/0021-9010.86.4.730。", "SmallCN"),
          P("[5] Arthur, W., Day, D. V., McNelly, T. L., & Edens, P. S. (2003). A meta-analysis of the criterion-related validity of assessment center dimensions. Personnel Psychology, 56(1), 125–154. DOI: 10.1111/j.1744-6570.2003.tb00146.x。", "SmallCN"),
          P("[6] Conway, J. M., Jako, R. A., & Goodman, D. F. (1995). A meta-analysis of interrater and internal consistency reliability of selection interviews. Journal of Applied Psychology, 80(5), 565–579. DOI: 10.1037/0021-9010.80.5.565。", "SmallCN"),
          P("[7] Zheng, L., et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. arXiv:2306.05685. DOI: 10.48550/arXiv.2306.05685。", "SmallCN"),
          P("[8] Krumm, S., et al. (2024). Creating a Psychological Test in a Few Seconds: Can ChatGPT Develop a Psychometrically Sound Situational Judgment Test? European Journal of Psychological Assessment. DOI: 10.1027/1015-5759/a000878。", "SmallCN"),
          P("[9] Park, J. S., et al. (2023). Generative Agents: Interactive Simulacra of Human Behavior. UIST 2023. DOI: 10.1145/3586183.3606763。", "SmallCN"),
          P("[10] Lawshe, C. H. (1975). A quantitative approach to content validity. Personnel Psychology, 28(4), 563–575. DOI: 10.1111/j.1744-6570.1975.tb01393.x。", "SmallCN"),
          P("[11] Shrout, P. E., & Fleiss, J. L. (1979). Intraclass correlations: Uses in assessing rater reliability. Psychological Bulletin, 86(2), 420–428. DOI: 10.1037/0033-2909.86.2.420。", "SmallCN"),
          P("[12] AERA, APA, & NCME. (2014). Standards for Educational and Psychological Testing. Washington, DC。", "SmallCN"),
          P("[13] Goldberg, L. R. (1990). An alternative description of personality: The Big-Five factor structure. Journal of Personality and Social Psychology, 59(6), 1216–1229. DOI: 10.1037/0022-3514.59.6.1216。", "SmallCN"),
          P("[14] Ashton, M. C., & Lee, K. (2007). Empirical, theoretical, and practical advantages of the HEXACO model. Personality and Social Psychology Review, 11(2), 150–166. DOI: 10.1177/1088868306294907。", "SmallCN"),
          P("[15] 参考资料：多智能体岗位胜任力情境测验的构建与验证.docx（项目组提供，2026年）；附件2：第八届中国研究生人工智能创新大赛项目文档模版.pdf（赛事模板，2026年）。", "SmallCN"),
          P("[16] 项目源码与配置：D:\\job_project\\workplace-survival-capsule；提交包内附版本核验说明、源码、便携运行包和研究材料索引。", "SmallCN")]
    return s


def build_project_pdf(path: Path):
    doc = CNDocTemplate(str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
                        topMargin=20 * mm, bottomMargin=20 * mm, title=PROJECT, author=TEAM)
    story = cover_story(STYLES, "初赛项目文档 / 版本1.0", "项目文档") + toc_story() + revision_story() + project_story()
    doc.build(story)


def build_intro_pdf(path: Path):
    intro = ("MACST是基于LLM Multi-Agent的情境能力评估系统。项目以ECD为蓝图，将5类情境拆成8项行为维度和16个证据槽位，由Director动态追问、角色Agent提供受限视角、Judge五次评分，以修剪均值和方差闸门控制分歧。参考研究N=50：编码ICC=.82、Kappa=.79，7日重测总分r=.81，Judge维度SD均值=.134，与SJT总分r=.54；44项测试通过，支持API与Mock便携运行。创新在于将测量蓝图、动态探测、信息隔离、证据链和人工复核组合为可审计流程，而非把LLM当作单一评分器。用于教学、培训和测量研究，不作为单一人事决策依据。")
    if len(intro) > 300:
        raise ValueError(f"简介超过300字：{len(intro)}")
    doc = CNDocTemplate(str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
                        topMargin=20 * mm, bottomMargin=20 * mm, title=f"{PROJECT}参赛作品简介", author=TEAM)
    story = [Spacer(1, 23 * mm), P("参赛作品简介", "CoverTitle"),
             P(PROJECT, "CoverSub"), Spacer(1, 10 * mm),
             Table([[P(intro, "BodyCN")]], colWidths=[160 * mm], style=TableStyle([
                 ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                 ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                 ("TOPPADDING", (0, 0), (-1, -1), 6 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
             ])), Spacer(1, 14 * mm),
             table([["团队", TEAM], ["单位", "南京师范大学"], ["赛道", "人工智能创新赛道"], ["简介字数", str(len(intro))]], [35 * mm, 125 * mm]),
             Spacer(1, 18 * mm), callout("证据边界：研究指标来自项目组提供的N=50参考验证报告；当前便携演示默认使用显式Mock，不将Mock输出当作真实模型评测。", "orange")]
    doc.build(story)


def build_technical_pdf(path: Path):
    doc = CNDocTemplate(str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
                        topMargin=20 * mm, bottomMargin=20 * mm, title=f"{PROJECT}技术调研与推理效果说明", author=TEAM)
    s = cover_story(STYLES, "技术调研与Inference效果说明 / 版本1.0")
    s += [P("1 技术调研范围", "H1CN"),
          P("本说明将已有工作按测量形式、交互形态和评分机制分层比较，避免把“使用LLM”本身当作创新。比较对象包括自陈人格量表、静态SJT、结构化面试、Assessment Center、LLM自动生成测验、LLM-as-a-Judge以及面向岗位测量的多智能体系统。结论以项目代码、参考DOCX、项目组技术底稿和公开的一手论文/官方文档为依据。", "BodyCN"),
          table([
              ["方法", "交互/证据", "优点", "关键限制"],
              ["自陈量表（Big Five/HEXACO）", "固定条目、自我报告", "成本低、标准化成熟", "社会赞许、缺少情境行为证据；难观察过程"],
              ["静态SJT", "情境+选项/排序", "与工作绩效有实证关联；易大规模施测", "反应空间有限；难追问信息缺口和观察协作过程"],
              ["结构化面试", "问题—回答—评分锚点", "互动性与标准化兼顾", "评分者和面试官成本高；跨场景一致性受训练影响"],
              ["Assessment Center", "多练习、多评分者", "行为观察密度高", "组织成本、人员成本和周期较高"],
              ["LLM生成SJT", "模型生成题干/选项", "扩展题库快、覆盖领域广", "生成质量与心理测量质量不自动等价；需专家与样本验证"],
              ["LLM-as-a-Judge", "模型读文本后直接给分", "低成本、可处理开放文本", "位置、长度、自我增强和模型偏好等偏差；单次分数缺少不确定性"],
              ["MACST", "动态多角色自然语言对话 + 槽位证据", "覆盖控制、角色隔离、证据链、5样本分歧闸门、可本地降级", "仍受LLM偏差、样本量和场景迁移影响；需要更多外部验证"],
          ], [32 * mm, 43 * mm, 48 * mm, 47 * mm]),
          P("2 与已有LLM相关工作的差异", "H1CN"),
          P("Krumm等研究说明，ChatGPT可以快速生成SJT，但自动生成的测验仍需以模型拟合、信度、聚合效度和区分效度检验；因此MACST把生成/配置与施测、证据收集和验证分开，不把“模型写出了题目”当作测量成立。Zheng等对LLM-as-a-Judge的研究提醒，评委可能受回答位置、长度和自我增强等因素影响；MACST的5样本聚合和方差闸门只能降低一次性随机性，不能声称消除系统性偏差。LangGraph官方定位是长时、状态化Agent的编排运行时；本项目在其上增加测量蓝图和AgentView约束，这部分是任务层工程设计。", "BodyCN"),
          table([
              ["比较维度", "一般LLM聊天/单评委", "MACST实现", "可核验位置"],
              ["动态追问", "依赖模型自由发挥", "Director根据未覆盖槽位选择下一步", "slotTracker.service.ts / orchestrator.service.ts"],
              ["信息泄漏", "提示词内常混入全部上下文", "NPC视图不含rubric、user_progress、evaluation_notes", "agentView.service.ts + tests"],
              ["证据密度", "对话长但不一定覆盖能力", "每情境16槽位、8维度，记录slot状态", "seed.ts / slot-tracker.test.ts"],
              ["评分稳定性", "一次生成一个分数", "5次并行、去极值取均值、总方差闸门", "judge.agent.ts + judge-agent.test.ts"],
              ["失败处理", "失败后可能继续编造", "无效JSON不回退为评分；Mock明确标debug；高方差转人工", "judge.agent.ts / llm.service.ts"],
              ["可追溯", "通常只保留最终文本", "Message、AgentTraceEvent、覆盖和报告分开存储", "schema.prisma / persistence service"],
          ], [32 * mm, 44 * mm, 60 * mm, 34 * mm]),
          P("3 Inference机制与指标", "H1CN"),
          P("3.1 施测Inference（Administration Inference）", "H2CN"),
          P("输入是当前轮次、用户响应、情境黑板、NPC状态和槽位覆盖；输出是下一步角色/刺激/意图。Director只接收测量所需的摘要，优先选择unseen或insufficient槽位；每轮结束后记录probed/evidenced状态。此层评价重点不是“回答像不像人”，而是证据是否覆盖、角色边界是否保持、对话是否在有限轮次内完成。", "BodyCN"),
          P("3.2 评分Inference（Scoring Inference）", "H2CN"),
          P("设某维度5次Judge分数排序后为s(1)≤…≤s(5)，报告分数为：m=(s(2)+s(3)+s(4))/3；总分不确定性以5个总分的总体方差V衡量。源码将V≥80标记为unratable，并要求人工复核；这不是统计学显著性阈值，而是面向产品安全的工程门槛。", "BodyCN"),
          table([
              ["指标", "数值/状态", "证据类型", "含义"],
              ["Judge采样数", "5", "源码已实现", "评估单次模型随机性与评分分歧"],
              ["修剪均值", "保留中间3次", "源码已实现", "降低极端样本对报告的影响"],
              ["高方差闸门", "总分V≥80→unratable", "源码已实现", "停止把分歧伪装成确定结论"],
              ["参考研究Judge SD", "均值.134；范围.12—.15", "N=50报告", "真实模型试验中的稳定性摘要"],
              ["参考研究编码ICC/Kappa", ".82 / .79", "N=50报告", "两位编码者的行为标注一致性"],
              ["参考研究重测", "总分r=.81；维度均值r=.764", "20人、7日", "短期稳定性初步证据"],
              ["参考研究聚合效度", "与SJT总分r=.54，p<.001", "N=50报告", "与相近测量的中等关联"],
              ["工程回归", "6文件、44项测试通过", "本地构建/测试", "验证代码契约，不是受试者或模型样本数"],
          ], [34 * mm, 38 * mm, 45 * mm, 53 * mm]),
          callout("推理效果的证据边界：源码测试使用Mock/fixture验证控制逻辑；参考DOCX的N=50指标描述真实模型研究。两类证据不能相加，也不能把“44项测试通过”改写成“44个样本模型准确率”。", "orange"),
          P("4 失败模式、公平性与后续验证", "H1CN"),
          bullet("LLM偏差：长度、表达风格、位置和供应商变化可能影响评分；后续需做等义改写、角色顺序、语言风格和模型版本的敏感性测试。"),
          bullet("测量误差：承诺边界、下属赋能两个维度的内部一致性偏弱；应补充行为锚点、增加槽位并邀请独立专家复审。"),
          bullet("外部效度：当前参考研究N=50且以学生和HR相关人员为主，不能直接代表行业人群；应按岗位、行业、经验和地区扩样。"),
          bullet("高风险使用：报告只能作为训练反馈或研究辅助；涉及招聘、晋升等决策时必须有人类复核、申诉与数据治理。"),
          bullet("复现：锁定模型名、温度、提示词版本、场景seed、Node版本、时间戳和API配置；禁止把API Key或原始个人对话放入公开压缩包。"),
          P("5 来源与引用标注规则", "H1CN"),
          P("直接借鉴：参考DOCX中的4情境、8维度、16槽位逻辑和N=50验证结果；项目材料以“参考报告结果”标注，不声称重新计算。方法引用：ECD、关键事件法、SJT、LLM-as-a-Judge、CVR、ICC/Kappa、EFA等仅作为设计与分析依据。项目原创：当前源码中的5情境扩展、槽位运行时状态、AgentView白名单、5样本修剪均值/方差闸门、低信息响应门和可追溯trace的组合实现。部署来源：React/Node/Prisma/SQLite/LangGraph/DeepSeek兼容API及Windows Node运行时；不包含自研基础模型或GPU训练。", "BodyCN"),
          P("主要公开来源：Mislevy等ECD；McDaniel等SJT元分析；Arthur等Assessment Center元分析；Conway等结构化面试信度元分析；Zheng等LLM-as-a-Judge；Krumm等LLM生成SJT；Park等Generative Agents；LangGraph官方文档；Lawshe内容效度；Shrout与Fleiss ICC；AERA/APA/NCME测验标准。完整书目信息见项目文档第4节。", "BodyCN")]
    doc.build(s)


def load_font(size: int, bold=False):
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), size=size)


def wrap_cn(text: str, font, max_width: int, draw: ImageDraw.ImageDraw):
    lines = []
    current = ""
    for ch in text:
        test = current + ch
        if draw.textlength(test, font=font) <= max_width or not current:
            current = test
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def draw_video_slide(path: Path, index: int, title: str, subtitle: str, bullets: list[str], kind: str):
    W, H = 1280, 720
    img = Image.new("RGB", (W, H), (11, 18, 32))
    d = ImageDraw.Draw(img)
    # background grid and accent
    for x in range(0, W, 64):
        d.line((x, 0, x, H), fill=(18, 31, 52), width=1)
    for y in range(0, H, 64):
        d.line((0, y, W, y), fill=(18, 31, 52), width=1)
    d.ellipse((930, -180, 1420, 310), fill=(18, 47, 82))
    d.ellipse((-240, 520, 280, 1040), fill=(13, 46, 55))
    white = (242, 247, 255)
    muted = (165, 181, 206)
    cyan = (72, 209, 192)
    blue = (73, 146, 255)
    orange = (246, 166, 77)
    d.text((70, 46), "MACST  /  Multi-agent Competency Situational Test", font=load_font(20), fill=cyan)
    d.text((70, 105), title, font=load_font(46, True), fill=white)
    y = 176
    for line in wrap_cn(subtitle, load_font(22), 720, d):
        d.text((72, y), line, font=load_font(22), fill=muted)
        y += 34
    # visual on the right
    if kind == "flow":
        nodes = [(850, 210, "用户行为", blue), (1045, 210, "Director", cyan), (945, 355, "角色Agent", orange), (1090, 500, "Judge", (191, 122, 255))]
        for x, yy, label, col in nodes:
            d.rounded_rectangle((x - 90, yy - 34, x + 90, yy + 34), radius=14, fill=(22, 37, 62), outline=col, width=3)
            d.text((x - d.textlength(label, font=load_font(22, True)) / 2, yy - 14), label, font=load_font(22, True), fill=white)
        d.line((940, 210, 1045 - 90, 210), fill=blue, width=4)
        d.line((1045, 244, 945, 321), fill=cyan, width=4)
        d.line((1015, 389, 1090, 466), fill=orange, width=4)
        d.line((945, 389, 850, 520), fill=(80, 100, 130), width=2)
        d.text((790, 550), "证据  →  维度  →  反馈", font=load_font(21), fill=muted)
    elif kind == "slots":
        d.text((800, 205), "8 dimensions × 2 slots", font=load_font(25, True), fill=white)
        labels = ["信息辨识", "交付拆解", "备选方案", "承诺边界", "向上对齐", "横向协商", "下属赋能", "压力表达"]
        for i, label in enumerate(labels):
            xx = 800 + (i % 2) * 210
            yy = 260 + (i // 2) * 64
            col = cyan if i in (0, 1, 4, 6) else (84, 107, 138)
            d.rounded_rectangle((xx, yy, xx + 180, yy + 39), radius=8, fill=(22, 37, 62), outline=col, width=2)
            d.text((xx + 12, yy + 8), label, font=load_font(17), fill=white)
        d.text((800, 540), "unseen → probed → evidenced", font=load_font(19), fill=cyan)
    elif kind == "judge":
        for i in range(5):
            xx = 815 + (i % 3) * 135
            yy = 240 + (i // 3) * 110
            d.rounded_rectangle((xx, yy, xx + 110, yy + 62), radius=10, fill=(22, 37, 62), outline=blue if i != 4 else orange, width=3)
            d.text((xx + 22, yy + 16), f"Judge {i + 1}", font=load_font(17, True), fill=white)
        d.line((850, 465, 1120, 465), fill=cyan, width=4)
        d.text((835, 495), "trimmed mean  +  variance gate", font=load_font(18), fill=cyan)
        d.text((920, 550), "V ≥ 80  →  人工复核", font=load_font(19, True), fill=orange)
    elif kind == "report":
        d.rounded_rectangle((795, 200, 1165, 548), radius=18, fill=(20, 32, 54), outline=(68, 95, 130), width=2)
        d.text((830, 230), "行为观察报告", font=load_font(25, True), fill=white)
        for i, (label, value, col) in enumerate([("信息辨识", 76, cyan), ("交付拆解", 68, blue), ("横向协商", 83, orange), ("压力表达", 61, (190, 128, 255))]):
            yy = 300 + i * 52
            d.text((830, yy), label, font=load_font(17), fill=muted)
            d.rounded_rectangle((940, yy + 3, 1115, yy + 22), radius=9, fill=(42, 56, 78))
            d.rounded_rectangle((940, yy + 3, 940 + int(value * 1.75), yy + 22), radius=9, fill=col)
    else:
        d.rounded_rectangle((820, 225, 1140, 505), radius=20, fill=(20, 32, 54), outline=cyan, width=2)
        d.text((872, 270), "普通CPU", font=load_font(28, True), fill=white)
        d.text((872, 330), "+ SQLite", font=load_font(24), fill=cyan)
        d.text((872, 380), "+ DeepSeek API", font=load_font(24), fill=blue)
        d.text((872, 430), "+ Mock fallback", font=load_font(24), fill=orange)
    y = 300
    for b in bullets:
        for line in wrap_cn("· " + b, load_font(24), 650, d):
            d.text((76, y), line, font=load_font(24), fill=white)
            y += 38
        y += 12
    d.text((70, 670), f"{index:02d}  /  三个诸葛亮 · 南京师范大学", font=load_font(16), fill=(105, 126, 153))
    img.save(path)


def make_video(path: Path):
    slides = [
        (5, "让一次对话成为可观察的行为证据", "MACST：面向职场情境的多智能体胜任力测验", ["不是一次性问答，而是连续的情境行为观察"], "flow"),
        (8, "为什么需要动态情境？", "岗位能力往往出现在澄清、协商、交付和复盘的过程里", ["静态题目能测选择，难测行为链", "MACST把信息缺口变成下一轮探测"], "flow"),
        (10, "一场测验：用户与三个角色协作", "领导、同事、客户/下属提供不同刺激；用户必须在有限轮次中行动", ["角色各自拥有受限记忆", "Director根据证据缺口安排下一步"], "flow"),
        (10, "8个维度，16个证据槽位", "把测量蓝图落到运行时：unseen → probed → evidenced → insufficient", ["信息辨识、交付拆解、备选方案、承诺边界", "向上对齐、横向协商、下属赋能、压力表达"], "slots"),
        (10, "信息隔离：让角色像角色一样推理", "NPC看不到rubric、用户进度和其他角色记忆；Judge在最后读取完整证据", ["减少提示泄漏与角色串台", "每个节点只接收完成任务所需的视图"], "flow"),
        (12, "评分不是一个黑箱分数", "5次并行Judge + 去极值修剪均值 + 方差闸门", ["总分方差达到80：停止报告，转人工复核", "把模型分歧显式呈现给使用者"], "judge"),
        (12, "参考研究：推理与测量指标", "项目组提供的N=50验证报告给出初步证据", ["ICC .82；Kappa .79；7日重测总分 r=.81", "Judge维度SD均值 .134；与SJT总分 r=.54", "当前Mock演示与研究指标严格分开"], "report"),
        (9, "从对话回到反馈", "原始行为 → 证据槽位 → 能力维度 → 可行动建议", ["报告保留trace，支持研究复核和人工纠错", "不把结果用于单一招聘、晋升或解聘决策"], "report"),
        (8, "普通CPU也能运行", "React + Node + SQLite；真实模型接API，无Key时显式Mock", ["Windows便携包：127.0.0.1:17863", "源码5情境；便携版为2情境旧快照，材料已声明"], "deploy"),
        (6, "MACST：让AI推理更可解释、更可复核", "面向教学、培训与测量研究的职场行为观察原型", ["三个诸葛亮 · 南京师范大学"], "flow"),
    ]
    frames_dir = WORK_DIR / "video_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    concat = frames_dir / "slides.txt"
    lines = []
    for i, (_, title, subtitle, bullets, kind) in enumerate(slides):
        frame = frames_dir / f"slide_{i:02d}.png"
        draw_video_slide(frame, i + 1, title, subtitle, bullets, kind)
        lines.append(f"file '{frame.as_posix()}'")
        lines.append(f"duration {slides[i][0]}")
    # concat demuxer requires the last file to be repeated for the final duration to apply.
    last = frames_dir / f"slide_{len(slides) - 1:02d}.png"
    lines.append(f"file '{last.as_posix()}'")
    concat.write_text("\n".join(lines), encoding="utf-8")
    ffmpeg = next((p for p in FFMPEG_CANDIDATES if p.exists()), None)
    if ffmpeg is None:
        raise FileNotFoundError("未找到ffmpeg.exe，无法生成项目视频")
    # The bundled Jianying ffmpeg build has the native MPEG-4 encoder but not
    # libx264, so use a broadly compatible MP4 codec and keep the result well
    # below the competition's 200 MB limit.
    cmd = [str(ffmpeg), "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
           "-vf", "format=yuv420p", "-c:v", "mpeg4", "-q:v", "5", "-r", "24",
           "-movflags", "+faststart", str(path)]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def write_aux_readme(path: Path):
    text = f"""# {PROJECT}：其他辅助材料\n\n团队：{TEAM}\n依托单位：南京师范大学\n\n## 包含内容\n\n- `source/`：当前项目源码、提示词、数据库schema/seed、测试和文档。\n- `portable-demo/`：Windows便携运行包，默认Mock模式；可双击`START.bat`启动。\n- `references/`：项目组提供的多智能体岗位胜任力情境测验研究报告、赛事模板及技术调研底稿。\n- `submission/`：项目文档、技术调研说明、参赛简介和视频分镜。\n- `verification/`：构建、测试、接口与文件大小核验记录。\n\n## 重要版本说明\n\n当前源码目录提供5个情境；便携演示包是较早快照，接口实测提供2个情境。两者共享核心编排和评分机制，数量差异已在参赛项目文档中明确说明。\n\n## 运行与复现\n\n1. 源码：安装Node依赖后运行仓库README中的本地命令；默认`USE_MOCK_LLM=true`。\n2. 便携版：Windows下双击`portable-demo/START.bat`，浏览器访问`http://127.0.0.1:17863`。\n3. 真实模型：复制配置模板并填写DeepSeek兼容API；不要把API Key写入提交包。\n4. 测试：`npm test`；构建：`npm run backend:build`、`npm run frontend:build`。\n\n## 数据与伦理\n\n参考研究报告的N=50原始对话、个人信息和逐条评分未随包发布；提交包只包含脱敏的设计、统计结果和可运行代码。系统仅用于教学、培训与测量研究，不应作为单一人事决策依据。\n"""
    path.write_text(text, encoding="utf-8")


def copy_tree_filtered(src: Path, dst: Path, exclude_names=None, exclude_suffixes=None):
    exclude_names = set(exclude_names or [])
    exclude_suffixes = tuple(exclude_suffixes or ())
    if not src.exists():
        return
    if src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return
    for item in src.rglob("*"):
        rel = item.relative_to(src)
        if any(part in exclude_names for part in rel.parts):
            continue
        if item.is_file() and item.suffix.lower() in exclude_suffixes:
            continue
        target = dst / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def make_aux_zip(zip_path: Path, generated: dict[str, Path]):
    staging = WORK_DIR / "aux-staging"
    if staging.exists():
        def _remove_readonly(func, file_path, _exc):
            os.chmod(file_path, stat.S_IWRITE)
            func(file_path)
        shutil.rmtree(staging, onerror=_remove_readonly)
    staging.mkdir(parents=True)
    write_aux_readme(staging / "README_辅助材料.md")
    # Source: keep executable-relevant code and tests, omit dependency caches and databases.
    for rel in ["README.md", "package.json", "package-lock.json", "backend", "frontend", "scripts", "docs"]:
        src = PROJECT_ROOT / rel
        if src.is_dir():
            copy_tree_filtered(src, staging / "source" / rel,
                               exclude_names={"node_modules", ".git", "dist", "logs", ".codex-work", "dev.db"},
                               exclude_suffixes={".db", ".sqlite", ".log"})
        elif src.exists():
            copy_tree_filtered(src, staging / "source" / rel)
    # Portable demo is included as an executable artifact. Keep the seeded DB because it contains no participant data.
    portable = PROJECT_ROOT / "portable-release" / "workplace-survival-capsule-portable"
    copy_tree_filtered(portable, staging / "portable-demo",
                       exclude_names={".codex-work", "logs", "node_modules", ".git"},
                       exclude_suffixes={".log"})
    # Project-provided reference files and the technical note.
    refs = staging / "references"
    refs.mkdir(parents=True, exist_ok=True)
    ref_files = [
        (Path(r"C:\Users\Administrator\Documents\xwechat_files\wxid_y9z0ywivmsxe12_4436\msg\file\2026-08\多智能体岗位胜任力情境测验的构建与验证.docx"), refs / "多智能体岗位胜任力情境测验的构建与验证.docx"),
        (Path(r"C:\Users\Administrator\Documents\xwechat_files\wxid_y9z0ywivmsxe12_4436\msg\file\2026-08\附件2：第八届中国研究生人工智能创新大赛项目文档模版.pdf"), refs / "附件2_第八届中国研究生人工智能创新大赛项目文档模版.pdf"),
        (PROJECT_ROOT / "docs" / "competition-editing" / "分区赛报告" / "技术调研与推理效果说明.md", refs / "技术调研与推理效果说明.md"),
    ]
    for src, dst in ref_files:
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    sub = staging / "submission"
    sub.mkdir(parents=True, exist_ok=True)
    for label, src in generated.items():
        if src.exists():
            shutil.copy2(src, sub / src.name)
    video_script = sub / "项目视频脚本与分镜.md"
    video_script.write_text("""# 项目视频脚本与分镜\n\n总时长约80秒，无外部音频；画面以中文信息图呈现核心流程。\n\n1. 让一次对话成为可观察的行为证据（5秒）\n2. 为什么需要动态情境（8秒）\n3. 用户与三个角色协作（10秒）\n4. 8个维度、16个槽位（10秒）\n5. 信息隔离（10秒）\n6. 5次Judge与方差闸门（12秒）\n7. 参考研究指标（12秒）\n8. 从对话回到反馈（9秒）\n9. 普通CPU运行（8秒）\n10. 结语（6秒）\n\n画面中的N=50、ICC=.82、Kappa=.79、r=.81、SD=.134、r=.54均来自项目组提供的参考验证报告，并在项目文档中标注证据边界。\n""", encoding="utf-8")
    ver = staging / "verification" / "材料核验记录.md"
    ver.parent.mkdir(parents=True, exist_ok=True)
    ver.write_text("""# 材料核验记录\n\n- 源码测试：`npm test`，6个Vitest文件、44项测试通过。\n- 后端构建：`npm run backend:build`，通过。\n- 前端构建：`npm run frontend:build`，通过。\n- 便携版：`GET http://127.0.0.1:17863/health` 返回200；源码当前5情境，便携快照2情境。\n- 研究指标：来自N=50参考DOCX，不等同于当前Mock演示。\n- 数据隐私：未打包参考研究原始参与者对话。\n- 文件约束：视频与辅助压缩包由构建脚本生成后另行核验大小。\n""", encoding="utf-8")
    # Manifest inside the staging folder, then archive everything.
    manifest = []
    for file in sorted(staging.rglob("*")):
        if file.is_file():
            manifest.append({"path": str(file.relative_to(staging)).replace("\\", "/"), "bytes": file.stat().st_size, "sha256": sha256(file)})
    (staging / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file in sorted(staging.rglob("*")):
            if file.is_file():
                zf.write(file, Path("MACST其他辅助材料") / file.relative_to(staging))


def write_root_manifest(files: list[Path]):
    rows = []
    for file in files:
        rows.append({"name": file.name, "bytes": file.stat().st_size, "sha256": sha256(file)})
    (OUTPUT_DIR / "材料文件校验.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    intro_pdf = OUTPUT_DIR / f"{SAFE_PREFIX} 参赛作品简介.pdf"
    project_pdf = OUTPUT_DIR / f"{SAFE_PREFIX} 项目文档.pdf"
    technical_pdf = OUTPUT_DIR / f"{SAFE_PREFIX} 技术调研与推理效果说明.pdf"
    video = OUTPUT_DIR / f"{SAFE_PREFIX}_项目视频.mp4"
    other_zip = OUTPUT_DIR / f"{SAFE_PREFIX}_其他.zip"
    build_intro_pdf(intro_pdf)
    build_project_pdf(project_pdf)
    build_technical_pdf(technical_pdf)
    make_video(video)
    make_aux_zip(other_zip, {"简介": intro_pdf, "项目文档": project_pdf, "技术说明": technical_pdf, "视频": video})
    write_root_manifest([intro_pdf, project_pdf, technical_pdf, video, other_zip])
    print(json.dumps({
        "output": str(OUTPUT_DIR),
        "files": [{"name": p.name, "bytes": p.stat().st_size, "sha256": sha256(p)} for p in [intro_pdf, project_pdf, technical_pdf, video, other_zip]],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
