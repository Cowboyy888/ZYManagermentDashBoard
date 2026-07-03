import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { AIChatWidget } from "@/components/AIChatWidget";

export const metadata: Metadata = { title: "Sales Assistant" };

const STARTERS = [
  "What mesh SKUs do we have in stock?",
  "Can we fulfil an order for 500 pcs RM-4.0 this week?",
  "What is our production capacity right now?",
  "Which SKUs are out of stock?",
  "Estimate delivery for a 200-piece order",
  "What are our available product dimensions?",
];

export default async function SalesAIPage() {
  await requireUser();
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Sales Assistant</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Check product availability, answer customer queries, estimate delivery times — powered by Claude Sonnet 4.6
        </p>
      </div>
      <AIChatWidget
        domain="sales"
        placeholder="Ask about products, stock, or order feasibility…"
        starters={STARTERS}
      />
    </div>
  );
}
