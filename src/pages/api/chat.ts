// POST /api/chat – the AI "người dẫn đường" for each ethnic-group room.
// Runs on the server only (on demand), so the API key never reaches the browser.
// Request:  { group: "pa-then", messages: [{ role: "user" | "assistant", content: string }] }
// Response: a plain-text stream of the answer, ending with a "NGUỒN: <section-id>" line.
//
// Two AI providers are supported (choose with AI_PROVIDER, or let it pick the one
// whose key is set, Gemini first):
//   - gemini: Google Gemini API, free tier available (GEMINI_API_KEY, GEMINI_MODEL)
//   - claude: Anthropic Claude API, paid (ANTHROPIC_API_KEY, AI_MODEL)
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import {
  AI_PROVIDER,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  ANTHROPIC_API_KEY,
  AI_MODEL,
  CHAT_RATE_LIMIT,
} from 'astro:env/server';
import { systemPrompt } from '../../lib/chat-context';

export const prerender = false;

type Role = 'user' | 'assistant';
interface Message {
  role: Role;
  content: string;
}

const MAX_MESSAGES = 12; // 6 turns of memory
const MAX_USER_CHARS = 500;
const MAX_ASSISTANT_CHARS = 2000;

// Best-effort limiter. Serverless instances do not share memory; for a strict
// global limit, move this to a store such as Upstash Redis or Vercel KV.
const hits = new Map<string, { count: number; reset: number }>();
function isLimited(key: string, max: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + 60 * 60 * 1000 });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

const error = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function parseMessages(input: unknown): Message[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: Message[] = [];
  for (const raw of input.slice(-MAX_MESSAGES)) {
    if (!raw || typeof raw !== 'object') return null;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const text = content.trim();
    if (!text) return null;
    if (text.length > (role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS)) return null;
    // Keep roles alternating: merge accidental repeats.
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content += `\n${text}`;
    else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

type Provider = 'gemini' | 'claude';

function pickProvider(): Provider | null {
  if (AI_PROVIDER === 'gemini') return GEMINI_API_KEY ? 'gemini' : null;
  if (AI_PROVIDER === 'claude') return ANTHROPIC_API_KEY ? 'claude' : null;
  if (GEMINI_API_KEY) return 'gemini';
  if (ANTHROPIC_API_KEY) return 'claude';
  return null;
}

// Gemini models tried in order. If one is overloaded (503), rate limited (429) or
// retired (404), the next one is used. The "-latest" aliases follow Google's
// current models, so they keep working when older versions are switched off.
const GEMINI_FALLBACKS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];

async function callGemini(system: string, history: Message[]): Promise<Response> {
  const models = [...new Set([GEMINI_MODEL || GEMINI_FALLBACKS[0], ...GEMINI_FALLBACKS])];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    // Newer Gemini models "think" before answering and those tokens count toward
    // this limit, so it is set well above the ~120-word answer length.
    generationConfig: { maxOutputTokens: 4096, temperature: 0.4 },
  });
  let res!: Response;
  for (const model of models) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      { method: 'POST', headers: { 'x-goog-api-key': GEMINI_API_KEY!, 'content-type': 'application/json' }, body },
    );
    if (![404, 429, 503].includes(res.status)) return res;
    console.warn(`[chat:gemini] ${model} unavailable (${res.status}), trying the next model`);
    await res.body?.cancel().catch(() => {});
  }
  return res;
}

// Sends the request to the chosen provider. Both answer with Server-Sent Events.
function callProvider(provider: Provider, system: string, history: Message[]): Promise<Response> {
  if (provider === 'gemini') return callGemini(system, history);
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL || 'claude-haiku-5-5',
      max_tokens: 1024,
      stream: true,
      // The room material is identical for every visitor: cache it.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: history,
    }),
  });
}

// Reads one SSE `data:` payload and returns the answer text in it, if any.
// Returns `null` for an error event.
function extractText(provider: Provider, parsed: any): string | null {
  if (provider === 'gemini') {
    if (parsed.error) return null;
    const parts: any[] = parsed.candidates?.[0]?.content?.parts ?? [];
    return parts.filter((part) => typeof part.text === 'string' && !part.thought).map((part) => part.text).join('');
  }
  if (parsed.type === 'error') return null;
  if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') return parsed.delta.text;
  return '';
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const provider = pickProvider();
  if (!provider) {
    return error(503, 'Người dẫn đường chưa được kết nối. Nhóm cần thêm khóa GEMINI_API_KEY (hoặc ANTHROPIC_API_KEY).');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Yêu cầu không hợp lệ.');
  }
  const { group, messages } = (body ?? {}) as { group?: unknown; messages?: unknown };
  if (typeof group !== 'string' || !/^[a-z0-9-]+$/.test(group)) return error(400, 'Không rõ phòng trưng bày.');

  const entry = await getEntry('ethnicGroups', group);
  if (!entry) return error(404, 'Không tìm thấy phòng trưng bày này.');

  const history = parseMessages(messages);
  if (!history) return error(400, `Câu hỏi cần có nội dung và không dài quá ${MAX_USER_CHARS} ký tự.`);

  let ip = 'unknown';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || ip;
  } catch {
    /* clientAddress unavailable */
  }
  if (isLimited(ip, CHAT_RATE_LIMIT ?? 20)) {
    return error(429, 'Bạn đã hỏi khá nhiều rồi. Hãy nghỉ một chút và quay lại sau nhé.');
  }

  let upstream: Response;
  try {
    upstream = await callProvider(provider, systemPrompt(entry), history);
  } catch (err) {
    console.error(`[chat:${provider}] network error`, err);
    return error(502, 'Người dẫn đường đang bận, bạn thử lại sau nhé.');
  }

  if (!upstream.ok || !upstream.body) {
    console.error(`[chat:${provider}] upstream error`, upstream.status, await upstream.text().catch(() => ''));
    const busy = upstream.status === 429 || upstream.status === 503 || upstream.status === 529;
    return error(busy ? 503 : 502, busy ? 'Người dẫn đường đang tiếp nhiều khách, bạn thử lại sau ít phút nhé.' : 'Người dẫn đường đang bận, bạn thử lại sau nhé.');
  }

  // Convert the Server-Sent Events stream into plain text chunks.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    // Keep reading until at least one chunk was enqueued: a pull that enqueues
    // nothing would not be called again and the response would hang.
    async pull(controller) {
      let sent = false;
      while (!sent) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let cut: number;
        while ((cut = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          for (const line of event.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue; // ignore malformed events
            }
            const text = extractText(provider, parsed);
            if (text === null) {
              console.error(`[chat:${provider}] stream error`, data);
              controller.enqueue(encoder.encode('\n\n(Người dẫn đường bị gián đoạn, bạn hỏi lại nhé.)'));
              sent = true;
            } else if (text) {
              controller.enqueue(encoder.encode(text));
              sent = true;
            }
          }
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
};
