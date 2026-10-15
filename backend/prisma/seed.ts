import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { createInitialBlackboard } from "../src/services/blackboard.service";

const prisma = new PrismaClient();

const promptFiles = [
  ["director", "Director Agent", "director.prompt.txt"],
  ["behavior-detector", "BehaviorDetector Agent", "behavior-detector.prompt.txt"],
  ["stage-director", "StageDirector Agent", "stage-director.prompt.txt"],
  ["leader", "Leader NPC", "leader.prompt.txt"],
  ["coworker", "Coworker NPC", "coworker.prompt.txt"],
  ["client", "Client NPC", "client.prompt.txt"],
  ["group-discussion", "Group Discussion Agent", "group-discussion.prompt.txt"],
  ["judge", "Judge Agent", "judge.prompt.txt"]
] as const;

const taskCard = `下午 1:30，距 4 点汇报还有两个半小时。Q3 方案的三页数据可视化设计稿还没出来，数据齐了、框架有了，唯独没法上会。

陈总 4 点要向 CEO 汇报，他需要每个数字有出处、每件事有负责人。苏姐那边有设计资源但排满了，小秋能画但没人给过她标准。

你只有 120 分钟。想清楚先动哪一步、边界划在哪、风险怎么说。`;

const restaurantTaskCard = `今晚 8 号桌是重要客人宴请，第二道菜出了问题，菜已经撤下，场面还没乱。

刘总在等一个说法，小林在后巷站着，江师傅在厨房不吭声。

你是值班经理，这一晚上怎么收场，你来定。`;

const promoOutageTaskCard = `零点大促开始 20 分钟，支付通道开始大面积超时，工单在群里刷屏。系统还在降级运行，每分钟都有用户在流失。

王总盯着大屏要判断，小郑被用户堵着骂，老周在排查但没人告诉他业务影响面。

先恢复什么、对外怎么说、什么时候能给出准话——你来定。`;

const handoverReviewTaskCard = `你接手这个项目组已经第三周。上一任留下了一堆口头承诺和一张没人维护的看板，三天后是季度评审，梁总要你给出能上会的状态。

老郑在这个组七年，对你还是一句话不多说；小楠接了一堆说不清的活，不敢来问你。

三天时间：先确认什么、压什么、放什么，你来定。`;

const scenarioADesc = "下午 4 点陈总要向 CEO 汇报，三页数据可视化设计稿还没出来。你需要在汇报、协作资源和执行边界之间推动可汇报方案。";
const scenarioBDesc = "8 号桌重要客人宴请，第二道菜出了问题。你需要处理现场影响、员工纠错、后厨协同和后续风险。";
const scenarioCDesc = "大促刚开始支付通道超时，用户、客服、研发三方压力同时压过来。你需要先恢复现场、稳住对外口径，再谈根因与复盘。";
const scenarioDDesc = "空降第三周，三天后季度评审。你需要在一堆口头承诺和沉默的老员工之间，收敛出能上会的真实状态。";

const scenarioAOpening = {
  speaker: "陈总",
  role: "VP",
  content: "下午4点我要向CEO汇报Q3方案。你先说说：目前哪些数据是确认过的、哪些是assumption？设计那三页涉及苏姐那边资源和小秋执行，边界谁来定？"
};

const scenarioBOpening = {
  speaker: "刘总",
  role: "8号桌客人",
  content: "（沉默片刻）菜我已经不想说了。那个学徒在后巷站着，厨房那边也等着你说法。你告诉我，今晚这件事你打算怎么办。"
};

const scenarioCOpening = {
  speaker: "王总",
  role: "运营总监",
  content: "支付超时 20 分钟了，工单群每分钟刷一屏。你告诉我：先恢复什么、对外怎么说、什么时候能给用户一个准话？"
};

const scenarioDOpening = {
  speaker: "梁总",
  role: "事业部VP",
  content: "三天后季度评审，我得给上面一个交代。你接手三周了——组里哪些是实数、哪些是虚的，你打算怎么收？"
};

