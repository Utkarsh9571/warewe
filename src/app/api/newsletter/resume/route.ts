import { Command } from "@langchain/langgraph";
import { newsletterGraph } from "@/lib/agent/graph";
import type { AgentState } from "@/lib/agent/types";
export const runtime="nodejs";
const encode=(event:string,data:unknown)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
export async function POST(request:Request) {
 const body=await request.json() as {runId?:string;approved?:boolean}; if(!body.runId||typeof body.approved!=="boolean") return Response.json({error:"runId and approved are required"},{status:400});
 const encoder=new TextEncoder(); const stream=new ReadableStream({async start(controller){const send=(e:string,d:unknown)=>controller.enqueue(encoder.encode(encode(e,d)));try{const config={configurable:{thread_id:body.runId!}};const iterable=await newsletterGraph.stream(new Command({resume:{approved:body.approved}}),config,{streamMode:"updates"});for await(const update of iterable as AsyncIterable<Record<string,Partial<AgentState>|unknown>>){const [node,payload]=Object.entries(update)[0]||[];if(!node)continue;const s=payload as Partial<AgentState>;send("update",{node,events:s.events||[],status:s.status,critique:s.critique,finalNewsletter:s.finalNewsletter,html:s.html,output:s.output,errors:s.errors||[]});}const final=await newsletterGraph.getState(config);send("done",final.values);controller.close();}catch(error){send("error",{message:error instanceof Error?error.message:"Resume failed"});controller.close();}}});
 return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","Connection":"keep-alive"}});
}
