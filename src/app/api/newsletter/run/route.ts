import { RunInputSchema, type AgentState } from "@/lib/agent/types";
import { newsletterGraph } from "@/lib/agent/graph";

export const runtime="nodejs";
const encode=(event:string,data:unknown)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
function streamGraph(input:AgentState, runId:string, resume?:unknown) {
  const encoder=new TextEncoder();
  return new ReadableStream({ async start(controller) {
    const send=(event:string,data:unknown)=>controller.enqueue(encoder.encode(encode(event,data)));
    try {
      send("run",{runId});
      const config={configurable:{thread_id:runId}};
      const iterable=resume===undefined ? await newsletterGraph.stream(input,config,{streamMode:"updates"}) : await newsletterGraph.stream(resume as never,config,{streamMode:"updates"});
      for await (const update of iterable as AsyncIterable<Record<string,Partial<AgentState>|unknown>>) {
        if("__interrupt__" in update){ send("approval",(update as {__interrupt__:unknown}).__interrupt__); continue; }
        const [node,payload]=Object.entries(update)[0]||[]; if(!node) continue;
        const state=payload as Partial<AgentState>; send("update",{node,events:state.events||[],status:state.status,critique:state.critique,finalNewsletter:state.finalNewsletter,html:state.html,output:state.output,errors:state.errors||[]});
      }
      const final=await newsletterGraph.getState(config); send("done",final.values); controller.close();
    } catch(error) { send("error",{message:error instanceof Error?error.message:"Agent execution failed"}); controller.close(); }
  }});
}
export async function POST(request:Request) {
  const body=RunInputSchema.safeParse(await request.json()); if(!body.success) return Response.json({error:body.error.flatten()}, {status:400});
  const runId=crypto.randomUUID(); const initial:AgentState={runId,goal:body.data.goal,mode:body.data.mode,status:"running",searchResults:[],selected:[],articles:[],summaries:[],events:[],errors:[],retried:false,revised:false};
  return new Response(streamGraph(initial,runId),{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","Connection":"keep-alive"}});
}
