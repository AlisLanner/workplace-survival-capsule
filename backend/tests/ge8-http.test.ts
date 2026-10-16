import {createServer,type Server,type RequestListener} from "node:http";
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {callDeepSeek} from "../src/services/llm.service";
let server:Server;
describe("real HTTP failure boundary without external requests",()=>{
  beforeEach(()=>{vi.stubEnv("DEEPSEEK_API_KEY","synthetic-test-only");vi.stubEnv("USE_MOCK_LLM","true");});
  afterEach(async()=>{vi.unstubAllEnvs();server?.closeAllConnections();if(server?.listening)await new Promise<void>(r=>server.close(()=>r()));});
  async function endpoint(handler:RequestListener){server=createServer(handler);await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));return `http://127.0.0.1:${(server.address() as any).port}`;}
  it("bounds actual 429 responses at two attempts without mock fallback",async()=>{
    let calls=0;const baseUrl=await endpoint((_req:any,res:any)=>{calls++;res.writeHead(429);res.end('{"error":"rate limited synthetic"}');});
    await expect(callDeepSeek({systemPrompt:"JSON",userPrompt:"test",baseUrl,mockMode:false,allowMockFallback:false,maxAttempts:2,timeoutMs:1000})).rejects.toThrow("429");expect(calls).toBe(2);
  });
  it("aborts a stalled HTTP request within the frozen timeout",async()=>{
    let calls=0;const baseUrl=await endpoint(()=>{calls++;});const started=Date.now();
    await expect(callDeepSeek({systemPrompt:"JSON",userPrompt:"test",baseUrl,mockMode:false,allowMockFallback:false,maxAttempts:1,timeoutMs:150})).rejects.toThrow();expect(calls).toBe(1);expect(Date.now()-started).toBeLessThan(2000);
  });
});
