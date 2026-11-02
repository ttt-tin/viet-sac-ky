// Tiny, safe formatter for content text: escapes HTML, then supports
// **bold**, *italic* and blank-line-separated paragraphs. No raw HTML allowed.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function inline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function paragraphs(value: string): string {
  return value
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${inline(p.replace(/\s*\n\s*/g, ' '))}</p>`)
    .join('');
}

/** Strip the light markup, for plain-text uses such as the chat context. */
export function plain(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').trim();
}
