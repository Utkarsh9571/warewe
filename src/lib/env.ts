import "server-only";

export const env = {
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  newsKey: process.env.NEWS_API_KEY,
  newsProvider: (process.env.NEWS_PROVIDER || "rss") as "newsapi" | "rss",
  recipients: Number(process.env.NEXT_PUBLIC_SIMULATED_RECIPIENT_COUNT || 1248),
};

export function requireGeminiKey(): string {
  if (!env.geminiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Copy .env.example to .env.local and add your key before running the live agent."
    );
  }
  return env.geminiKey;
}
