import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { AIChatWidget } from "@/components/AIChatWidget";

export const metadata: Metadata = { title: "Production Assistant" };

const STARTERS = [
  "Which machines are under maintenance?",
  "What is our current wire inventory?",
  "List all open production orders",
  "What was our output last 7 days?",
  "Any recent quality failures?",
  "Which mesh SKUs are low on stock?",
];

export default async function ProductionAIPage() {
  await requireUser();
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Production Assistant</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Ask about machines, orders, inventory, maintenance and quality — powered by Claude Sonnet 4.6
        </p>
      </div>
      <AIChatWidget
        domain="production"
        placeholder="Ask about factory operations…"
        starters={STARTERS}
      />
    </div>
  );
}
