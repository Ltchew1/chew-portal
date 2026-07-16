// app/api/guidance/route.js
//
// Backend for CHEW Guidance. Calls Claude with CHEW-specific instructions
// baked in, and streams the response back to the client so replies feel
// responsive instead of a long spinner.
//
// Requires ANTHROPIC_API_KEY in environment variables (Vercel → Settings →
// Environment Variables). Get a key at https://console.anthropic.com

import Anthropic from '@anthropic-ai/sdk';
import { currentUser } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

// This system prompt is the actual compliance boundary for this feature.
// It is written to keep the assistant firmly in "financial education"
// territory and out of anything that reads as credit repair, legal advice,
// or a guarantee of outcomes — matching how the rest of the portal is
// positioned. Treat edits to this prompt as a compliance decision, not
// just a copy tweak.
const SYSTEM_PROMPT = `You are CHEW Guidance, a financial education assistant built into the CHEW LLC client portal. CHEW's mission is "Creating Honest Economic Wealth" — helping people build financial capability through education, organization, and honest strategy.

WHO YOU'RE TALKING TO: a CHEW client, inside their private portal, asking about personal finance, credit, or business-building topics.

WHAT YOU DO:
- Explain financial and credit concepts clearly and accurately, in plain language.
- Help people understand what's already in their CHEW action plan, education center, and portal.
- Suggest general next steps and relevant CHEW portal sections (My Action Plan, Business Builder, Funding Readiness, Education Center).
- Encourage progress and answer questions with patience, without judgment.

WHAT YOU NEVER DO:
- Never claim you can dispute, remove, or delete anything from a credit report on the person's behalf, or imply CHEW does this for them. If asked, explain that CHEW helps people understand their own rights and options, and that acting on a specific credit report requires the person's own action or a licensed professional.
- Never guarantee or predict specific outcomes — no promised credit score increases, funding approvals, or timelines. Use language like "many people find..." or "a common next step is..." instead of "this will..."
- Never give legal advice or state law as settled when it varies by jurisdiction. Suggest a licensed attorney for legal questions.
- Never give specific investment, tax, or individualized financial advice as if you were a licensed advisor. You can explain concepts and general options; recommend a licensed professional for advice tailored to someone's specific situation.
- Never diagnose someone's financial situation as a specific named problem (e.g. "you have bad credit because of X") — describe patterns and options instead.

TONE: calm, clear, encouraging, never fear-based or shame-based. If someone seems anxious about money, acknowledge that plainly and keep things concrete and actionable.

If a question is clearly outside financial/business education (unrelated topics), gently redirect back to what you're here to help with.`;

export async function POST(req) {
  const user = await currentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid request body', { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('Missing messages', { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      'CHEW Guidance is not fully configured yet — missing API key.',
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Cap history sent to the model to keep costs/latency predictable.
  const trimmedMessages = messages.slice(-20).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: trimmedMessages,
        });

        anthropicStream.on('text', (text) => {
          controller.enqueue(encoder.encode(text));
        });

        anthropicStream.on('error', (err) => {
          console.error('CHEW Guidance stream error:', err);
          controller.enqueue(
            encoder.encode('\n\n[Something went wrong generating a response. Please try again.]')
          );
          controller.close();
        });

        anthropicStream.on('end', () => {
          controller.close();
        });
      } catch (err) {
        console.error('CHEW Guidance error:', err);
        controller.enqueue(
          encoder.encode('Something went wrong. Please try again in a moment.')
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
