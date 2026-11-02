// End-of-room quiz. Answer every question correctly to earn the stamp.
// Wrong answers can be retried; DOM is built with textContent (no innerHTML).
import { addStamp, hasStamp } from './passport';

interface Question {
  question: string;
  options: string[];
  answer: number;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function initQuiz(root: HTMLElement) {
  const dataEl = root.querySelector<HTMLScriptElement>('[data-quiz-data]');
  const body = root.querySelector<HTMLElement>('[data-quiz-body]');
  if (!dataEl || !body) return;

  let questions: Question[] = [];
  try {
    questions = JSON.parse(dataEl.textContent ?? '[]');
  } catch {
    return;
  }
  const slug = root.dataset.slug ?? '';
  const symbol = root.dataset.symbol ?? '';
  const nextHref = root.dataset.nextHref;
  const nextLabel = root.dataset.nextLabel;
  let index = 0;

  function renderQuestion() {
    const q = questions[index];
    body!.replaceChildren();

    const head = el('div', 'quiz__progress');
    head.append(el('span', undefined, `Câu ${index + 1}/${questions.length}`));
    if (index === 0 && hasStamp(slug)) head.append(el('span', 'quiz__note', 'Bạn đã có dấu này, chơi lại cho vui nhé!'));
    body!.append(head);

    const title = el('p', 'quiz__question', q.question);
    title.id = `quiz-q-${slug}-${index}`;
    body!.append(title);

    const list = el('div', 'quiz__options');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-labelledby', title.id);
    const feedback = el('p', 'quiz__feedback');
    feedback.setAttribute('aria-live', 'polite');

    q.options.forEach((option, i) => {
      const btn = el('button', 'quiz__option');
      btn.type = 'button';
      btn.append(el('span', 'quiz__letter', LETTERS[i] ?? String(i + 1)), el('span', undefined, option));
      btn.addEventListener('click', () => {
        if (i === q.answer) {
          btn.classList.add('is-correct');
          list.querySelectorAll('button').forEach((b) => (b.disabled = true));
          feedback.textContent = 'Chính xác!';
          const last = index === questions.length - 1;
          const next = el('button', 'btn btn-quiz', last ? 'Nhận con dấu' : 'Câu tiếp theo');
          next.type = 'button';
          next.addEventListener('click', () => {
            if (last) finish();
            else {
              index += 1;
              renderQuestion();
            }
          });
          body!.append(next);
          next.focus();
        } else {
          btn.classList.add('is-wrong');
          btn.disabled = true;
          feedback.textContent = 'Chưa đúng, bạn thử lại nhé.';
        }
      });
      list.append(btn);
    });

    body!.append(list, feedback);
  }

  function finish() {
    addStamp(slug);
    body!.replaceChildren();
    const done = el('div', 'quiz__done');
    const heading = el('p', 'quiz__question', `Bạn đã nhận dấu ${symbol}!`);
    heading.tabIndex = -1;
    done.append(heading, el('p', undefined, 'Con dấu đã được đóng vào sổ hành trình của bạn.'));
    const actions = el('div', 'quiz__actions');
    if (nextHref && nextLabel) {
      const a = el('a', 'btn btn-quiz', `Chặng tiếp theo: ${nextLabel}`);
      a.href = nextHref;
      actions.append(a);
    }
    const map = el('a', 'btn btn-quiz-outline', 'Về bản đồ');
    map.href = '/home#passport';
    const again = el('button', 'btn btn-quiz-outline', 'Chơi lại');
    again.type = 'button';
    again.addEventListener('click', () => {
      index = 0;
      renderQuestion();
    });
    actions.append(map, again);
    done.append(actions);
    body!.append(done);
    heading.focus();
  }

  renderQuestion();
}
