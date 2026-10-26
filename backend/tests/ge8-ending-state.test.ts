import { beforeEach, expect, it, vi } from "vitest";
const memory=vi.hoisted(()=>({session:{} as any,snapshot:{} as any,messages:[] as any[],sequence:[] as string[]}));
vi.mock("../src/db/prisma",()=>{
  const db:any={
    assessmentSession:{
      findUniqueOrThrow:async()=>({...memory.session,messages:[...memory.messages],scenario:{}}),
      updateMany:async({where,data}:any)=>{
        if(Object.entries(where).some(([k,v])=>memory.session[k]!==v))return {count:0};
        for(const [k,v] of Object.entries(data))memory.session[k]=k==="scoringAttempts"?memory.session[k]+(v as any).increment:v;
        return {count:1};
      },
      update:async({data}:any)=>Object.assign(memory.session,data)
    },
    message:{create:async({data}:any)=>{const m={id:`m${memory.messages.length}`,createdAt:new Date(),...data};memory.messages.push(m);return m;}},
    agentGroupDiscussion:{create:async()=>({})},
    agentTraceEvent:{create:async({data}:any)=>({id:"trace",createdAt:new Date(),...data})},
    $transaction:async(fn:any)=>fn(db)
  };
  return {prisma:db};
});
vi.mock("../src/assessment/runtime",()=>({readSnapshot:()=>memory.snapshot}));
vi.mock("../src/assessment/agents",()=>({canonicalReply:vi.fn(),npc:vi.fn(),guard:vi.fn(async()=>({no_change:true,issues:[]})),director:vi.fn(async()=>{memory.sequence.push("director");return {slot_evidence:[],should_finish:false};})}));
vi.mock("../src/assessment/judge",()=>({judge:vi.fn(async()=>{memory.sequence.push("judge-call");return {report_status:"debug",mock_generated:true,total_score:null};})}));
import {runGe8} from "../src/assessment/session";
import {definitions} from "../src/assessment/definitions";
import {initialState} from "../src/assessment/coverage";
import {npc, director} from "../src/assessment/agents";
import {judge} from "../src/assessment/judge";

beforeEach(()=>{
  vi.clearAllMocks();memory.sequence=[];
  const d=structuredClone(definitions[0]),state=initialState(d);state.round=14;
  memory.snapshot={definition:d,runtime:{group_chat_enabled:true,group_chat_rounds:[]}};
  memory.session={id:"fixture",status:"running",round:14,turnLockId:null,scoringRunId:null,scoringAttempts:0,blackboardState:JSON.stringify(state),assessmentSnapshotJson:"fixture"};
  memory.messages=[{id:"q14",senderType:"agent",senderName:"角色",content:"你准备如何处理？",roundIndex:14}];
});

function events(){return {onSpeaker:vi.fn(),onToken:vi.fn(),onDone:vi.fn(),onError:vi.fn(),onReportProgress:(p:any)=>memory.sequence.push(`progress:${p.stage}:${p.percent}`),onJudging:()=>memory.sequence.push("judging")};}
it("announces report preparation before the potentially slow final extraction and sends no NPC response",async()=>{
  const e=events(),result=await runGe8("fixture","我先核对事实，再明确安排。",e);
  expect(memory.sequence).toEqual(["progress:preparing:2","director","judging","judge-call","progress:done:100"]);
  expect(npc).not.toHaveBeenCalled();expect(e.onSpeaker).not.toHaveBeenCalled();expect(e.onToken).not.toHaveBeenCalled();
  expect(memory.messages.filter(m=>m.senderType==="user")).toHaveLength(1);
  expect(memory.messages.at(-1).roundIndex).toBe(15);
  expect(memory.session.status).toBe("finished");expect(memory.session.scoringAttempts).toBe(1);
  expect(result.finished).toBe(true);
});
it("resuming a saved final answer keeps the same round, message and one scoring batch",async()=>{
  memory.session.round=15;const state=JSON.parse(memory.session.blackboardState);state.round=15;memory.session.blackboardState=JSON.stringify(state);
  memory.messages.push({id:"saved",senderType:"user",senderName:"候选人",content:"已保存的最后回应",roundIndex:15});
  await runGe8("fixture","已保存的最后回应",events());
  expect(memory.messages.filter(m=>m.senderType==="user")).toHaveLength(1);
  expect(memory.session.round).toBe(15);expect(judge).toHaveBeenCalledTimes(1);
  expect(memory.sequence[0]).toBe("progress:preparing:2");
});
it("a nonfinal answer keeps normal dialogue status and does not start scoring",async()=>{
  memory.session.round=3;const state=JSON.parse(memory.session.blackboardState);state.round=3;memory.session.blackboardState=JSON.stringify(state);
  memory.messages[0].roundIndex=3;
  vi.mocked(npc).mockResolvedValueOnce({speaker:"苏姐",role:"同级协作方",content:"我这组已经排满。你准备怎么协调？"});
  const result=await runGe8("fixture","我先核对排期，再和你确认协作。",events());
  expect(result.finished).toBe(false);expect(memory.session.round).toBe(4);
  expect(memory.sequence).toEqual(["director"]);expect(judge).not.toHaveBeenCalled();
});
