import {
  taskDraft,
  saveTask,
  removeTask,
  setMembers,
  periods,
  peers,
  bucket,
  dateKey,
  localDate,
} from './model.js?v=2';
import { readFile } from './store.js?v=2';
import {
  esc,
  icon,
  iconButton,
  readableError,
  notify,
  chooseOption,
  chooseDate,
  confirmAction,
} from './ui.js?v=2';

function fileSize(size) {
  if (size < 1024) return size + ' Б';
  if (size < 1024 * 1024) return Math.ceil(size / 1024) + ' КБ';
  return (
    (size / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) +
    ' МБ'
  );
}

export function openEditor({
  state,
  task,
  period,
  mapId,
  projectId,
  commit,
  openRelated,
}) {
  const dialog = document.querySelector('#editor');
  const draft = task ? structuredClone(task) : taskDraft(period);
  if (!task) draft.projectId = projectId ?? null;
  const displayDate = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
  function readDate(value) {
    const text = value.trim();
    if (!text) return '';
    const iso = /^\d\d\.\d\d\.\d{4}$/.test(text)
      ? text.split('.').reverse().join('-')
      : text;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) && dateKey(localDate(iso)) === iso
      ? iso
      : null;
  }
  const related = new Set(peers(state, draft.id));
  const pending = new Map();
  let dirty = false,
    busy = false;
  dialog.innerHTML = `<form id="task-form" novalidate>
    <div class="drawer-head"><h2 id="editor-heading">${task ? 'Редактирование задачи' : 'Новая задача'}</h2>${iconButton('cancel', 'Закрыть задачу', 'x')}</div>
    <div class="drawer-body">
      <label class="field title-field">Название задачи<input name="title" maxlength="300" autocomplete="off" required placeholder="Что нужно сделать?" value="${esc(draft.title)}"></label>
      <div class="field"><span id="period-label">Период</span><div class="period-picker" role="group" aria-labelledby="period-label"></div></div>
      <div class="field"><span id="project-label">Проект</span><button type="button" class="field-choice" data-act="project" aria-labelledby="project-label project-value" aria-haspopup="listbox" aria-expanded="false">${icon('folder', 16)}<span id="project-value"></span>${icon('down', 16)}</button></div>
      <div class="date-fields"><div class="field"><label for="task-date">Дата</label><div class="input-pick"><input id="task-date" name="date" type="text" placeholder="ДД.ММ.ГГГГ" maxlength="10" autocomplete="off" value="${displayDate(draft.date)}">${iconButton('calendar', 'Открыть календарь', 'calendar', 'aria-haspopup="dialog" aria-expanded="false"')}</div></div><div class="field"><label for="task-time">Время</label><div class="input-pick"><input id="task-time" type="text" inputmode="numeric" name="time" maxlength="5" placeholder="ЧЧ:ММ" autocomplete="off" value="${esc(draft.time)}">${iconButton('clock', 'Выбрать время', 'clock', 'aria-haspopup="listbox" aria-expanded="false"')}</div></div></div>
      <section class="edit-section"><h3>${icon('sub', 17)}Подзадачи</h3><ul class="sub-list"></ul>
        <div class="sub-add"><input type="text" name="sub" placeholder="Добавить подзадачу" aria-label="Новая подзадача" maxlength="300" autocomplete="off">${iconButton('add-sub', 'Добавить подзадачу', 'plus')}</div></section>
      <label class="field"><span id="note-label" class="field-line">${icon('note', 17)}Заметка</span><textarea aria-labelledby="note-label" name="note" rows="3" placeholder="Детали, которые пригодятся">${esc(draft.note)}</textarea></label>
      <div class="fold-stack">
        <details class="edit-section fold files-fold" ${draft.files.length ? 'open' : ''}><summary><span class="fold-icon">${icon('clip', 17)}</span><span>Файлы</span><span class="file-total fold-total"></span>${icon('down', 16)}</summary>
          <div class="fold-body"><ul class="files"></ul><input type="file" id="pick-files" multiple hidden><button type="button" class="text-btn" data-act="attach">${icon('plus', 16)}Прикрепить файлы</button></div></details>
        <details class="edit-section fold" ${related.size ? 'open' : ''}><summary><span class="fold-icon">${icon('link', 17)}</span><span>Связанные задачи</span><span class="link-total fold-total"></span>${icon('down', 16)}</summary>
          <div class="fold-body"><div class="related"></div><button type="button" class="text-btn link-picker" data-act="link" aria-haspopup="listbox" aria-expanded="false">${icon('plus', 16)}Добавить связь</button></div></details>
      </div>
      <p class="form-error" role="alert"></p>
    </div>
    <footer class="drawer-foot">${task ? `<button type="button" class="complete-toggle" aria-label="Завершить задачу" data-act="complete" aria-pressed="${draft.done}"><span>${icon('check', 16)}</span></button><button type="button" class="btn delete-btn" data-act="delete">Удалить</button>` : ''}<button type="submit" class="btn primary">${task ? 'Сохранить' : 'Создать задачу'}</button></footer>
  </form>`;
  const form = dialog.querySelector('form'),
    field = form.elements;
  const errorBox = form.querySelector('.form-error');
  function fail(error) {
    errorBox.textContent = readableError(error);
    errorBox.scrollIntoView({ block: 'nearest' });
  }
  function periodPicker() {
    const fixed = Boolean(draft.date),
      active = bucket(draft);
    form.querySelector('.period-picker').innerHTML = Object.entries(periods)
      .map(
        ([key, name]) =>
          `<button data-period="${key}" type="button" aria-pressed="${active === key}" ${fixed ? 'disabled title="Период определяется датой"' : ''}>${name}</button>`
      )
      .join('');
    field.time.disabled = !fixed;
    form.querySelector('[data-act=clock]').disabled = !fixed;
    field.time.title = fixed ? '' : 'Сначала выберите дату';
  }
  function subList() {
    form.querySelector('.sub-list').innerHTML = draft.subs
      .map(
        (s) =>
          `<li><input type="checkbox" data-sub="${esc(s.id)}" aria-label="${esc(s.title)}" ${s.done ? 'checked' : ''}><input class="sub-title" type="text" data-sub-title="${esc(s.id)}" aria-label="Текст подзадачи" maxlength="300" value="${esc(s.title)}">${iconButton('remove-sub', 'Убрать подзадачу ' + s.title, 'x', `data-id="${esc(s.id)}"`)}</li>`
      )
      .join('');
  }
  function addSub() {
    const title = field.sub.value.trim();
    if (!title) return;
    draft.subs.push({ id: crypto.randomUUID(), title, done: false });
    field.sub.value = '';
    dirty = true;
    subList();
  }
  function fileList() {
    form.querySelector('.file-total').textContent = draft.files.length || '';
    form.querySelector('.files').innerHTML = draft.files
      .map(
        (f) =>
          `<li>${icon('file', 17)}<button type="button" class="file-download" data-act="download" data-id="${esc(f.id)}" title="Скачать ${esc(f.name)}">${esc(f.name)}<small>${fileSize(f.size)}</small></button>${iconButton('remove-file', 'Убрать файл ' + f.name, 'x', `data-id="${esc(f.id)}"`)}</li>`
      )
      .join('');
  }
  function linkList() {
    form.querySelector('.link-total').textContent = related.size || '';
    form.querySelector('.related').innerHTML = state.tasks
      .filter((t) => related.has(t.id))
      .map(
        (t) =>
          `<div class="related-row">${icon('link', 15)}<button type="button" class="peer-open" data-act="open-peer" data-id="${esc(t.id)}">${esc(t.title)}</button>${iconButton('unlink', 'Убрать связь с ' + t.title, 'x', `data-id="${esc(t.id)}"`)}</div>`
      )
      .join('');
    const button = form.querySelector('.link-picker');
    button.disabled = !linkChoices().length;
    button.lastChild.textContent = button.disabled
      ? 'Нет других задач'
      : 'Добавить связь';
  }
  function linkChoices() {
    return state.tasks
      .filter((t) => t.id !== draft.id && !related.has(t.id))
      .map((t) => [t.id, t.title]);
  }
  function projectLabel() {
    form.querySelector('#project-value').textContent =
      state.projects.find((p) => p.id === draft.projectId)?.name ??
      'Без проекта';
  }
  async function download(id) {
    const f = draft.files.find((f) => f.id === id),
      blob = pending.get(id) || (await readFile(id));
    if (!blob) throw new Error('Файл недоступен в этом браузере.');
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function cancel() {
    if (busy) return;
    if (
      !dirty ||
      (await confirmAction(
        'Закрыть задачу?',
        'В карточке есть несохранённые изменения.',
        'Сбросить изменения',
        'Продолжить редактирование',
        true
      ))
    )
      dialog.close();
  }
  async function deleteTask() {
    if (
      !task ||
      !(await confirmAction(
        'Удалить задачу?',
        '«' + task.title + '» будет удалена вместе с файлами и связями.',
        'Удалить',
        'Оставить',
        true
      ))
    )
      return;
    await runSave((s, files) => {
      for (const f of removeTask(s, task.id, task.rev)) files.delete(f.id);
    }, 'Задача удалена');
  }
  async function runSave(change, message) {
    if (busy) return;
    busy = true;
    form.inert = true;
    try {
      await commit(change);
      dialog.close();
      notify(message);
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      form.inert = false;
    }
  }
  form.oninput = (e) => {
    dirty = true;
    errorBox.textContent = '';
    if (e.target.dataset.subTitle) {
      draft.subs.find((s) => s.id === e.target.dataset.subTitle).title =
        e.target.value;
    }
    if (e.target === field.date) {
      const iso = readDate(field.date.value);
      if (iso !== null) applyDate(iso, false);
    }
  };
  function applyDate(iso, format = true) {
    draft.date = iso;
    if (format) field.date.value = displayDate(iso);
    if (!iso) {
      field.time.value = '';
      draft.time = '';
    } else draft.period = bucket(draft);
    dirty = true;
    periodPicker();
  }
  form.onchange = (e) => {
    const el = e.target;
    if (el.matches('[data-sub]')) {
      draft.subs.find((s) => s.id === el.dataset.sub).done = el.checked;
      dirty = true;
    } else if (el.id === 'pick-files') {
      addFiles(el.files);
      el.value = '';
    }
  };
  function addFiles(files) {
    for (const file of files) {
      const id = crypto.randomUUID();
      draft.files.push({
        id,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      pending.set(id, file);
    }
    dirty = true;
    fileList();
  }
  const dropzone = form.querySelector('.files-fold');
  form.ondragover = (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    const inside = dropzone.contains(e.target);
    dropzone.classList.toggle('drag-over', inside);
    if (inside) dropzone.open = true;
    e.dataTransfer.dropEffect = inside ? 'copy' : 'none';
  };
  dropzone.ondragleave = (e) => {
    if (!dropzone.contains(e.relatedTarget))
      dropzone.classList.remove('drag-over');
  };
  form.ondrop = (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (dropzone.contains(e.target)) addFiles(e.dataTransfer.files);
  };
  field.sub.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      addSub();
    }
  };
  form.onclick = async (e) => {
    const button = e.target.closest('button');
    if (!button || busy) return;
    const id = button.dataset.id;
    if (button.dataset.period) {
      draft.period = button.dataset.period;
      dirty = true;
      periodPicker();
      return;
    }
    try {
      switch (button.dataset.act) {
        case 'complete':
          draft.done = !draft.done;
          dirty = true;
          button.setAttribute('aria-pressed', String(draft.done));
          break;
        case 'calendar':
          chooseDate(button, draft.date, applyDate);
          break;
        case 'clock': {
          const times = Array.from(
            { length: 48 },
            (_, i) =>
              String(Math.floor(i / 2)).padStart(2, '0') +
              ':' +
              (i % 2 ? '30' : '00')
          );
          chooseOption(
            button,
            'Выбрать время',
            [['', 'Без времени'], ...times.map((t) => [t, t])],
            field.time.value,
            (t) => {
              field.time.value = t;
              dirty = true;
            }
          );
          break;
        }
        case 'project':
          chooseOption(
            button,
            'Проект',
            [['', 'Без проекта'], ...state.projects.map((p) => [p.id, p.name])],
            draft.projectId ?? '',
            (id) => {
              draft.projectId = id || null;
              dirty = true;
              projectLabel();
            }
          );
          break;
        case 'link':
          chooseOption(
            button,
            'Связанные задачи',
            linkChoices(),
            null,
            (id) => {
              related.add(id);
              dirty = true;
              linkList();
            }
          );
          break;
        case 'cancel':
          cancel();
          break;
        case 'add-sub':
          addSub();
          field.sub.focus();
          break;
        case 'remove-sub':
          draft.subs = draft.subs.filter((s) => s.id !== id);
          dirty = true;
          subList();
          break;
        case 'attach':
          form.querySelector('#pick-files').click();
          break;
        case 'remove-file':
          draft.files = draft.files.filter((f) => f.id !== id);
          pending.delete(id);
          dirty = true;
          fileList();
          break;
        case 'download':
          await download(id);
          break;
        case 'open-peer':
          if (
            !dirty ||
            (await confirmAction(
              'Перейти к другой задаче?',
              'В карточке есть несохранённые изменения.',
              'Перейти без сохранения',
              'Остаться'
            ))
          ) {
            dialog.close();
            openRelated(id);
          }
          break;
        case 'unlink':
          related.delete(id);
          dirty = true;
          linkList();
          break;
        case 'delete':
          await deleteTask();
          break;
      }
    } catch (error) {
      fail(error);
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const iso = readDate(field.date.value);
    if (!field.title.value.trim()) {
      fail(new Error('Введите название задачи.'));
      field.title.focus();
      return;
    }
    if (iso === null) {
      fail(new Error('Введите дату в формате ДД.ММ.ГГГГ.'));
      field.date.focus();
      return;
    }
    if (draft.subs.some((s) => !s.title.trim())) {
      fail(new Error('Введите текст подзадачи или удалите пустую строку.'));
      return;
    }
    for (const sub of draft.subs) sub.title = sub.title.trim();
    const time = field.time.value
      .trim()
      .replace(
        /^(\d{1,2}):?(\d{2})$/,
        (_, h, m) => h.padStart(2, '0') + ':' + m
      );
    addSub();
    Object.assign(draft, {
      title: field.title.value,
      note: field.note.value.trim(),
      date: iso,
      time,
    });
    await runSave(
      (s, files) => {
        saveTask(s, draft, [...related]);
        for (const f of task?.files ?? [])
          if (!draft.files.some((kept) => kept.id === f.id)) files.delete(f.id);
        for (const [id, blob] of pending) files.put(blob, id);
        if (!task && mapId) setMembers(s, mapId, [draft.id], []);
      },
      task ? 'Изменения сохранены' : 'Задача добавлена'
    );
  };
  dialog.oncancel = (e) => {
    e.preventDefault();
    cancel();
  };
  dialog.onclick = (e) => {
    if (e.target === dialog) cancel();
  };
  periodPicker();
  subList();
  fileList();
  linkList();
  dialog.showModal();
  projectLabel();
  field.title.focus({ preventScroll: true });
}
