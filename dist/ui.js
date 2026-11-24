import { localDate, dateKey, plusDays } from './model.js?v=2';

const paths = {
  plan: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  map: '<rect x="9" y="3" width="6" height="5" rx="1.3"/><path d="M12 8v4M5 16v-4h14v4"/><rect x="2" y="16" width="6" height="5" rx="1.3"/><rect x="16" y="16" width="6" height="5" rx="1.3"/>',
  completed: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16 9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7.5 3v4m9-4v4M3 10h18m-12 4h2"/>',
  layers:
    '<path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Zm-9 9 9 4.5 9-4.5m-18 4.5 9 4.5 9-4.5"/>',
  folder:
    '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  upRight: '<path d="M6 18 18 6M7 6h11v11"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m4.5 12 5 5 10-10"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M3 6h.1M3 12h.1M3 18h.1"/>',
  sub: '<path d="m3 6 1.4 1.4L7 4.5M10 6h11M10 12h11M10 18h11"/><rect x="3" y="11" width="3.5" height="3.5" rx=".7"/>',
  note: '<path d="M5 4h14v12l-5 5H5zM14 21v-5h5M8 8h8m-8 4h6"/>',
  file: '<path d="M7 3h7l4 4v14H7zM14 3v5h4"/>',
  clip: '<path d="m8 13 6.5-6.5a2.1 2.1 0 0 1 3 3L9 18a4 4 0 0 1-5.7-5.7l9.2-9.2a5.4 5.4 0 0 1 7.6 7.6l-9 9"/>',
  link: '<path d="m10 13 4-4m-6.5 2-2.1 2.1a4 4 0 0 0 5.6 5.7l3-3M10 8l3-3a4 4 0 1 1 5.7 5.6L16.5 13"/>',
  sort: '<path d="M7 4v15m-3-3 3 3 3-3M13 6h8m-8 5h6m-6 5h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/>',
  trash: '<path d="M3 6h18M6 6l1 14h10l1-14m-9 0V3h6v3m-5 4v6m4-6v6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  fit: '<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',
  pointer: '<path d="m5 3 14 10-7 1-3 7-4-18Z"/>',
  workspace:
    '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8.5 4v16"/>',
  progress:
    '<path d="M21 12a9 9 0 1 1-9-9"/><path d="M15 3.5a9 9 0 0 1 5.5 5.5"/>',
};
export function icon(name, size = 18) {
  return (
    '<svg class="icon" aria-hidden="true" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] ?? '') +
    '</svg>'
  );
}
export const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        ch
      ]
  );

export function words(n, forms = ['задача', 'задачи', 'задач']) {
  const mod = n % 100;
  if (mod >= 11 && mod <= 14) return forms[2];
  return n % 10 === 1
    ? forms[0]
    : n % 10 >= 2 && n % 10 <= 4
      ? forms[1]
      : forms[2];
}
export function formatDate(key, options = { day: 'numeric', month: 'short' }) {
  return localDate(key).toLocaleDateString('ru-RU', options).replace(/\.$/, '');
}
export function brand() {
  return '<a class="brand" href="#plan" aria-label="YaSam, мой план"><img src="./assets/mark.svg" width="34" height="34" alt="">YaSam</a>';
}
export function iconButton(action, name, glyph, extra = '') {
  return (
    '<button type="button" class="icon-button" data-act="' +
    action +
    '" aria-label="' +
    esc(name) +
    '" title="' +
    esc(name) +
    '" ' +
    extra +
    '>' +
    icon(glyph) +
    '</button>'
  );
}
let statusTimer;
export function notify(message, error = false) {
  const box = document.querySelector('#status');
  clearTimeout(statusTimer);
  box.textContent = message;
  box.className = error ? 'visible error' : 'visible';
  statusTimer = setTimeout(
    () => {
      box.className = '';
    },
    error ? 6500 : 2800
  );
}
export function readableError(error) {
  return error?.name === 'QuotaExceededError'
    ? 'Память браузера заполнена. Уменьшите вложение и попробуйте снова.'
    : error?.message || 'Не удалось сохранить изменения.';
}
export function showPopup(title, body, options = {}) {
  const dialog = document.querySelector('#popup');
  if (dialog.open) dialog.close();
  dialog.className = 'popup ' + (options.className ?? '');
  dialog.innerHTML =
    '<div class="popup-head"><h2 id="popup-heading">' +
    esc(title) +
    '</h2>' +
    iconButton('close-popup', 'Закрыть окно', 'x') +
    '</div>' +
    body;
  dialog.querySelector('[data-act="close-popup"]').onclick = () =>
    dialog.close();
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close();
  };
  dialog.showModal();
  if (options.focus) dialog.querySelector(options.focus)?.focus();
  return dialog;
}

