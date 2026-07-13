import { Annotation } from "@langchain/langgraph";
import type {
  AgentError,
  AgentOutput,
  AgentStatus,
  Article,
  Critique,
  Draft,
  Event,
  Mode,
  Plan,
  SearchResult,
  Summary,
} from "./types";

export const AgentAnnotation = Annotation.Root({
  runId: Annotation<string>,
  goal: Annotation<string>,
  mode: Annotation<Mode>,
  status: Annotation<AgentStatus>,
  plan: Annotation<Plan | undefined>,
  searchResults: Annotation<SearchResult[]>({
    reducer: (_, v) => v,
    default: () => [],
  }),
  selected: Annotation<SearchResult[]>({
    reducer: (_, v) => v,
    default: () => [],
  }),
  articles: Annotation<Article[]>({
    reducer: (_, v) => v,
    default: () => [],
  }),
  summaries: Annotation<Summary[]>({
    reducer: (_, v) => v,
    default: () => [],
  }),
  draft: Annotation<Draft | undefined>,
  critique: Annotation<Critique | undefined>,
  finalNewsletter: Annotation<Draft | undefined>,
  html: Annotation<string | undefined>,
  events: Annotation<Event[]>({
    reducer: (a, v) => [...a, ...v],
    default: () => [],
  }),
  errors: Annotation<AgentError[]>({
    reducer: (a, v) => [...a, ...v],
    default: () => [],
  }),
  retried: Annotation<boolean>({
    reducer: (_, v) => v,
    default: () => false,
  }),
  revised: Annotation<boolean>({
    reducer: (_, v) => v,
    default: () => false,
  }),
  output: Annotation<AgentOutput | undefined>,
});

export const event = (
  node: string,
  label: string,
  status: Event["status"],
  detail: string
): Event => ({
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
  node,
  label,
  status,
  detail,
});
