// POST /api/chat – the AI "người dẫn đường" for each ethnic-group room.
// Runs on the server only (on demand), so the API key never reaches the browser.
// Request:  { group: "pa-then", messages: [{ role: "user" | "assistant", content: string }] }
// Response: a plain-text stream of the answer, ending with a "NGUỒN: <section-id>" line.
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { ANTHROPIC_API_KEY, AI_MODEL, CHAT_RATE_LIMIT } from 'astro:env/server';
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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!ANTHROPIC_API_KEY) {
    return error(503, 'Người dẫn đường chưa được kết nối. Nhóm cần thêm khóa ANTHROPIC_API_KEY.');
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
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL || 'claude-haiku-5-5',
        max_tokens: 1024,
        stream: true,
        // The room material is identical for every visitor: cache it.
        system: [{ type: 'text', text: systemPrompt(entry), cache_control: { type: 'ephemeral' } }],
        messages: history,
      }),
    });
  } catch (err) {
    console.error('[chat] network error', err);
    return error(502, 'Người dẫn đường đang bận, bạn thử lại sau nhé.');
  }

  if (!upstream.ok || !upstream.body) {
    console.error('[chat] upstream error', upstream.status, await upstream.text().catch(() => ''));
    const busy = upstream.status === 429 || upstream.status === 529;
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
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(parsed.delta.text));
                sent = true;
              } else if (parsed.type === 'error') {
                console.error('[chat] stream error', parsed.error);
                controller.enqueue(encoder.encode('\n\n(Người dẫn đường bị gián đoạn, bạn hỏi lại nhé.)'));
                sent = true;
              }
            } catch {
              /* ignore malformed or unknown events */
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