function anchoredDialog(trigger, label, className) {
  const dialog = document.createElement('dialog');
  dialog.className = 'picker ' + className;
  dialog.setAttribute('aria-label', label);
  document.body.append(dialog);
  trigger.setAttribute('aria-expanded', 'true');
  dialog.addEventListener(
    'close',
    () => {
      trigger.setAttribute('aria-expanded', 'false');
      dialog.remove();
    },
    { once: true }
  );
  dialog.onclick = (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  };
  return {
    dialog,
    open() {
      dialog.showModal();
      const r = trigger.getBoundingClientRect();
      const width = Math.min(
        Math.max(r.width, className === 'calendar-pop' ? 280 : 220),
        innerWidth - 24
      );
      dialog.style.width = width + 'px';
      const h = dialog.getBoundingClientRect().height;
      dialog.style.left =
        Math.max(12, Math.min(r.left, innerWidth - width - 12)) + 'px';
      dialog.style.top =
        Math.max(
          8,
          Math.min(
            r.bottom + 6 + h <= innerHeight - 8 || r.top < h + 6
              ? r.bottom + 6
              : r.top - h - 6,
            innerHeight - h - 8
          )
        ) + 'px';
    },
  };
}

export function chooseOption(trigger, label, choices, value, choose) {
  const { dialog, open } = anchoredDialog(trigger, label, 'choice-pop');
  dialog.innerHTML = `<div role="listbox" aria-label="${esc(label)}">${choices.map(([id, name]) => `<button type="button" class="choice-item" role="option" aria-selected="${id === value}" data-value="${esc(id)}"><span>${esc(name)}</span>${id === value ? icon('check', 16) : ''}</button>`).join('')}</div>`;
  const buttons = [...dialog.querySelectorAll('[role="option"]')];
  if (!buttons.length) {
    trigger.setAttribute('aria-expanded', 'false');
    dialog.remove();
    return;
  }
  dialog.querySelector('[role="listbox"]').onclick = (e) => {
    const item = e.target.closest('[role="option"]');
    if (item) {
      dialog.close();
      choose(item.dataset.value);
    }
  };
  let prefix = '',
    lastKey = 0;
  dialog.onkeydown = (e) => {
    const index = buttons.indexOf(document.activeElement);
    let target;
    if (e.key === 'ArrowDown') target = buttons[(index + 1) % buttons.length];
    else if (e.key === 'ArrowUp')
      target = buttons[(index + buttons.length - 1) % buttons.length];
    else if (e.key === 'Home') target = buttons[0];
    else if (e.key === 'End') target = buttons.at(-1);
    else if (e.key.length === 1 && e.key.trim() && !e.ctrlKey && !e.metaKey) {
      const now = performance.now();
      prefix =
        (now - lastKey < 650 ? prefix : '') + e.key.toLocaleLowerCase('ru');
      lastKey = now;
      target = buttons.find((b) =>
        b.textContent.trim().toLocaleLowerCase('ru').startsWith(prefix)
      );
    }
    if (target) {
      e.preventDefault();
      target.focus();
    }
  };
  open();
  const initial = dialog.querySelector('[aria-selected="true"]') ?? buttons[0];
  initial.focus({ preventScroll: true });
  initial.scrollIntoView({ block: 'nearest' });
}

