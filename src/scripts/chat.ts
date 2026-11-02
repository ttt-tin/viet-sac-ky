// Client side of the AI chat guide (see src/pages/api/chat.ts).

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SOURCE_MARK = 'NGUỒN:';

/** Split the model output into the visible answer and the cited section ids. */
export function splitAnswer(raw: string, streaming = false): { body: string; sources: string[] } {
  const i = raw.toUpperCase().lastIndexOf(SOURCE_MARK);
  if (i === -1) {
    // While streaming, hide a source line that has only partly arrived ("\nNGU…").
    const partial = streaming ? raw.match(/\n\s*N(G(U(Ồ(N)?)?)?)?$/i) : null;
    return { body: (partial ? raw.slice(0, partial.index) : raw).trim(), sources: [] };
  }
  const sources = raw
    .slice(i + SOURCE_MARK.length)
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]+$/.test(s));
  return { body: raw.slice(0, i).trim(), sources: [...new Set(sources)].slice(0, 2) };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function initChat(root: HTMLElement) {
  const group = root.dataset.group ?? '';
  let sections: Record<string, string> = {};
  try {
    sections = JSON.parse(root.dataset.sections ?? '{}');
  } catch {
    /* no section links */
  }
  const openBtn = root.querySelector<HTMLButtonElement>('[data-chat-open]')!;
  const panel = root.querySelector<HTMLElement>('[data-chat-panel]')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('[data-chat-close]')!;
  const log = root.querySelector<HTMLOListElement>('[data-chat-log]')!;
  const suggest = root.querySelector<HTMLElement>('[data-chat-suggest]');
  const form = root.querySelector<HTMLFormElement>('[data-chat-form]')!;
  const input = form.querySelector<HTMLTextAreaElement>('textarea')!;
  const sendBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  const history: Message[] = [];
  let busy = false;

  function setOpen(open: boolean) {
    panel.hidden = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-open', open);
    if (open) input.focus();
    else openBtn.focus();
  }

  openBtn.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
  closeBtn.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function addMessage(role: 'user' | 'bot', text = ''): HTMLLIElement {
    const li = el('li', `msg msg--${role}`);
    li.append(el('p', 'msg__text', text));
    log.append(li);
    scrollToEnd();
    return li;
  }

  function showSources(li: HTMLLIElement, ids: string[]) {
    const links = ids.filter((id) => sections[id]);
    if (!links.length) return;
    const wrap = el('div', 'msg__sources');
    for (const id of links) {
      const a = el('a', 'msg__source', `Xem thêm: ${sections[id]}`);
      a.href = `#${id}`;
      a.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 900px)').matches) setOpen(false);
      });
      wrap.append(a);
    }
    li.append(wrap);
  }

  function setBusy(value: boolean) {
    busy = value;
    sendBtn.disabled = value;
    input.disabled = value;
    root.querySelectorAll<HTMLButtonElement>('[data-suggest]').forEach((b) => (b.disabled = value));
  }

  async function ask(question: string) {
    const text = question.trim().slice(0, 500);
    if (!text || busy) return;
    if (suggest) suggest.hidden = true;
    addMessage('user', text);
    history.push({ role: 'user', content: text });
    const li = addMessage('bot');
    li.classList.add('is-typing');
    const p = li.querySelector('p')!;
    setBusy(true);

    let raw = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group, messages: history.slice(-12) }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Người dẫn đường đang bận, bạn thử lại sau nhé.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        li.classList.remove('is-typing');
        p.textContent = splitAnswer(raw, true).body;
        scrollToEnd();
      }
      raw += decoder.decode();
      const { body, sources } = splitAnswer(raw);
      p.textContent = body || 'Xin lỗi, mình chưa trả lời được câu này.';
      showSources(li, sources);
      history.push({ role: 'assistant', content: body || '…' });
    } catch (err) {
      li.classList.remove('is-typing');
      li.classList.add('msg--error');
      p.textContent = err instanceof Error ? err.message : 'Đã có lỗi xảy ra.';
      history.pop(); // drop the unanswered question
    } finally {
      setBusy(false);
      scrollToEnd();
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    ask(value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-suggest]').forEach((b) =>
    b.addEventListener('click', () => ask(b.textContent ?? '')),
  );
}
