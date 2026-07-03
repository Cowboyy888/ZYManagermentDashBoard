import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { AIChatWidget } from "@/components/AIChatWidget";

export const metadata: Metadata = { title: "HR Assistant" };

const STARTERS = [
  "Who was absent today?",
  "List all pending leave requests",
  "How many employees joined this month?",
  "Show department headcount breakdown",
  "Draft a warning letter for late arrivals",
  "Summarize overtime pending approvals",
];

export default async function HRAIPage() {
  await requireUser();
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>HR Assistant</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Ask about employees, attendance, leave, overtime — powered by Claude Sonnet 4.6
        </p>
      </div>
      <AIChatWidget
        domain="hr"
        placeholder="Ask about your workforce…"
        starters={STARTERS}
      />
    </div>
  );
}
