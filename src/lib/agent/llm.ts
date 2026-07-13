import "server-only";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { requireGeminiKey, env } from "@/lib/env";
import type { z } from "zod";
export const model = () => new ChatGoogleGenerativeAI({ apiKey:requireGeminiKey(), model:env.geminiModel, temperature:0.2, maxOutputTokens:8192 });
export async function structured<T extends z.ZodTypeAny>(schema:T,prompt:string):Promise<z.infer<T>> { return model().withStructuredOutput(schema).invoke(prompt); }
