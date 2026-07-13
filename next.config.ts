import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude these packages from Turbopack bundling; they are used server-side
  // and have complex CommonJS/ESM module graphs that require native Node.js resolution.
  serverExternalPackages: [
    "cheerio",
    "rss-parser",
    "@langchain/langgraph",
    "@langchain/core",
    "@langchain/google-genai",
    "@langchain/langgraph-checkpoint",
  ],
};

export default nextConfig;
