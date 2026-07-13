import "server-only";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { AgentAnnotation } from "./state";
import { approvalNode, broadenNode, collectNode, critiqueNode, draftNode, planNode, reviseNode, searchNode, selectNode, sendNode, summarizeNode } from "./nodes";

const graph=new StateGraph(AgentAnnotation)
 .addNode("plan",planNode).addNode("search",searchNode).addNode("select",selectNode).addNode("collect",collectNode).addNode("summarize",summarizeNode).addNode("broaden",broadenNode).addNode("draft",draftNode).addNode("critique",critiqueNode).addNode("revise",reviseNode).addNode("approval",approvalNode).addNode("send",sendNode)
 .addEdge(START,"plan").addConditionalEdges("plan",s=>s.status==="failed"?END:"search").addConditionalEdges("search",s=>s.status==="failed"?END:"select").addEdge("select","collect").addEdge("collect","summarize")
 .addConditionalEdges("summarize",s=>s.summaries.length>=5?"draft":s.retried?END:"broaden").addEdge("broaden","search").addConditionalEdges("draft",s=>s.status==="failed"?END:"critique").addConditionalEdges("critique",s=>s.critique?.decision==="revise"&&!s.revised?"revise":"approval").addEdge("revise","approval").addConditionalEdges("approval",s=>s.status==="cancelled"?END:"send").addEdge("send",END);
export const checkpointer=new MemorySaver();
export const newsletterGraph=graph.compile({checkpointer});