export function chooseDate(trigger, value, choose) {
  const { dialog, open } = anchoredDialog(
    trigger,
    'Выбрать дату',
    'calendar-pop'
  );
  const today = dateKey();
  let day = value || today;
  let month = day.slice(0, 7) + '-01';
  function draw() {
    const start = plusDays(month, -((localDate(month).getDay() + 6) % 7));
    const caption = formatDate(month, { month: 'long', year: 'numeric' });
    dialog.innerHTML = `<div class="month-head"><button type="button" data-month="-1" aria-label="Предыдущий месяц">${icon('right', 16)}</button><strong aria-live="polite">${esc(caption)}</strong><button type="button" data-month="1" aria-label="Следующий месяц">${icon('right', 16)}</button></div>
      <div class="month-grid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((n) => `<small>${n}</small>`).join('')}${Array.from(
        { length: 42 },
        (_, i) => {
          const d = plusDays(start, i);
          return `<button type="button" data-day="${d}" aria-label="${formatDate(d, { day: 'numeric', month: 'long', year: 'numeric' })}" aria-pressed="${d === value}" class="${d.slice(0, 7) !== month.slice(0, 7) ? 'outside ' : ''}${d === today ? 'current-day' : ''}">${Number(d.slice(-2))}</button>`;
        }
      ).join(
        ''
      )}</div><div class="calendar-foot"><button type="button" data-value="">Без даты</button><button type="button" data-value="${today}">Сегодня</button></div>`;
    dialog.querySelectorAll('[data-month]').forEach(
      (b) =>
        (b.onclick = () => {
          const next = localDate(month);
          next.setMonth(next.getMonth() + Number(b.dataset.month));
          month = dateKey(next);
          draw();
          dialog.querySelector(`[data-month="${b.dataset.month}"]`).focus();
        })
    );
    for (const b of dialog.querySelectorAll('[data-day],[data-value]'))
      b.onclick = () => {
        dialog.close();
        choose(b.dataset.day ?? b.dataset.value);
      };
  }
  dialog.onkeydown = (e) => {
    const amount = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
      e.key
    ];
    if (!amount || !e.target.dataset.day) return;
    e.preventDefault();
    day = plusDays(e.target.dataset.day, amount);
    month = day.slice(0, 7) + '-01';
    draw();
    dialog.querySelector(`[data-day="${day}"]`).focus();
  };
  draw();
  open();
  dialog.querySelector(`[data-day="${day}"]`)?.focus({ preventScroll: true });
}

export function confirmAction(
  title,
  message,
  action,
  cancel = 'Оставить',
  destructive = false
) {
  const panel = document.createElement('dialog');
  panel.className = 'popup confirm-panel';
  panel.setAttribute('aria-label', title);
  panel.innerHTML = `<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="popup-foot"><button class="btn" data-no>${esc(cancel)}</button><button class="btn ${destructive ? 'danger' : 'primary'}" data-yes>${esc(action)}</button></div>`;
  document.body.append(panel);
  return new Promise((resolve) => {
    panel.addEventListener(
      'close',
      () => {
        const confirmed = panel.returnValue === 'yes';
        panel.remove();
        resolve(confirmed);
      },
      { once: true }
    );
    panel.querySelector('[data-no]').onclick = () => panel.close();
    panel.querySelector('[data-yes]').onclick = () => panel.close('yes');
    panel.showModal();
    panel.querySelector('[data-no]').focus();
  });
}

export function editInlineTitle(trigger, task, save) {
  const { dialog, open } = anchoredDialog(
    trigger,
    'Название задачи',
    'rename-pop'
  );
  dialog.innerHTML = `<form novalidate><div class="rename-line"><input aria-label="Название задачи" maxlength="300" value="${esc(task.title)}"><button type="submit" aria-label="Сохранить название">${icon('check', 17)}</button><button type="button" aria-label="Отменить переименование">${icon('x', 16)}</button></div><p role="alert" class="form-error"></p></form>`;
  const input = dialog.querySelector('input'),
    form = dialog.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (form.inert) return;
    form.inert = true;
    try {
      if (input.value.trim() !== task.title) await save(input.value);
      dialog.close();
    } catch (error) {
      form.querySelector('.form-error').textContent = readableError(error);
    } finally {
      form.inert = false;
      if (dialog.open) input.focus();
    }
  };
  form.querySelector('[type=button]').onclick = () => dialog.close();
  dialog.addEventListener(
    'close',
    () => {
      document
        .querySelector('.task-name[data-id="' + CSS.escape(task.id) + '"]')
        ?.focus({ preventScroll: true });
    },
    { once: true }
  );
  dialog.onclick = (e) => {
    if (e.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      e.clientX < bounds.left ||
      e.clientX > bounds.right ||
      e.clientY < bounds.top ||
      e.clientY > bounds.bottom
    )
      form.requestSubmit();
  };
  open();
  const r = trigger.getBoundingClientRect();
  const available = trigger
    .closest('.task-entry')
    .getBoundingClientRect().width;
  const width = Math.min(Math.max(260, available - 12), innerWidth - 20);
  dialog.style.width = width + 'px';
  dialog.style.left =
    Math.max(10, Math.min(r.left - 9, innerWidth - width - 10)) + 'px';
  dialog.style.top =
    Math.max(8, Math.min(r.top - 8, innerHeight - dialog.offsetHeight - 8)) +
    'px';
  input.focus();
  input.select();
}