const scenarioEOpening = {
  speaker: "许主管",
  role: "部门主管",
  content: "周一例会刚开完，方姐那边又催了。报告周五要交，数据口径你自己去跟大周对齐——他要是卡你，回来找我。你先说说你打算怎么干。"
};

const firstWeekTaskCard = `你入职运营组第一周，主管把跨部门需求交给你：周五前给业务方一份渠道复盘报告，数据要数据组的大周出。

你刚来，系统权限只开了一半，数据口径没人跟你完整讲过。周一早上，三件事同时压过来：主管说周五必须交，大周说排期满了要插队得讲条件，业务方的方姐这周就要结果，还补了一句"新人到底行不行"。

三天时间，一个新人，没有退路。先问什么、守什么边界、怎么拿到数据，你来定。`;

const scenarioEDesc = "入职第一周接到跨部门需求,权限不全、口径不明、排期被拒。你需要在不熟的环境里守住边界、拿到数据支持、如期交付。";

async function main() {
  await prisma.scenario.upsert({
    where: { id: "project_demo_crisis" },
    create: {
      id: "project_demo_crisis",
      title: "周三下午的会议室",
      description: scenarioADesc,
      backgroundForUser: taskCard,
      openingMessageJson: JSON.stringify(scenarioAOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "project_demo_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    },
    update: {
      title: "周三下午的会议室",
      description: scenarioADesc,
      backgroundForUser: taskCard,
      openingMessageJson: JSON.stringify(scenarioAOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "project_demo_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    }
  });

  await prisma.scenario.upsert({
    where: { id: "coffee_shop_complaint" },
    create: {
      id: "coffee_shop_complaint",
      title: "8号桌的客人",
      description: scenarioBDesc,
      backgroundForUser: restaurantTaskCard,
      openingMessageJson: JSON.stringify(scenarioBOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "coffee_shop_complaint")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    },
    update: {
      title: "8号桌的客人",
      description: scenarioBDesc,
      backgroundForUser: restaurantTaskCard,
      openingMessageJson: JSON.stringify(scenarioBOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "coffee_shop_complaint")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    }
  });

  await prisma.scenario.upsert({
    where: { id: "promo_outage_crisis" },
    create: {
      id: "promo_outage_crisis",
      title: "零点大促的故障工单",
      description: scenarioCDesc,
      backgroundForUser: promoOutageTaskCard,
      openingMessageJson: JSON.stringify(scenarioCOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "promo_outage_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    },
    update: {
      title: "零点大促的故障工单",
      description: scenarioCDesc,
      backgroundForUser: promoOutageTaskCard,
      openingMessageJson: JSON.stringify(scenarioCOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "promo_outage_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    }
  });

  await prisma.scenario.upsert({
    where: { id: "handover_review_crisis" },
    create: {
      id: "handover_review_crisis",
      title: "接手的第三周",
      description: scenarioDDesc,
      backgroundForUser: handoverReviewTaskCard,
      openingMessageJson: JSON.stringify(scenarioDOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "handover_review_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    },
    update: {
      title: "接手的第三周",
      description: scenarioDDesc,
      backgroundForUser: handoverReviewTaskCard,
      openingMessageJson: JSON.stringify(scenarioDOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "handover_review_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    }
  });

  await prisma.scenario.upsert({
    where: { id: "first_week_assignment" },
    create: {
      id: "first_week_assignment",
      title: "入职第一周的需求对接",
      description: scenarioEDesc,
      backgroundForUser: firstWeekTaskCard,
      openingMessageJson: JSON.stringify(scenarioEOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "first_week_assignment")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    },
    update: {
      title: "入职第一周的需求对接",
      description: scenarioEDesc,
      backgroundForUser: firstWeekTaskCard,
      openingMessageJson: JSON.stringify(scenarioEOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "first_week_assignment")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    }
  });

  for (const [key, name, fileName] of promptFiles) {
    const content = fs.readFileSync(path.resolve(__dirname, "../src/prompts", fileName), "utf-8");
    await prisma.promptTemplate.upsert({
      where: { key },
      create: { key, name, content },
      update: { name, content, active: true }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
