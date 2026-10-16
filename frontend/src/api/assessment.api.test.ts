import { describe,expect,it } from "vitest";
import { normalizeReport } from "./assessment.api";
describe("versioned report API boundary",()=>{
  const make=()=>({assessment_version:"ge8-test",schema_version:"ge8/1",total_score:null,radar_chart_data:[],dimension_scores:{},sampling_stats:{variance:null,valid_sample_count:5},dimension_results:Array.from({length:8},(_,i)=>({id:`GE0${i+1}`,name:`冻结名称${i}`,score:null,status:"insufficient",slot_results:[]}))});
  it("preserves null, frozen names, sampling metadata and an absent radar",()=>{const r=normalizeReport(make());expect(r.total_score).toBeNull();expect(r.sampling_stats?.variance).toBeNull();expect(r.dimension_results?.[0].name).toBe("冻结名称0");expect(r.radar_chart_data).toEqual([]);expect((r.sampling_stats as any).valid_sample_count).toBe(5);});
  it("blocks unknown schemas rather than reinterpreting as legacy",()=>expect(()=>normalizeReport({...make(),schema_version:"future"})).toThrow());
  it("blocks zero-filled missing statuses and duplicate dimensions",()=>{const r=make();(r.dimension_results[0] as any).score=0;expect(()=>normalizeReport(r)).toThrow();const dup=make();dup.dimension_results[1].id=dup.dimension_results[0].id;expect(()=>normalizeReport(dup)).toThrow();});
  it("keeps original legacy labels without replacing them with new names",()=>expect(normalizeReport({dimension_scores:{信息辨别:10},total_score:10}).dimension_scores).toEqual({信息辨别:10}));
});
