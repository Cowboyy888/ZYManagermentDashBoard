import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { anthropic, AI_MODEL, buildHRContext, buildProductionContext, buildSalesContext } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const DOMAIN_BUILDERS: Record<string, () => Promise<string>> = {
  hr: buildHRContext,
  production: buildProductionContext,
  sales: buildSalesContext,
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!checkRateLimit(user.id, "ai-chat", 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { domain: string; messages: ChatMessage[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const { domain, messages } = body;
  if (!DOMAIN_BUILDERS[domain]) return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  if (!messages?.length) return NextResponse.json({ error: "No messages" }, { status: 400 });
  if (messages.length > 20) return NextResponse.json({ error: "Too many messages" }, { status: 400 });
  const totalChars = messages.reduce((s: number, m: { content: string }) => s + (m.content?.length ?? 0), 0);
  if (totalChars > 40_000) return NextResponse.json({ error: "Message content too large" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const systemPrompt = await DOMAIN_BUILDERS[domain]();

    const stream = anthropic.messages.stream({
      model: AI_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
