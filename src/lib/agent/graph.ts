import "server-only";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { AgentAnnotation } from "./state";
import {
  approvalNode,
  broadenNode,
  collectNode,
  critiqueNode,
  draftNode,
  planNode,
  reviseNode,
  searchNode,
  selectNode,
  sendNode,
  summarizeNode,
} from "./nodes";

const graph = new StateGraph(AgentAnnotation)
  .addNode("plan_node", planNode)
  .addNode("search_node", searchNode)
  .addNode("select_node", selectNode)
  .addNode("collect_node", collectNode)
  .addNode("summarize_node", summarizeNode)
  .addNode("broaden_node", broadenNode)
  .addNode("draft_node", draftNode)
  .addNode("critique_node", critiqueNode)
  .addNode("revise_node", reviseNode)
  .addNode("approval_node", approvalNode)
  .addNode("send_node", sendNode)
  // Edges
  .addEdge(START, "plan_node")
  .addConditionalEdges("plan_node", (s) => (s.status === "failed" ? END : "search_node"))
  .addConditionalEdges("search_node", (s) =>
    s.status === "failed" ? END : "select_node"
  )
  .addEdge("select_node", "collect_node")
  .addEdge("collect_node", "summarize_node")
  .addConditionalEdges("summarize_node", (s) =>
    s.summaries.length >= 5 ? "draft_node" : s.retried ? END : "broaden_node"
  )
  .addEdge("broaden_node", "search_node")
  .addConditionalEdges("draft_node", (s) =>
    s.status === "failed" ? END : "critique_node"
  )
  .addConditionalEdges("critique_node", (s) =>
    s.critique?.decision === "revise" && !s.revised ? "revise_node" : "approval_node"
  )
  .addEdge("revise_node", "approval_node")
  .addConditionalEdges("approval_node", (s) =>
    s.status === "cancelled" ? END : "send_node"
  )
  .addEdge("send_node", END);

export const checkpointer = new MemorySaver();

// The graph uses interrupt() inside approvalNode for human mode.
// The MemorySaver checkpointer enables state persistence across the interrupt.
export const newsletterGraph = graph.compile({ checkpointer });
