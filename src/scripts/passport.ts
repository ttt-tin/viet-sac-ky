// "Sổ hành trình" – the visitor's passport. Stamps are stored only in this
// browser (localStorage). Every read/write is guarded: storage can be blocked
// (private mode, strict settings) and the site must still work without it.

const KEY = 'vsk-passport-v1';
export const STAMP_EVENT = 'passport:change';

function allGroups(): string[] {
  const el = document.querySelector<HTMLElement>('[data-passport-groups]');
  return el?.dataset.passportGroups?.split(',').filter(Boolean) ?? [];
}

export function getStamps(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(allGroups());
    return parsed.filter((s): s is string => typeof s === 'string' && (valid.size === 0 || valid.has(s)));
  } catch {
    return [];
  }
}

function save(stamps: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stamps));
  } catch {
    /* storage unavailable: stamps live for this page view only */
  }
}

export function hasStamp(slug: string): boolean {
  return getStamps().includes(slug);
}

export function addStamp(slug: string) {
  const stamps = new Set(getStamps());
  stamps.add(slug);
  save([...stamps]);
  renderPassport();
  document.dispatchEvent(new CustomEvent(STAMP_EVENT, { detail: { slug } }));
}

export function resetPassport() {
  save([]);
  renderPassport();
  document.dispatchEvent(new CustomEvent(STAMP_EVENT));
}

/** Sync every passport-related element on the page with the stored stamps. */
export function renderPassport(root: ParentNode = document) {
  const stamps = getStamps();
  const total = allGroups().length || 3;
  const done = stamps.length >= total;

  root.querySelectorAll<HTMLElement>('[data-passport-count]').forEach((el) => (el.textContent = String(stamps.length)));
  root.querySelectorAll<HTMLElement>('[data-passport-pill]').forEach((el) => el.classList.toggle('is-complete', done));
  root.querySelectorAll<HTMLElement>('[data-stamp-slot]').forEach((el) => {
    el.classList.toggle('is-stamped', stamps.includes(el.dataset.stampSlot ?? ''));
  });
  root.querySelectorAll<HTMLElement>('[data-passport-progress]').forEach((el) => {
    el.style.width = `${Math.round((stamps.length / total) * 100)}%`;
  });
  root.querySelectorAll<HTMLElement>('[data-passport-complete]').forEach((el) => (el.hidden = !done));
  root.querySelectorAll<HTMLElement>('[data-passport-incomplete]').forEach((el) => (el.hidden = done));
}
