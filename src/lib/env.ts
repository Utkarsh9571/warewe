import "server-only";
export const env = {
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  newsKey: process.env.NEWS_API_KEY,
  newsProvider: process.env.NEWS_PROVIDER || "rss",
  recipients: Number(process.env.NEXT_PUBLIC_SIMULATED_RECIPIENT_COUNT || 1248),
};
export function requireGeminiKey() { if (!env.geminiKey) throw new Error("GEMINI_API_KEY is missing. Add it to .env.local before running the live agent."); return env.geminiKey; }
