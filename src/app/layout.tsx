import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalBrief – AI Newsletter Agent",
  description:
    "An observable, bounded LangGraph JS agent that autonomously researches, summarizes, critiques, and delivers an AI-agent news newsletter. Supports Fully Autonomous and Human-in-the-Loop modes.",
  keywords: ["LangGraph", "AI agent", "newsletter", "autonomous", "HITL"],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
